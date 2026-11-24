#import "HyperswitchVaultFieldView.h"

#import <react/renderer/components/HyperswitchVaultSpec/ComponentDescriptors.h>
#import <react/renderer/components/HyperswitchVaultSpec/EventEmitters.h>
#import <react/renderer/components/HyperswitchVaultSpec/Props.h>
#import <react/renderer/components/HyperswitchVaultSpec/RCTComponentViewHelpers.h>

#import "HyperswitchVaultEngine.h"
#import "HyperswitchVaultForm.h"
#import "HyperswitchVaultProtocol.h"

using namespace facebook::react;

static NSString *StringOf(const std::string &value)
{
  return [[NSString alloc] initWithBytes:value.data() length:value.size() encoding:NSUTF8StringEncoding] ?: @"";
}

@interface HyperswitchVaultFieldView () <RCTHyperswitchVaultFieldViewViewProtocol, HyperswitchVaultEventTarget>
@end

@implementation HyperswitchVaultFieldView {
  HyperswitchVaultSurface *_surface;

  NSString *_formId;
  NSString *_elementType;
  NSString *_settings;

  /* Which form and field the running root was started for, and the props it last received. */
  NSString *_startedFor;
  NSString *_renderedSettings;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<HyperswitchVaultFieldViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const HyperswitchVaultFieldViewProps>();
    _props = defaultProps;
  }
  return self;
}

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &next = *std::static_pointer_cast<const HyperswitchVaultFieldViewProps>(props);
  _formId = StringOf(next.formId);
  _elementType = StringOf(next.elementType);
  _settings = StringOf(next.settings);
  [super updateProps:props oldProps:oldProps];
  [self render];
}

- (void)render
{
  if (_formId.length == 0 || _elementType.length == 0) {
    return;
  }
  NSString *settings = _settings.length > 0 ? _settings : @"{}";
  NSString *identity = [NSString stringWithFormat:@"%@/%@", _formId, _elementType];

  if (_surface != nil && [_startedFor isEqualToString:identity]) {
    /* Same field: new props for the running root, which keeps what was typed. */
    if (![settings isEqualToString:_renderedSettings]) {
      _renderedSettings = settings;
      [_surface update:[self propsOf:settings]];
    }
    return;
  }
  /* A different form or field in this view: the old root goes. */
  [self stop];

  /* The form reports a missing bundle; its fields just stay empty. */
  if (![HyperswitchVaultEngine isBundled]) {
    return;
  }
  _surface = [HyperswitchVaultEngine.shared start:HyperswitchVaultFieldRoot props:[self propsOf:settings] owner:self];
  _startedFor = identity;
  _renderedSettings = settings;

  UIView *root = _surface.view;
  root.frame = self.bounds;
  root.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self addSubview:root];
}

- (void)stop
{
  [_surface stop];
  _surface = nil;
  _startedFor = nil;
  _renderedSettings = nil;
}

/* React Native reuses native views. A reused view must not show the last field's root. */
- (void)prepareForRecycle
{
  [super prepareForRecycle];
  [self stop];
  _formId = nil;
  _elementType = nil;
  _settings = nil;
}

- (void)dealloc
{
  [_surface stop];
}

/*
 * The merchant's React Native treats this view as the focused text input while its field has the
 * keyboard, and sends it the commands it would send a text input: "blur" when the user taps outside
 * a field or the app calls Keyboard.dismiss(), "focus" to give it the keyboard. The real input is
 * in the vault's engine, so the command is passed on to the field there.
 */
- (void)handleCommand:(const NSString *)commandName args:(const NSArray *)args
{
  NSString *name = [commandName copy];
  if (([name isEqualToString:@"blur"] || [name isEqualToString:@"focus"]) && _formId.length > 0 && _elementType.length > 0) {
    [[HyperswitchVaultForms get:_formId] command:name
                                     elementType:_elementType
                                           reply:^(NSString *resultJson) {
                                           }];
  }
}

#pragma mark - Events from the field's root

/* On the main thread: on to the merchant's engine as this view's event. */
- (void)vaultEvent:(NSString *)name payload:(NSString *)payloadJson
{
  if (_eventEmitter == nullptr) {
    return;
  }
  std::static_pointer_cast<const HyperswitchVaultFieldViewEventEmitter>(_eventEmitter)
      ->onFieldEvent({.name = std::string(name.UTF8String ?: ""), .payload = std::string(payloadJson.UTF8String ?: "{}")});
}

- (NSDictionary *)propsOf:(NSString *)settings
{
  return @{
    @"formId" : _formId,
    @"elementType" : _elementType,
    @"protocolVersion" : @(HyperswitchVaultProtocolVersion),
    @"settings" : settings,
  };
}

@end

Class<RCTComponentViewProtocol> HyperswitchVaultFieldViewCls(void)
{
  return HyperswitchVaultFieldView.class;
}
