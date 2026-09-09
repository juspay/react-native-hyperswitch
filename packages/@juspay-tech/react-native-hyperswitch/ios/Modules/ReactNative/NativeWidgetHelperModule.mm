//
//  NativeWidgetHelperModule.mm
//  Hyperswitch
//
//  TurboModule bridge for widget helper operations
//
//  Created by Kuntimaddi Manideep on 02/08/26.
//

#import "NativeWidgetHelperModule.h"
#import "HyperswitchSdkReactNative-Swift.h"
#import <React/RCTBridge+Private.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <HyperswitchSdkReactNativeSpec/HyperswitchSdkReactNativeSpec.h>
#endif

@interface NativeWidgetHelperModule () <
#ifdef RCT_NEW_ARCH_ENABLED
    NativeWidgetHelperModuleSpec
#else
    RCTBridgeModule
#endif
>
@end

@implementation NativeWidgetHelperModule {
    __weak RCTBridge *_bridge;
}

RCT_EXPORT_MODULE(NativeWidgetHelperModule);

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

- (void)setBridge:(RCTBridge *)bridge {
    _bridge = bridge;
}

RCT_EXPORT_METHOD(confirmPayment:(double)reactTag
                  callback:(RCTResponseSenderBlock)callback) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [NativeWidgetHelperModuleImpl.shared confirmPaymentWithReactTag:@(reactTag)
                                                                callback:callback];
    });
}

RCT_EXPORT_METHOD(updateIntentInitForWidget:(double)reactTag
                  callback:(RCTResponseSenderBlock)callback) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [NativeWidgetHelperModuleImpl.shared updateIntentInitWithReactTag:@(reactTag)
                                                                  callback:callback];
    });
}

RCT_EXPORT_METHOD(updateIntentCompleteForWidget:(double)reactTag
                  sdkAuthorization:(NSString *)sdkAuthorization
                  callback:(RCTResponseSenderBlock)callback) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [NativeWidgetHelperModuleImpl.shared updateIntentCompleteWithReactTag:@(reactTag)
                                                                sdkAuthorization:sdkAuthorization
                                                                       callback:callback];
    });
}

RCT_EXPORT_METHOD(deinitWidget:(NSString *)sdkAuthorization
                  callback:(RCTResponseSenderBlock)callback) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [NativeWidgetHelperModuleImpl.shared deinitWidgetWithSdkAuthorization:sdkAuthorization
                                                                     callback:callback];
    });
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeWidgetHelperModuleSpecJSI>(params);
}
#endif

@end
