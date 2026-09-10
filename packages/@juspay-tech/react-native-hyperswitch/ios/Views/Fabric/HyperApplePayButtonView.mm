#import "HyperApplePayButtonView.h"
#import <PassKit/PassKit.h>

#import <react/renderer/components/HyperswitchSdkReactNativeSpec/ComponentDescriptors.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/EventEmitters.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/Props.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface HyperApplePayButtonView () <RCTHyperApplePayButtonViewProtocol>
@end

@implementation HyperApplePayButtonView {
    PKPaymentButton *_paymentButton;
    NSInteger _type;
    NSInteger _buttonStyle;
    NSInteger _buttonBorderRadius;
    BOOL _disabled;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<HyperApplePayButtonComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const HyperApplePayButtonProps>();
        _props = defaultProps;
        _type = 0;
        _buttonStyle = 2;
        _buttonBorderRadius = 4;
        _disabled = NO;
        [self rebuildButton];
    }
    return self;
}

- (void)rebuildButton
{
    [_paymentButton removeFromSuperview];

    PKPaymentButtonType type = static_cast<PKPaymentButtonType>(_type);
    PKPaymentButtonStyle style = static_cast<PKPaymentButtonStyle>(_buttonStyle);

    _paymentButton = [[PKPaymentButton alloc] initWithPaymentButtonType:type
                                                    paymentButtonStyle:style];
    _paymentButton.cornerRadius = (CGFloat)_buttonBorderRadius;
    _paymentButton.enabled = !_disabled;
    _paymentButton.userInteractionEnabled = NO;

    [self addSubview:_paymentButton];
    self.contentView = _paymentButton;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &newProps = *std::static_pointer_cast<const HyperApplePayButtonProps>(props);

    BOOL changed = NO;

    if (_type != (NSInteger)newProps.type) {
        _type = (NSInteger)newProps.type;
        changed = YES;
    }
    if (_buttonStyle != (NSInteger)newProps.buttonStyle) {
        _buttonStyle = (NSInteger)newProps.buttonStyle;
        changed = YES;
    }
    if (_buttonBorderRadius != (NSInteger)newProps.buttonBorderRadius) {
        _buttonBorderRadius = (NSInteger)newProps.buttonBorderRadius;
        changed = YES;
    }
    if (_disabled != (BOOL)newProps.disabled) {
        _disabled = (BOOL)newProps.disabled;
        changed = YES;
    }

    if (changed) {
        [self rebuildButton];
    }

    [super updateProps:props oldProps:oldProps];
}

- (void)layoutSubviews
{
    [super layoutSubviews];
    _paymentButton.frame = self.bounds;
}

Class<RCTComponentViewProtocol> HyperApplePayButtonViewCls(void)
{
    return HyperApplePayButtonView.class;
}

@end
