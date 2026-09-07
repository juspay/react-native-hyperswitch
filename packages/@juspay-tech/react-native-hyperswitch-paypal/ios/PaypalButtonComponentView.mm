#ifdef RCT_NEW_ARCH_ENABLED

#import <React/RCTConversions.h>
#import <React/RCTViewComponentView.h>

#import <react/renderer/components/RNHyperswitchPaypalSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNHyperswitchPaypalSpec/Props.h>

#if __has_include(<ReactNativeHyperswitchPaypal/ReactNativeHyperswitchPaypal-Swift.h>)
#import <ReactNativeHyperswitchPaypal/ReactNativeHyperswitchPaypal-Swift.h>
#else
#import "ReactNativeHyperswitchPaypal-Swift.h"
#endif

using namespace facebook::react;

@interface PaypalButtonComponentView : RCTViewComponentView
@end

@implementation PaypalButtonComponentView {
  PaypalButtonView *_view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<PaypalButtonComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const PaypalButtonProps>();
    _props = defaultProps;
    _view = [[PaypalButtonView alloc] initWithFrame:frame];
    self.contentView = _view;
  }
  return self;
}

- (void)prepareForRecycle
{
  [super prepareForRecycle];
  static const auto defaultProps = std::make_shared<const PaypalButtonProps>();
  _props = defaultProps;
}

- (void)updateProps:(const Props::Shared &)props oldProps:(const Props::Shared &)oldProps
{
  const auto &oldViewProps = *std::static_pointer_cast<const PaypalButtonProps>(_props);
  const auto &newViewProps = *std::static_pointer_cast<const PaypalButtonProps>(props);

  if (oldViewProps.buttonColor != newViewProps.buttonColor && !newViewProps.buttonColor.empty()) {
    _view.buttonColor = RCTNSStringFromString(newViewProps.buttonColor);
  }
  if (oldViewProps.buttonLabel != newViewProps.buttonLabel && !newViewProps.buttonLabel.empty()) {
    _view.buttonLabel = RCTNSStringFromString(newViewProps.buttonLabel);
  }
  if (oldViewProps.buttonSize != newViewProps.buttonSize && !newViewProps.buttonSize.empty()) {
    _view.buttonSize = RCTNSStringFromString(newViewProps.buttonSize);
  }
  if (oldViewProps.borderRadius != newViewProps.borderRadius) {
    _view.borderRadius = newViewProps.borderRadius;
  }

  [super updateProps:props oldProps:oldProps];
}

@end

Class<RCTComponentViewProtocol> PaypalButtonCls(void)
{
  return PaypalButtonComponentView.class;
}

#endif // RCT_NEW_ARCH_ENABLED
