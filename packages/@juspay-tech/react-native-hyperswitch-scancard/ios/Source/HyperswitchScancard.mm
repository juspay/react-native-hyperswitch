#import <React/RCTUtils.h>

#if __has_include(<ReactCodegen/RNHyperswitchScancardSpec/RNHyperswitchScancardSpec.h>)
#import <ReactCodegen/RNHyperswitchScancardSpec/RNHyperswitchScancardSpec.h>
#else
#import <RNHyperswitchScancardSpec/RNHyperswitchScancardSpec.h>
#endif

#if __has_include(<react_native_hyperswitch_scancard/react_native_hyperswitch_scancard-Swift.h>)
#import <react_native_hyperswitch_scancard/react_native_hyperswitch_scancard-Swift.h>
#else
#import "react_native_hyperswitch_scancard-Swift.h"
#endif

@interface HyperswitchScancard : NSObject <NativeHyperswitchScancardSpec>
@end

@implementation HyperswitchScancard {
  HyperswitchScancardImpl *_impl;
}

RCT_EXPORT_MODULE()

- (instancetype)init
{
  if (self = [super init]) {
    _impl = [HyperswitchScancardImpl new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)launchScanCard:(NSString *)scanCardRequest
              callback:(RCTResponseSenderBlock)callback
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *presentedViewController = RCTPresentedViewController();
    if (presentedViewController == nil) {
      callback(@[ @{@"status" : @"Failed"} ]);
      return;
    }
    [self->_impl launchScanCardFrom:presentedViewController
                           callback:^(NSDictionary<NSString *, id> *response) {
                             callback(@[ response ]);
                           }];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchScancardSpecJSI>(params);
}

@end
