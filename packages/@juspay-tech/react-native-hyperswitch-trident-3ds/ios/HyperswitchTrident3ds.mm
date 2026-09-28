#import <React/RCTUtils.h>

// The ReactCodegen pod keeps each spec in its own folder, so the quoted flat
// import only resolves through Xcode's header map and fails with use_frameworks!.
#if __has_include(<ReactCodegen/RNHyperswitchTrident3dsSpec/RNHyperswitchTrident3dsSpec.h>)
#import <ReactCodegen/RNHyperswitchTrident3dsSpec/RNHyperswitchTrident3dsSpec.h>
#else
#import <RNHyperswitchTrident3dsSpec/RNHyperswitchTrident3dsSpec.h>
#endif

#if __has_include(<HyperswitchTrident3ds/HyperswitchTrident3ds-Swift.h>)
#import <HyperswitchTrident3ds/HyperswitchTrident3ds-Swift.h>
#else
#import "HyperswitchTrident3ds-Swift.h"
#endif

@interface HyperswitchTrident3ds : NSObject <NativeHyperswitchTrident3dsSpec>
@end

@implementation HyperswitchTrident3ds {
  HyperswitchTrident3dsImpl *_impl;
}

RCT_EXPORT_MODULE()

- (instancetype)init
{
  if (self = [super init]) {
    _impl = [HyperswitchTrident3dsImpl new];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)initialiseSDK:(NSString *)apiKey
     hsSDKEnvironment:(NSString *)hsSDKEnvironment
             callback:(RCTResponseSenderBlock)callback
{
  [self->_impl initialiseSDK:apiKey hsSDKEnvironment:hsSDKEnvironment callback:callback];
}

- (void)generateAReqParams:(NSString *)messageVersion
         directoryServerId:(NSString *)directoryServerId
               cardNetwork:(NSString *)cardNetwork
                  callback:(RCTResponseSenderBlock)callback
{
  [self->_impl generateAReqParams:messageVersion
                directoryServerId:directoryServerId
                      cardNetwork:cardNetwork
                         callback:callback];
}

- (void)receiveChallengeParamsFromRN:(NSString *)acsSignedContent
                        acsRefNumber:(NSString *)acsRefNumber
                    acsTransactionId:(NSString *)acsTransactionId
              threeDSRequestorAppURL:(nullable NSString *)threeDSRequestorAppURL
                threeDSServerTransId:(NSString *)threeDSServerTransId
                            callback:(RCTResponseSenderBlock)callback
{
  [self->_impl receiveChallengeParamsFromRN:acsSignedContent
                               acsRefNumber:acsRefNumber
                           acsTransactionId:acsTransactionId
                     threeDSRequestorAppURL:threeDSRequestorAppURL
                       threeDSServerTransId:threeDSServerTransId
                                   callback:callback];
}

- (void)generateChallenge:(RCTResponseSenderBlock)callback
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self->_impl generateChallengeFrom:RCTPresentedViewController() callback:callback];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchTrident3dsSpecJSI>(params);
}

@end
