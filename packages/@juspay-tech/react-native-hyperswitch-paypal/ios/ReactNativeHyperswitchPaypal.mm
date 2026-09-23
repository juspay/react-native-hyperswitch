#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNHyperswitchPaypalSpec.h"
#endif

#if __has_include(<ReactNativeHyperswitchPaypal/ReactNativeHyperswitchPaypal-Swift.h>)
#import <ReactNativeHyperswitchPaypal/ReactNativeHyperswitchPaypal-Swift.h>
#else
#import "ReactNativeHyperswitchPaypal-Swift.h"
#endif

@interface HyperswitchPaypal : NSObject <RCTBridgeModule>
@end

#ifdef RCT_NEW_ARCH_ENABLED
@interface HyperswitchPaypal () <NativeHyperswitchPaypalSpec>
@end
#endif

@implementation HyperswitchPaypal {
  HyperswitchPaypalImpl *_impl;
}

RCT_EXPORT_MODULE()

- (instancetype)init
{
  if (self = [super init]) {
    _impl = [HyperswitchPaypalImpl new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_EXPORT_METHOD(launchPayPal:(NSString *)requestObj
                  callback:(RCTResponseSenderBlock)callback)
{
  [self->_impl launchPayPal:requestObj callback:callback];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchPaypalSpecJSI>(params);
}
#endif

@end

#ifndef RCT_NEW_ARCH_ENABLED

@interface RCT_EXTERN_MODULE(PaypalButton, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(buttonColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonLabel, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonSize, NSString)
RCT_EXPORT_VIEW_PROPERTY(borderRadius, double)

@end

#endif // !RCT_NEW_ARCH_ENABLED
