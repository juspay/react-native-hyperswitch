#import "HyperswitchVaultFormsModule.h"

#import <React/RCTUtils.h>
#import <React/RCTVersion.h>

#import "HyperswitchVaultEngine.h"
#import "HyperswitchVaultForm.h"
#import "HyperswitchVaultProtocol.h"

static NSString *const NotOpen = @"The card form is not open.";

@implementation HyperswitchVaultFormsModule {
  /* The forms this engine opened, so they end with it (a reload of the merchant's JavaScript). */
  NSMutableSet<NSString *> *_opened;
}

RCT_EXPORT_MODULE(HyperswitchVaultForms)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

/* Forms are opened, updated and closed on the main thread, in the order the calls were made. */
- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (instancetype)init
{
  if (self = [super init]) {
    _opened = [NSMutableSet new];
  }
  return self;
}

- (facebook::react::ModuleConstants<JS::NativeHyperswitchVaultForms::Constants::Builder>)constantsToExport
{
  return [self getConstants];
}

- (facebook::react::ModuleConstants<JS::NativeHyperswitchVaultForms::Constants::Builder>)getConstants
{
  NSNumber *minor = RCTGetReactNativeVersion()[@"minor"];
  return facebook::react::typedConstants<JS::NativeHyperswitchVaultForms::Constants::Builder>({
      .newArchitecture = RCTIsNewArchEnabled(),
      .reactNativeMinor = [minor isKindOfClass:NSNumber.class] ? minor.doubleValue : 0,
      .protocolVersion = (double)HyperswitchVaultProtocolVersion,
      .bundled = [HyperswitchVaultEngine isBundled],
  });
}

- (void)openForm:(NSString *)formId settings:(NSString *)settings
{
  [_opened addObject:formId];
  __weak HyperswitchVaultFormsModule *weakSelf = self;
  [HyperswitchVaultForms open:formId
                     settings:settings
                         emit:^(NSString *name, NSString *payloadJson) {
                           [weakSelf send:formId name:name payload:payloadJson];
                         }];
}

- (void)updateForm:(NSString *)formId settings:(NSString *)settings
{
  [[HyperswitchVaultForms get:formId] update:settings];
}

- (void)closeForm:(NSString *)formId
{
  [_opened removeObject:formId];
  [HyperswitchVaultForms close:formId];
}

/* Always resolves. A command that could not run resolves with {"ok":false,"message":...}. */
- (void)sendCommand:(NSString *)formId
               name:(NSString *)name
        elementType:(NSString *)elementType
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  HyperswitchVaultForm *form = [HyperswitchVaultForms get:formId];
  if (form == nil) {
    resolve([HyperswitchVaultForm refusal:NotOpen]);
    return;
  }
  [form command:name
    elementType:elementType ?: @""
          reply:^(NSString *resultJson) {
            resolve(resultJson);
          }];
}

- (void)invalidate
{
  NSArray<NSString *> *leaving = _opened.allObjects;
  [_opened removeAllObjects];
  dispatch_async(dispatch_get_main_queue(), ^{
    for (NSString *formId in leaving) {
      [HyperswitchVaultForms close:formId];
    }
  });
}

- (void)send:(NSString *)formId name:(NSString *)name payload:(NSString *)payloadJson
{
  if (!_eventEmitterCallback) {
    return;
  }
  [self emitOnFormEvent:@{@"formId" : formId, @"name" : name, @"payload" : payloadJson ?: @"{}"}];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchVaultFormsSpecJSI>(params);
}

@end
