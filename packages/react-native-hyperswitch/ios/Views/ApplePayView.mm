#import "ApplePayView.h"
#import <PassKit/PassKit.h>

#import <react/renderer/components/HyperswitchSdkReactNativeSpec/ComponentDescriptors.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/EventEmitters.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/Props.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface ApplePayView () <RCTApplePayViewViewProtocol>

@property (nonatomic, strong, nullable) PKPaymentButton *button;

@end

@implementation ApplePayView {
    PKPaymentButton *_paymentButton;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<ApplePayViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const ApplePayViewProps>();
        _props = defaultProps;

        [self setupDefaultButton];
    }

    return self;
}

- (void)setupDefaultButton {
    [self setupButtonWithType:PKPaymentButtonTypePlain style:PKPaymentButtonStyleBlack cornerRadius:4.0];
}

- (void)setupButtonWithType:(PKPaymentButtonType)type style:(PKPaymentButtonStyle)style cornerRadius:(CGFloat)cornerRadius {
    [_paymentButton removeFromSuperview];

    _paymentButton = [[PKPaymentButton alloc] initWithPaymentButtonType:type paymentButtonStyle:style];
    _paymentButton.cornerRadius = cornerRadius;

//    [_paymentButton addTarget:self action:@selector(applePayButtonTapped:) forControlEvents:UIControlEventTouchUpInside];

    [self addSubview:_paymentButton];
    self.contentView = _paymentButton;
}

- (PKPaymentButtonType)paymentButtonTypeFromString:(NSString *)type {
    if ([type isEqualToString:@"buy"]) return PKPaymentButtonTypeBuy;
    if ([type isEqualToString:@"setUp"]) return PKPaymentButtonTypeSetUp;
    if ([type isEqualToString:@"inStore"]) return PKPaymentButtonTypeInStore;
    if ([type isEqualToString:@"donate"]) return PKPaymentButtonTypeDonate;
    if ([type isEqualToString:@"checkout"]) return PKPaymentButtonTypeCheckout;
    if ([type isEqualToString:@"book"]) return PKPaymentButtonTypeBook;
    if ([type isEqualToString:@"subscribe"]) return PKPaymentButtonTypeSubscribe;
    return PKPaymentButtonTypePlain;
}

- (PKPaymentButtonStyle)paymentButtonStyleFromString:(NSString *)style {
    if ([style isEqualToString:@"white"]) return PKPaymentButtonStyleWhite;
    if ([style isEqualToString:@"whiteOutline"]) return PKPaymentButtonStyleWhiteOutline;
    return PKPaymentButtonStyleBlack;
}


- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    [super updateProps:props oldProps:oldProps];
}

- (void)layoutSubviews {
    [super layoutSubviews];
    _paymentButton.frame = self.bounds;
}

Class<RCTComponentViewProtocol> ApplePayViewCls(void)
{
    return ApplePayView.class;
}

@end
