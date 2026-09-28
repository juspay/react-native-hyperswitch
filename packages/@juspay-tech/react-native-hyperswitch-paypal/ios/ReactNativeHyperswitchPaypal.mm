#if __has_include(<ReactCodegen/RNHyperswitchPaypalSpec/RNHyperswitchPaypalSpec.h>)
#import <ReactCodegen/RNHyperswitchPaypalSpec/RNHyperswitchPaypalSpec.h>
#else
#import <RNHyperswitchPaypalSpec/RNHyperswitchPaypalSpec.h>
#endif

#if __has_include(<ReactNativeHyperswitchPaypal/ReactNativeHyperswitchPaypal-Swift.h>)
#import <ReactNativeHyperswitchPaypal/ReactNativeHyperswitchPaypal-Swift.h>
#else
#import "ReactNativeHyperswitchPaypal-Swift.h"
#endif

@interface HyperswitchPaypal : NSObject <NativeHyperswitchPaypalSpec>
@end

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

- (void)launchPayPal:(NSString *)requestObj
            callback:(RCTResponseSenderBlock)callback
{
  [self->_impl launchPayPal:requestObj callback:callback];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchPaypalSpecJSI>(params);
}

@end
