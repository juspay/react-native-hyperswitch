#import <React/RCTUtils.h>

#if __has_include(<ReactCodegen/RNHyperswitchNetcetera3dsSpec/RNHyperswitchNetcetera3dsSpec.h>)
#import <ReactCodegen/RNHyperswitchNetcetera3dsSpec/RNHyperswitchNetcetera3dsSpec.h>
#else
#import <RNHyperswitchNetcetera3dsSpec/RNHyperswitchNetcetera3dsSpec.h>
#endif

#if __has_include(<react_native_hyperswitch_netcetera_3ds/react_native_hyperswitch_netcetera_3ds-Swift.h>)
#import <react_native_hyperswitch_netcetera_3ds/react_native_hyperswitch_netcetera_3ds-Swift.h>
#else
#import "react_native_hyperswitch_netcetera_3ds-Swift.h"
#endif

@interface HyperswitchNetcetera3ds : NSObject <NativeHyperswitchNetcetera3dsSpec>
@end

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

- (void)initialiseNetceteraSDK:(NSString *)apiKey
              hsSDKEnvironment:(NSString *)hsSDKEnvironment
                      callback:(RCTResponseSenderBlock)callback
{
  [self->_impl initialiseNetceteraSDK:apiKey
                     hsSDKEnvironment:hsSDKEnvironment
                             callback:^(NSDictionary<NSString *, id> *status) {
                               callback(@[ status ]);
                             }];
}

- (void)generateAReqParams:(NSString *)messageVersion
         directoryServerId:(NSString *)directoryServerId
                  callback:(RCTResponseSenderBlock)callback
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

- (void)recieveChallengeParamsFromRN:(NSString *)acsSignedContent
                        acsRefNumber:(NSString *)acsRefNumber
                    acsTransactionId:(NSString *)acsTransactionId
              threeDSRequestorAppURL:(nullable NSString *)threeDSRequestorAppURL
                threeDSServerTransId:(NSString *)threeDSServerTransId
                            callback:(RCTResponseSenderBlock)callback
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

- (void)generateChallenge:(RCTResponseSenderBlock)callback
{
  [self->_impl generateChallenge:^(NSDictionary<NSString *, id> *status) {
    callback(@[ status ]);
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchNetcetera3dsSpecJSI>(params);
}

@end
