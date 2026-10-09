#import <React/RCTComponentViewFactory.h>
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

static double PaypalButtonBorderRadius(const PaypalButtonProps &props)
{
  const auto &radius = props.borderRadii.all;
  return radius.has_value() && radius->unit == UnitType::Point ? radius->value : props.borderRadius;
}

@interface PaypalButtonComponentView : RCTViewComponentView
@end

@implementation PaypalButtonComponentView {
  PaypalButtonView *_view;
}

// The component registers itself wherever this class is linked. codegenConfig.ios.componentProvider
// is empty on purpose: the list React Native generates from it for the whole app names each class
// by string and crashes when one is not linked, as in an app extension, or in the Hyperswitch iOS
// SDK when an app leaves out its PayPal plugin.
+ (void)load
{
  [[RCTComponentViewFactory currentComponentViewFactory] registerComponentViewClass:self];
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<PaypalButtonComponentDescriptor>();
}

// updateProps only pushes props that differ from _props, and prepareForRecycle resets
// _props but not _view, so a recycled button would keep the previous button's styling.
+ (BOOL)shouldBeRecycled
{
  return NO;
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
  const double oldBorderRadius = PaypalButtonBorderRadius(oldViewProps);
  const double newBorderRadius = PaypalButtonBorderRadius(newViewProps);
  if (oldBorderRadius != newBorderRadius) {
    _view.borderRadius = newBorderRadius;
  }

  [super updateProps:props oldProps:oldProps];
}

@end

extern "C" Class<RCTComponentViewProtocol> PaypalButtonCls(void)
{
  return PaypalButtonComponentView.class;
}
