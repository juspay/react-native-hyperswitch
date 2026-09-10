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

RCT_EXPORT_METHOD(exitHeadless:(double)rootTag
                  status:(NSString *)status) {
    [HyperHeadlessModuleImpl.shared exitHeadlessWithRootTag:@(rootTag)
                                                      status:status];
}

#ifdef RCT_NEW_ARCH_ENABLED
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    return std::make_shared<facebook::react::NativeHyperHeadlessSpecJSI>(params);
}
#endif

@end
