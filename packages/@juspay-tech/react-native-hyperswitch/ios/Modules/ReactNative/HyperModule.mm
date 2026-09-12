#import <React/RCTSurfacePresenterStub.h>
#import <React/RCTSurfacePresenter.h>
#import <React/RCTFabricSurface.h>
#import <React/RCTSurfaceView.h>
#import <React/RCTVersion.h>

#if __has_include(<ReactCodegen/HyperswitchSdkReactNativeSpec/HyperswitchSdkReactNativeSpec.h>)
#import <ReactCodegen/HyperswitchSdkReactNativeSpec/HyperswitchSdkReactNativeSpec.h>
#else
#import <HyperswitchSdkReactNativeSpec/HyperswitchSdkReactNativeSpec.h>
#endif

#if __has_include("HyperswitchSdkReactNative-Swift.h")
#import "HyperswitchSdkReactNative-Swift.h"
#else
#import <HyperswitchSdkReactNative/HyperswitchSdkReactNative-Swift.h>
#endif


@interface HyperModule : NativeHyperModuleSpecBase <NativeHyperModuleSpec, HyperModuleShim>
@property (nonatomic, weak) HyperModuleImpl *impl;
@end

@implementation HyperModule {
    __weak RCTSurfacePresenter *_surfacePresenter;
}

RCT_EXPORT_MODULE(HyperModule)

/**
 * hyperswitch-client-core hands the exit / result methods its `exitResultPayload`
 * record ({status, type?, code?, message?}) instead of a JSON string.
 *
 * Both shapes reach us in practice: hyperswitch-rn82plus.bundle sends the object,
 * while hyperswitch.bundle (RN 0.76-0.81, still shipped and selected by
 * HyperBundleResolver) sends the stringified form. TurboModule argument
 * conversion on iOS is untyped, so an NSString can arrive at an NSDictionary
 * parameter — accept either and hand HyperModuleImpl the JSON string it expects.
 */
static NSString *HSExitResultJSONString(id result)
{
    if ([result isKindOfClass:[NSString class]]) {
        return (NSString *)result;
    }
    if (![result isKindOfClass:[NSDictionary class]]) {
        return @"{}";
    }
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:&error];
    if (data == nil || error != nil) {
        return @"{}";
    }
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"{}";
}

static BOOL HyperModuleDelegateAttachUnsupported(void)
{
    static BOOL unsupported;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSDictionary *version = RCTGetReactNativeVersion() ?: @{};
        NSInteger minor = [version[RCTVersionMinor] integerValue];
        NSInteger major = [version[RCTVersionMajor] integerValue];
        unsupported = (major == 0 && minor < 81);
    });
    return unsupported;
}

- (instancetype)init
{
    self = [super init];
    if (self) {
        BOOL delegateUnsupported = HyperModuleDelegateAttachUnsupported();
        NSLog(@"[HyperModule] init delegateUnsupported=%d", delegateUnsupported);
        if (delegateUnsupported) {
            [HyperModuleImpl.shared attachTo:self];
        }
    }
    return self;
}

- (HyperModuleImpl *)impl
{
    if (!_impl) {
        NSLog(@"[HyperModule] impl getter resolving shared (attach missing?)");
        _impl = HyperModuleImpl.shared;
    }
    return _impl;
}

- (void)setSurfacePresenter:(id<RCTSurfacePresenterStub>)surfacePresenter
{
    _surfacePresenter = (RCTSurfacePresenter *)surfacePresenter;
}

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

#pragma mark - HyperModuleShim

- (void)attachImpl:(HyperModuleImpl *)impl
{
    self.impl = impl;
}

- (UIView *)viewForRootTag:(NSNumber *)rootTag
{
    return [[_surfacePresenter surfaceForRootTag:(ReactTag)rootTag.intValue] view];
}

