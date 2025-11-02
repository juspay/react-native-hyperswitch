#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HyperswitchTrident3ds, NSObject)

RCT_EXTERN_METHOD(initialiseSDK:
                  (NSString *)apiKey:
                  (NSString *)hsSDKEnvironment:
                  (RCTResponseSenderBlock)callback)

RCT_EXTERN_METHOD(generateAReqParams:
                  (NSString *)messageVersion:
                  (NSString *)directoryServerId:
                  (NSString *)cardNetwork:
                  (RCTResponseSenderBlock)callback)

RCT_EXTERN_METHOD(receiveChallengeParamsFromRN:
                  (NSString *)acsSignedContent:
                  (NSString *)acsRefNumber:
                  (NSString *)acsTransactionId:
                  (nullable NSString *)threeDSRequestorAppURL:
                  (NSString *)threeDSServerTransId:
                  (RCTResponseSenderBlock)callback)

RCT_EXTERN_METHOD(generateChallenge: (RCTResponseSenderBlock)callback)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
