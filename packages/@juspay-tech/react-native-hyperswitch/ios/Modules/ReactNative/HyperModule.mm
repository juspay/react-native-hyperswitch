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

/* Exit results arrive as the codegen struct and are read field by field, as in
   hyperswitch-client-core's HyperTurboModule.mm. The Swift impl still takes the
   JSON string the bundle used to send, so it is rebuilt from the fields that are
   present, as Android's toExitResultJson does. */
static NSString *HyperExitResultJSON(JS::NativeHyperModule::PaymentExitResult &result)
{
    NSMutableDictionary *json = [NSMutableDictionary dictionary];
    json[@"status"] = result.status() ?: @"failed";
    if (result.code()) json[@"code"] = result.code();
    if (result.message()) json[@"message"] = result.message();
    if (result.type()) json[@"type"] = result.type();
    NSData *data = [NSJSONSerialization dataWithJSONObject:json options:0 error:nil];
    return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]
                : @"{\"status\":\"failed\",\"message\":\"unknown\"}";
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

- (void)exitPaymentsheet:(double)rootTag
                  result:(JS::NativeHyperModule::PaymentExitResult &)result
                   reset:(BOOL)reset
{
    [self.impl exitPaymentsheet:@(rootTag) result:HyperExitResultJSON(result) reset:reset];
}

- (void)exitPaymentMethodManagement:(double)rootTag result:(NSString *)result reset:(BOOL)reset
{
    [self.impl exitPaymentMethodManagement:@(rootTag) result:result reset:reset];
}

- (void)exitWidget:(JS::NativeHyperModule::PaymentExitResult &)result widgetType:(NSString *)widgetType
{
    [self.impl exitWidget:HyperExitResultJSON(result) widgetType:widgetType];
}

- (void)exitCardForm:(NSString *)result
{
    [self.impl exitCardForm:result];
}

- (void)launchWidgetPaymentSheet:(NSString *)requestObj callback:(RCTResponseSenderBlock)callback
{
    [self.impl launchWidgetPaymentSheet:requestObj callback:callback];
}

- (void)exitWidgetPaymentsheet:(double)rootTag
                        result:(JS::NativeHyperModule::PaymentExitResult &)result
                         reset:(BOOL)reset
{
    [self.impl exitWidgetPaymentsheet:@(rootTag) result:HyperExitResultJSON(result) reset:reset];
}

- (void)updateWidgetHeight:(double)height
{
    [self.impl updateWidgetHeight:@(height)];
}

- (void)notifyWidgetPaymentResult:(double)rootTag
                           result:(JS::NativeHyperModule::PaymentExitResult &)result
{
    [self.impl notifyWidgetPaymentResult:@(rootTag) result:HyperExitResultJSON(result)];
}

- (void)onAddPaymentMethod:(NSString *)data
{
    [self.impl onAddPaymentMethod:data];
}

- (void)emitPaymentEvent:(double)rootTag eventType:(NSString *)eventType payload:(NSDictionary *)payload
{
    [self.impl emitPaymentEvent:@(rootTag) eventType:eventType payload:payload];
}

- (void)onUpdateIntentEvent:(double)rootTag
                       type:(NSString *)type
                     result:(JS::NativeHyperModule::PaymentExitResult &)result
{
    [self.impl onUpdateIntentEvent:@(rootTag) type:type result:HyperExitResultJSON(result)];
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