- (void)emitEventWithName:(NSString *)name payload:(NSDictionary<NSString *, id> *)payload
{
    if (!_eventEmitterCallback) {
        return;
    }
    if ([name isEqualToString:@"confirm"]) {
        [self emitConfirm:payload];
    } else if ([name isEqualToString:@"widget"]) {
        [self emitWidget:payload];
    } else if ([name isEqualToString:@"confirmEC"]) {
        [self emitConfirmEC:payload];
    } else if ([name isEqualToString:@"triggerWidgetAction"]) {
        [self emitTriggerWidgetAction:payload];
    } else if ([name isEqualToString:@"updateIntentInit"]) {
        [self emitUpdateIntentInit:payload];
    } else if ([name isEqualToString:@"updateIntentComplete"]) {
        [self emitUpdateIntentComplete:payload];
    }
}

#pragma mark - NativeHyperModuleSpec

- (void)sendMessageToNative:(NSString *)message
{
    [self.impl sendMessageToNative:message];
}

- (void)launchGPay:(NSString *)requestObj callback:(RCTResponseSenderBlock)callback
{
    [self.impl launchGPay:requestObj callback:callback];
}

- (void)launchApplePay:(NSString *)requestObj callback:(RCTResponseSenderBlock)callback
{
    [self.impl launchApplePay:requestObj callback:callback];
}

- (void)startApplePay:(NSString *)requestObj callback:(RCTResponseSenderBlock)callback
{
    [self.impl startApplePay:requestObj callback:callback];
}

- (void)presentApplePay:(NSString *)requestObj callback:(RCTResponseSenderBlock)callback
{
    [self.impl presentApplePay:requestObj callback:callback];
}

- (void)exitPaymentsheet:(double)rootTag result:(NSDictionary *)result reset:(BOOL)reset
{
    [self.impl exitPaymentsheet:@(rootTag) result:HSExitResultJSONString(result) reset:reset];
}

- (void)exitPaymentMethodManagement:(double)rootTag result:(NSString *)result reset:(BOOL)reset
{
    [self.impl exitPaymentMethodManagement:@(rootTag) result:result reset:reset];
}

- (void)exitWidget:(NSDictionary *)result widgetType:(NSString *)widgetType
{
    [self.impl exitWidget:HSExitResultJSONString(result) widgetType:widgetType];
}

- (void)exitCardForm:(NSString *)result
{
    [self.impl exitCardForm:result];
}

- (void)launchWidgetPaymentSheet:(NSString *)requestObj callback:(RCTResponseSenderBlock)callback
{
    [self.impl launchWidgetPaymentSheet:requestObj callback:callback];
}

- (void)exitWidgetPaymentsheet:(double)rootTag result:(NSDictionary *)result reset:(BOOL)reset
{
    [self.impl exitWidgetPaymentsheet:@(rootTag) result:HSExitResultJSONString(result) reset:reset];
}

- (void)updateWidgetHeight:(double)height
{
    [self.impl updateWidgetHeight:@(height)];
}

- (void)notifyWidgetPaymentResult:(double)rootTag result:(NSDictionary *)result
{
    [self.impl notifyWidgetPaymentResult:@(rootTag) result:HSExitResultJSONString(result)];
}

- (void)onAddPaymentMethod:(NSString *)data
{
    [self.impl onAddPaymentMethod:data];
}

- (void)emitPaymentEvent:(double)rootTag eventType:(NSString *)eventType payload:(NSDictionary *)payload
{
    [self.impl emitPaymentEvent:@(rootTag) eventType:eventType payload:payload];
}

- (void)onUpdateIntentEvent:(double)rootTag type:(NSString *)type result:(NSDictionary *)result
{
    [self.impl onUpdateIntentEvent:@(rootTag) type:type result:HSExitResultJSONString(result)];
}

- (void)onPaymentConfirmButtonClick:(double)rootTag payload:(NSString *)payload callback:(RCTResponseSenderBlock)callback
{
    [self.impl onPaymentConfirmButtonClick:@(rootTag) payload:payload callback:callback];
}

- (void)openIframeBridge:(NSString *)url timeoutMs:(double)timeoutMs callback:(RCTResponseSenderBlock)callback
{
    [self.impl openIframeBridge:url timeoutMs:@(timeoutMs) callback:callback];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeHyperModuleSpecJSI>(params);
}

@end
