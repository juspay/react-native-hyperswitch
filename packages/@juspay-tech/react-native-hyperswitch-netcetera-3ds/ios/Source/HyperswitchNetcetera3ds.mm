#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNHyperswitchNetcetera3dsSpec.h"
#endif

#if __has_include(<react_native_hyperswitch_netcetera_3ds/react_native_hyperswitch_netcetera_3ds-Swift.h>)
#import <react_native_hyperswitch_netcetera_3ds/react_native_hyperswitch_netcetera_3ds-Swift.h>
#else
#import "react_native_hyperswitch_netcetera_3ds-Swift.h"
#endif

@interface HyperswitchNetcetera3ds : NSObject <RCTBridgeModule>
@end

#ifdef RCT_NEW_ARCH_ENABLED
@interface HyperswitchNetcetera3ds () <NativeHyperswitchNetcetera3dsSpec>
@end
#endif

@implementation HyperswitchNetcetera3ds {
  HyperswitchNetcetera3dsImpl *_impl;
}

RCT_EXPORT_MODULE()

- (instancetype)init
{
  if (self = [super init]) {
    _impl = [HyperswitchNetcetera3dsImpl new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(initialiseNetceteraSDK:(NSString *)apiKey
                  hsSDKEnvironment:(NSString *)hsSDKEnvironment
                  callback:(RCTResponseSenderBlock)callback)
{
  [self->_impl initialiseNetceteraSDK:apiKey
                     hsSDKEnvironment:hsSDKEnvironment
                             callback:^(NSDictionary<NSString *, id> *status) {
                               callback(@[ status ]);
                             }];
}

RCT_EXPORT_METHOD(generateAReqParams:(NSString *)messageVersion
                  directoryServerId:(NSString *)directoryServerId
                  callback:(RCTResponseSenderBlock)callback)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *presentedViewController = RCTPresentedViewController();
    [self->_impl generateAReqParams:messageVersion
                  directoryServerId:directoryServerId
                               from:presentedViewController
                           callback:^(NSDictionary<NSString *, id> *status,
                                      NSDictionary<NSString *, NSString *> *aReqParams) {
                             callback(aReqParams ? @[ status, aReqParams ] : @[ status ]);
                           }];
  });
}

RCT_EXPORT_METHOD(recieveChallengeParamsFromRN:(NSString *)acsSignedContent
                  acsRefNumber:(NSString *)acsRefNumber
                  acsTransactionId:(NSString *)acsTransactionId
                  threeDSRequestorAppURL:(nullable NSString *)threeDSRequestorAppURL
                  threeDSServerTransId:(NSString *)threeDSServerTransId
                  callback:(RCTResponseSenderBlock)callback)
{
  [self->_impl recieveChallengeParamsFromRN:acsSignedContent
                               acsRefNumber:acsRefNumber
                           acsTransactionId:acsTransactionId
                     threeDSRequestorAppURL:threeDSRequestorAppURL
                       threeDSServerTransId:threeDSServerTransId
                                   callback:^(NSDictionary<NSString *, id> *status) {
                                     callback(@[ status ]);
                                   }];
}

RCT_EXPORT_METHOD(generateChallenge:(RCTResponseSenderBlock)callback)
{
  [self->_impl generateChallenge:^(NSDictionary<NSString *, id> *status) {
    callback(@[ status ]);
  }];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchNetcetera3dsSpecJSI>(params);
}
#endif

@end
