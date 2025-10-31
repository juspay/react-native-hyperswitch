#import "HyperswitchSdkReactNative.h"

#if __has_include("HyperswitchSdkReactNative-Swift.h")
#import "HyperswitchSdkReactNative-Swift.h"
#else
// When using use_frameworks! :linkage => :static in Podfile
#import <HyperswitchSdkReactNative/HyperswitchSdkReactNative-Swift.h>
#endif


@implementation HyperswitchSdkReactNative
RCT_EXPORT_MODULE()

//- (instancetype)init
//{
//  self = [super init];
//  if (self) {
//    StripeSdkImpl.shared.emitter = self;
//  }
//  return self;
//}

RCT_EXPORT_METHOD(initialise:(nonnull NSString *)publishableKey
                  customBackendUrl:(nullable NSString *)customBackendUrl
                  customLogUrl:(nullable NSString *)customLogUrl
                  customParams:(nullable NSDictionary *)customParams
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject) {
  [HyperswitchModule.shared initialiseWithPublishableKey:publishableKey customBackendUrl:customBackendUrl customLogUrl:customLogUrl customParams:customParams resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(initPaymentSession:(nonnull NSString *)paymentIntentClientSecret
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject) {
  
  [HyperswitchModule.shared initPaymentSessionWithpaymentIntentClientSecret:paymentIntentClientSecret resolve:resolve reject:reject];
}

RCT_EXPORT_METHOD(presentPaymentSheet:(nonnull NSDictionary *)configuration
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
  [HyperswitchModule.shared presentPaymentSheetWithConfiguration:configuration resolver:resolve rejecter:reject];
}


- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchSdkReactNativeSpecJSI>(params);
}

@end
