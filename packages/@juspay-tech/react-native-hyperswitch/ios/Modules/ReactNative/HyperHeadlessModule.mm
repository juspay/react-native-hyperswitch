//
//  HyperHeadlessModule.mm
//  Hyperswitch
//
//  TurboModule bridge for HyperHeadless
//  Delegates to HyperHeadlessModuleImpl.swift for business logic
//
//  Created by Kuntimaddi Manideep on 02/08/26.
//

#import "HyperHeadlessModule.h"
#import "HyperswitchSdkReactNative-Swift.h"
#import <React/RCTBridge+Private.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <HyperswitchSdkReactNativeSpec/HyperswitchSdkReactNativeSpec.h>
#endif

@interface HyperHeadlessModule () <
#ifdef RCT_NEW_ARCH_ENABLED
    NativeHyperHeadlessSpec
#else
    RCTBridgeModule
#endif
>
@end

@implementation HyperHeadlessModule

RCT_EXPORT_MODULE(HyperHeadless);

/* Exit results arrive as objects. The new architecture hands them over as the
   codegen struct, read field by field as in hyperswitch-client-core's
   HyperHeadlessTurboModule.mm; the bridge hands over a dictionary. Either way the
   Swift impl still takes the JSON string the bundle used to send. */
#ifdef RCT_NEW_ARCH_ENABLED
static NSString *HyperHeadlessExitResultJSON(JS::NativeHyperHeadless::PaymentExitResult &status) {
    NSMutableDictionary *json = [NSMutableDictionary dictionary];
    json[@"status"] = status.status() ?: @"failed";
    if (status.code()) json[@"code"] = status.code();
    if (status.message()) json[@"message"] = status.message();
    if (status.type()) json[@"type"] = status.type();
    NSData *data = [NSJSONSerialization dataWithJSONObject:json options:0 error:nil];
    return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]
                : @"{\"status\":\"failed\",\"message\":\"unknown\"}";
}
#else
static NSString *HyperHeadlessExitResultJSON(NSDictionary *status) {
    if (![status isKindOfClass:[NSDictionary class]] ||
        ![NSJSONSerialization isValidJSONObject:status]) {
        return @"{\"status\":\"failed\",\"message\":\"unknown\"}";
    }
    NSData *data = [NSJSONSerialization dataWithJSONObject:status options:0 error:nil];
    return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]
                : @"{\"status\":\"failed\",\"message\":\"unknown\"}";
}
#endif

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

RCT_EXPORT_METHOD(getPaymentSession:(double)rootTag
                  defaultPaymentMethod:(NSDictionary *)defaultPaymentMethod
                  lastUsedPaymentMethod:(NSDictionary *)lastUsedPaymentMethod
                  allPaymentMethods:(NSArray *)allPaymentMethods
                  callback:(RCTResponseSenderBlock)callback) {
    [HyperHeadlessModuleImpl.shared getPaymentSessionWithRootTag:@(rootTag)
                                           defaultPaymentMethod:defaultPaymentMethod
                                          lastUsedPaymentMethod:lastUsedPaymentMethod
                                             allPaymentMethods:allPaymentMethods
                                                      callback:callback];
}

RCT_EXPORT_METHOD(getWalletSession:(double)rootTag
                  wallets:(NSArray *)wallets
                  callback:(RCTResponseSenderBlock)callback) {
    [HyperHeadlessModuleImpl.shared getWalletSessionWithRootTag:@(rootTag)
                                                        wallets:wallets
                                                       callback:callback];
}

#ifdef RCT_NEW_ARCH_ENABLED
RCT_EXPORT_METHOD(exitHeadless:(double)rootTag
                  status:(JS::NativeHyperHeadless::PaymentExitResult &)status) {
    [HyperHeadlessModuleImpl.shared exitHeadlessWithRootTag:@(rootTag)
                                                      status:HyperHeadlessExitResultJSON(status)];
}
#else
RCT_EXPORT_METHOD(exitHeadless:(double)rootTag
                  status:(NSDictionary *)status) {
    [HyperHeadlessModuleImpl.shared exitHeadlessWithRootTag:@(rootTag)
                                                      status:HyperHeadlessExitResultJSON(status)];
}
#endif

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeHyperHeadlessSpecJSI>(params);
}
#endif

@end
