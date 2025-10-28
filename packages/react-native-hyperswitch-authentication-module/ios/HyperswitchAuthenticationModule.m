#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HyperswitchAuthenticationModule, NSObject)

RCT_EXTERN_METHOD(initializeThreeDS:(NSDictionary *)configuration
                                   :(NSString *)hsSDKEnvironment
                                   :(RCTResponseSenderBlock)callback)

RCT_EXTERN_METHOD(generateAReqParams:(NSString *)messageVersion
                                    :(NSString *)directoryServerId
                                    :(NSString *)cardBrand
                                    :(RCTResponseSenderBlock)callback)

RCT_EXTERN_METHOD(recieveChallengeParamsFromRN:(NSString *)acsSignedContent
                                              :(NSString *)acsRefNumber
                                              :(NSString *)acsTransactionId
                                              :(NSString *)threeDSRequestorAppURL
                                              :(NSString *)threeDSServerTransId
                                              :(RCTResponseSenderBlock)callback)

RCT_EXTERN_METHOD(generateChallenge:(RCTResponseSenderBlock)callback)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
