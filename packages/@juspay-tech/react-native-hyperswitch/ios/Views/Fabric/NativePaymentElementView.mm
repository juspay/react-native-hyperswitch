//
//  NativePaymentElementView.mm
//
//  Fabric (New Architecture) host view for the PaymentElement and CVCWidget.
//  Component name: "RCTNativePaymentWidget" (matches PaymentWidgetNativeComponent.ts)
//
//  Architecture:
//    ┌─────────────────────────────────────────────────────────────────────┐
//    │  NativePaymentElementView  (RCTViewComponentView — Fabric host)     │
//    │    • receives props via updateProps (widgetType, sdkAuth, options)  │
//    │    • fires events via RCTNativePaymentWidgetEventEmitter           │
//    │    └── NativePaymentWidgetView  (inner UIView — actual widget)      │
//    │          • registered in NativePaymentWidgetViewRegistry by tag     │
//    └─────────────────────────────────────────────────────────────────────┘
//

#import "NativePaymentElementView.h"
#import "NativePaymentWidgetViewRegistry.h"

#import <React/RCTBridgeModule.h>
#import <React/RCTComponent.h>
#import <React/RCTConversions.h>

#include <folly/json.h>

#import <react/renderer/components/HyperswitchSdkReactNativeSpec/ComponentDescriptors.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/EventEmitters.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/Props.h>
#import <react/renderer/components/HyperswitchSdkReactNativeSpec/RCTComponentViewHelpers.h>
#import "RCTFabricComponentsPlugins.h"

#if __has_include("HyperswitchSdkReactNative-Swift.h")
#import "HyperswitchSdkReactNative-Swift.h"
#else
#import <HyperswitchSdkReactNative/HyperswitchSdkReactNative-Swift.h>
#endif

// Category to expose internal event block properties declared in the generated Swift header.
@interface NativePaymentWidgetView (FabricEvents)
@property (nonatomic, copy) RCTDirectEventBlock onPaymentResult;
@property (nonatomic, copy) RCTDirectEventBlock onPaymentEvent;
@property (nonatomic, copy, nullable) NSString *widgetType;
@property (nonatomic, copy, nullable) NSString *sdkAuthorization;
@property (nonatomic, copy, nullable) NSDictionary *options;
- (void)didSetProps;
@end

using namespace facebook::react;

// ── Helper: folly::dynamic → NSDictionary via JSON round-trip ────────────────
static NSDictionary * _Nullable dynamicToDict(const folly::dynamic &dyn)
{
    if (dyn.isNull() || (!dyn.isObject() && !dyn.isArray())) {
        return nil;
    }
    NSString *json = [NSString stringWithUTF8String:folly::toJson(dyn).c_str()];
    if (!json) return nil;
    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    id obj = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    return [obj isKindOfClass:[NSDictionary class]] ? (NSDictionary *)obj : nil;
}

@interface NativePaymentElementView () <RCTRCTNativePaymentWidgetViewProtocol>
@end

@implementation NativePaymentElementView {
    NativePaymentWidgetView *_widgetView;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<RCTNativePaymentWidgetComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const RCTNativePaymentWidgetProps>();
        _props = defaultProps;

        _widgetView = [[NativePaymentWidgetView alloc] initWithFrame:frame];
        _widgetView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
        [self addSubview:_widgetView];
        [self setupEventForwarding];

        self.contentView = _widgetView;
    }
    return self;
}

// Recycling would drop the event forwarding and keep the previous PaymentWidget (and its fired `ready`).
+ (BOOL)shouldBeRecycled
{
    return NO;
}

- (void)prepareForRecycle
{
    [super prepareForRecycle];
    [[NativePaymentWidgetViewRegistry shared] unregisterForTag:@(self.tag)];
    _widgetView.onPaymentResult = nil;
    _widgetView.onPaymentEvent = nil;
}

- (void)willMoveToWindow:(nullable UIWindow *)newWindow
{
    [super willMoveToWindow:newWindow];
    if (newWindow == nil) {
        [[NativePaymentWidgetViewRegistry shared] unregisterForTag:@(self.tag)];
    }
}

#pragma mark - Props

- (void)updateProps:(Props::Shared const &)props
           oldProps:(Props::Shared const &)oldProps
{
    const auto &p = *std::static_pointer_cast<RCTNativePaymentWidgetProps const>(props);

    NSString *widgetType = [NSString stringWithUTF8String:p.widgetType.c_str()];
    NSString *sdkAuth = [NSString stringWithUTF8String:p.sdkAuthorization.c_str()];

    _widgetView.widgetType = widgetType.length > 0 ? widgetType : nil;
    _widgetView.sdkAuthorization = sdkAuth.length > 0 ? sdkAuth : nil;
    _widgetView.options = dynamicToDict(p.options);

    // Notify the inner view that all props have been applied. The old-arch bridge
    // calls didSetProps:changedProps: automatically after KVC; Fabric does not.
    [_widgetView didSetProps];

    [super updateProps:props oldProps:oldProps];

    // Register after super so self.tag is the final Fabric-assigned tag.
    [[NativePaymentWidgetViewRegistry shared] registerView:_widgetView forTag:@(self.tag)];
}

- (void)layoutSubviews
{
    [super layoutSubviews];
    _widgetView.frame = self.bounds;
}

#pragma mark - Event forwarding (inner UIView → Fabric event emitter)

- (void)setupEventForwarding
{
    __weak NativePaymentElementView *weakSelf = self;

    _widgetView.onPaymentResult = ^(NSDictionary *event) {
        NativePaymentElementView *strongSelf = weakSelf;
        if (!strongSelf) return;
        auto em = std::dynamic_pointer_cast<const RCTNativePaymentWidgetEventEmitter>(strongSelf->_eventEmitter);
        if (!em) return;

        NSString *payload = event[@"result"] ?: @"";
        RCTNativePaymentWidgetEventEmitter::OnPaymentResult result;
        result.eventName = std::string("onPaymentResult");
        result.payload = std::string([payload UTF8String]);
        em->onPaymentResult(std::move(result));
    };

    _widgetView.onPaymentEvent = ^(NSDictionary *event) {
        NativePaymentElementView *strongSelf = weakSelf;
        if (!strongSelf) return;
        auto em = std::dynamic_pointer_cast<const RCTNativePaymentWidgetEventEmitter>(strongSelf->_eventEmitter);
        if (!em) return;

        NSString *eventName = event[@"eventName"] ?: @"";
        // The Swift listener already serializes the payload (codegen types it as a string).
        id rawPayload = event[@"payload"];
        NSString *payload = [rawPayload isKindOfClass:[NSString class]] ? rawPayload : @"{}";

        RCTNativePaymentWidgetEventEmitter::OnPaymentEvent paymentEvent;
        paymentEvent.eventName = std::string([eventName UTF8String]);
        paymentEvent.payload = std::string([payload UTF8String]);
        em->onPaymentEvent(std::move(paymentEvent));
    };
}

@end

// Required by RCTFabricComponentsPlugins to auto-register the component under
// the key declared in package.json's codegenConfig.ios.componentProvider.
Class<RCTComponentViewProtocol> NativePaymentElementViewCls(void)
{
    return NativePaymentElementView.class;
}
