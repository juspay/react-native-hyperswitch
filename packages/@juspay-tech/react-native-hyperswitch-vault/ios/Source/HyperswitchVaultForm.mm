#import "HyperswitchVaultForm.h"

#import "HyperswitchVaultEngine.h"
#import "HyperswitchVaultProtocol.h"

/* The bundle has to load and its root has to mount. Long for a slow first start, short for a person waiting. */
static const NSTimeInterval OpenTimeout = 15;

/* Longer than the vault's own network timeouts, so a tokenize that is still working is not cut off. */
static const NSTimeInterval CommandTimeout = 90;

static NSString *const NotBundled = @"This build of the app has no card-form bundle.";
static NSString *const NotStarted = @"The card form did not start.";
static NSString *const NotOpen = @"The card form is not open.";
static NSString *const Closed = @"The card form was closed.";
static NSString *const Unreachable = @"The card form cannot be reached.";
static NSString *const NoAnswer = @"The card form did not answer.";

typedef NS_ENUM(NSInteger, Phase) { PhaseOpening, PhaseOpen, PhaseFailed };

static NSString *FieldOf(NSString *json, NSString *key)
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  if (data == nil) {
    return nil;
  }
  id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![parsed isKindOfClass:NSDictionary.class]) {
    return nil;
  }
  id value = ((NSDictionary *)parsed)[key];
  return [value isKindOfClass:NSString.class] && [(NSString *)value length] > 0 ? value : nil;
}

static NSString *JsonOf(NSDictionary *value)
{
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
  return data != nil ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"{}";
}

@interface HyperswitchVaultForm () <HyperswitchVaultEventTarget>
@end

@implementation HyperswitchVaultForm {
  HyperswitchVaultEmit _emit;
  HyperswitchVaultSurface *_surface;
  Phase _phase;
  NSString *_failure;
  BOOL _closed;

  /* Commands that arrived before the form's root was up. Run, in order, once it is up or has failed. */
  NSMutableArray<dispatch_block_t> *_whenSettled;
  NSMutableDictionary<NSString *, HyperswitchVaultReply> *_pending;

  /* Bumped when the open timeout must no longer fire. */
  NSInteger _openGeneration;
}

+ (NSString *)refusal:(NSString *)message
{
  return JsonOf(@{@"ok" : @NO, @"message" : message});
}

- (instancetype)initWithFormId:(NSString *)formId emit:(HyperswitchVaultEmit)emit
{
  if (self = [super init]) {
    _formId = [formId copy];
    _emit = [emit copy];
    _phase = PhaseOpening;
    _whenSettled = [NSMutableArray new];
    _pending = [NSMutableDictionary new];
  }
  return self;
}

- (void)open:(NSString *)settings
{
  if (![HyperswitchVaultEngine isBundled]) {
    [self fail:NotBundled];
    return;
  }
  /* The hidden root's view is never put on screen. */
  _surface = [HyperswitchVaultEngine.shared start:HyperswitchVaultFormRoot props:[self propsOf:settings] owner:self];

  NSInteger generation = ++_openGeneration;
  __weak HyperswitchVaultForm *weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(OpenTimeout * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    HyperswitchVaultForm *form = weakSelf;
    if (form != nil && form->_openGeneration == generation) {
      [form fail:NotStarted];
    }
  });
}

- (void)update:(NSString *)settings
{
  [_surface update:[self propsOf:settings]];
}

- (void)command:(NSString *)name elementType:(NSString *)elementType reply:(HyperswitchVaultReply)reply
{
  __weak HyperswitchVaultForm *weakSelf = self;
  [self whenFormSettles:^{
    HyperswitchVaultForm *form = weakSelf;
    if (form == nil) {
      reply([HyperswitchVaultForm refusal:Closed]);
      return;
    }
    if (form->_phase == PhaseFailed || form->_surface == nil) {
      reply([HyperswitchVaultForm refusal:form->_failure ?: NotOpen]);
      return;
    }
    NSString *commandId = NSUUID.UUID.UUIDString;
    form->_pending[commandId] = [reply copy];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(CommandTimeout * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [weakSelf answer:commandId result:[HyperswitchVaultForm refusal:NoAnswer]];
    });

    NSMutableDictionary *command = [@{
      @"rootTag" : @(form->_surface.rootTag),
      @"formId" : form->_formId,
      @"commandId" : commandId,
      @"name" : name,
    } mutableCopy];
    if (elementType.length > 0) {
      command[@"elementType"] = elementType;
    }
    if (![HyperswitchVaultEngine.shared send:command]) {
      [form answer:commandId result:[HyperswitchVaultForm refusal:Unreachable]];
    }
  }];
}

