#import "HyperswitchAirborne.h"

@implementation HyperswitchAirborne

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(@(YES));
}

RCT_EXPORT_METHOD(getBundlePath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSString *bundlePath = [[NSBundle mainBundle] pathForResource:@"hyperswitch" ofType:@"bundle"];
    resolve(bundlePath ?: @"");
}

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

@end