- (void)close
{
  if (_closed) {
    return;
  }
  _closed = YES;
  _openGeneration++;
  [_surface stop];
  _surface = nil;
  [self settle:PhaseFailed failure:Closed];
  [self answerAll:[HyperswitchVaultForm refusal:Closed]];
}

#pragma mark - Events from the form's root

- (void)vaultEvent:(NSString *)name payload:(NSString *)payloadJson
{
  if (_closed) {
    return;
  }
  if ([name isEqualToString:HyperswitchVaultCommandResult]) {
    /* For the caller of the command, not for the merchant's listeners. */
    NSString *commandId = FieldOf(payloadJson, @"commandId");
    if (commandId != nil) {
      [self answer:commandId result:payloadJson];
    }
    return;
  }
  if ([name isEqualToString:HyperswitchVaultFormMounted]) {
    _openGeneration++;
    [self settle:PhaseOpen failure:nil];
  } else if ([name isEqualToString:HyperswitchVaultFormError]) {
    _openGeneration++;
    [self settle:PhaseFailed failure:FieldOf(payloadJson, @"message") ?: NotStarted];
  }
  _emit(name, payloadJson);
}

#pragma mark - Endings

/* The form cannot go on, for a reason native code found. The merchant's side is told once. */
- (void)fail:(NSString *)message
{
  if (_closed || _phase == PhaseFailed) {
    return;
  }
  _openGeneration++;
  _phase = PhaseFailed;
  _failure = message;
  [self drain];
  [self answerAll:[HyperswitchVaultForm refusal:message]];
  _emit(HyperswitchVaultFormError, JsonOf(@{@"message" : message}));
}

- (void)whenFormSettles:(dispatch_block_t)work
{
  if (_phase == PhaseOpening) {
    [_whenSettled addObject:[work copy]];
  } else {
    work();
  }
}

- (void)settle:(Phase)next failure:(NSString *)failure
{
  if (_phase != PhaseOpening) {
    return;
  }
  _phase = next;
  _failure = failure;
  [self drain];
}

- (void)drain
{
  NSArray<dispatch_block_t> *waiting = [_whenSettled copy];
  [_whenSettled removeAllObjects];
  for (dispatch_block_t work in waiting) {
    work();
  }
}

- (void)answer:(NSString *)commandId result:(NSString *)resultJson
{
  HyperswitchVaultReply reply = _pending[commandId];
  if (reply == nil) {
    return;
  }
  [_pending removeObjectForKey:commandId];
  reply(resultJson);
}

- (void)answerAll:(NSString *)resultJson
{
  for (NSString *commandId in _pending.allKeys) {
    [self answer:commandId result:resultJson];
  }
}

- (NSDictionary *)propsOf:(NSString *)settings
{
  return @{
    @"formId" : _formId,
    @"protocolVersion" : @(HyperswitchVaultProtocolVersion),
    @"settings" : settings ?: @"{}",
  };
}

@end

@implementation HyperswitchVaultForms

+ (NSMutableDictionary<NSString *, HyperswitchVaultForm *> *)forms
{
  static NSMutableDictionary *forms;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    forms = [NSMutableDictionary new];
  });
  return forms;
}

+ (void)open:(NSString *)formId settings:(NSString *)settings emit:(HyperswitchVaultEmit)emit
{
  /* A formId is opened once. Opening it again replaces the old form, which answers its commands as closed. */
  [[self forms][formId] close];
  HyperswitchVaultForm *form = [[HyperswitchVaultForm alloc] initWithFormId:formId emit:emit];
  [self forms][formId] = form;
  [form open:settings];
}

+ (HyperswitchVaultForm *)get:(NSString *)formId
{
  return [self forms][formId];
}

+ (void)close:(NSString *)formId
{
  HyperswitchVaultForm *form = [self forms][formId];
  [[self forms] removeObjectForKey:formId];
  [form close];
}

@end
