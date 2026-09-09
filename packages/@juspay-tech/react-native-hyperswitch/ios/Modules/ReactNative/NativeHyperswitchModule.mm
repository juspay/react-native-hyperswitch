#import "NativeHyperswitchModule.h"
#import <React/RCTComponent.h>
#import <memory>
#if __has_include("HyperswitchSdkReactNative-Swift.h")
#import "HyperswitchSdkReactNative-Swift.h"
#else
// When using use_frameworks! :linkage => :static in Podfile
#import <HyperswitchSdkReactNative/HyperswitchSdkReactNative-Swift.h>
#endif

/**
 * ObjC/TurboModule bridge for NativeHyperswitchModule.
 *
 * All business logic lives in NativeHyperswitchModuleImpl.swift (Swift singleton).
 * This file is responsible only for:
 *   1. Registering the module under the exact name "NativeHyperswitchModule"
 *      (must match TurboModuleRegistry.get('NativeHyperswitchModule') in TS)
 *   2. Forwarding every RCT_EXPORT_METHOD call to the Swift impl
 *   3. Wiring up the TurboModule JSI spec for New Architecture
 */
@implementation NativeHyperswitchModule

@synthesize viewRegistry_DEPRECATED = _viewRegistry_DEPRECATED;

// RCT_EXPORT_MODULE() without arguments uses the ObjC class name as the module
// name, which is "NativeHyperswitchModule" — exactly what the JS spec expects.
RCT_EXPORT_MODULE()

// ---------------------------------------------------------------------------
// initialise
// JS: initialise(publishableKey, platformPublishableKey, profileId, environment, customEndpoints)
// Android: initialise(String publishableKey, String platformPublishableKey,
//                     String profileId, String environment, ReadableMap customEndpoints, Promise)
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(initialise:(nonnull NSString *)publishableKey
                  platformPublishableKey:(nonnull NSString *)platformPublishableKey
                  profileId:(nonnull NSString *)profileId
                  environment:(nonnull NSString *)environment
                  customEndpoints:(nonnull NSDictionary *)customEndpoints
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] initialiseWithPublishableKey:publishableKey
                              platformPublishableKey:platformPublishableKey
                                           profileId:profileId
                                        environment:environment
                                    customEndpoints:customEndpoints
                                            resolve:resolve
                                             reject:reject];
}

// ---------------------------------------------------------------------------
// presentPaymentSheet
// JS: presentPaymentSheet(params: { hyperswitchConfig, paymentSessionConfig, configuration })
// Android: presentPaymentSheet(ReadableMap params, Promise)
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(presentPaymentSheet:(nonnull NSDictionary *)params
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] presentPaymentSheet:params
                                   resolve:resolve
                                    reject:reject];
}

// ---------------------------------------------------------------------------
// getCustomerSavedPaymentMethods
// JS: getCustomerSavedPaymentMethods(params?: Object)
// iOS codegen: getCustomerSavedPaymentMethods(NSDictionary *params, Promise)
// Android: getCustomerSavedPaymentMethods(@Nullable ReadableMap params, Promise)
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(getCustomerSavedPaymentMethods:(nonnull NSDictionary *)params
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] getCustomerSavedPaymentMethods:params
                                              resolve:resolve
                                               reject:reject];
}

// ---------------------------------------------------------------------------
// getCustomerLastUsedPaymentMethodData
// JS / Android: getCustomerLastUsedPaymentMethodData(): Promise<string>
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(getCustomerLastUsedPaymentMethodData:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] getCustomerLastUsedPaymentMethodDataWithResolve:resolve
                                                                reject:reject];
}

// ---------------------------------------------------------------------------
// getCustomerDefaultSavedPaymentMethodData
// JS / Android: getCustomerDefaultSavedPaymentMethodData(): Promise<string>
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(getCustomerDefaultSavedPaymentMethodData:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] getCustomerDefaultSavedPaymentMethodDataWithResolve:resolve
                                                                     reject:reject];
}

// ---------------------------------------------------------------------------
// getCustomerSavedPaymentMethodData  ← NEW — not present in previous iOS module
// JS / Android: getCustomerSavedPaymentMethodData(): Promise<string>
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(getCustomerSavedPaymentMethodData:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] getCustomerSavedPaymentMethodDataWithResolve:resolve
                                                              reject:reject];
}

// ---------------------------------------------------------------------------
// confirmWithCustomerLastUsedPaymentMethod
// JS / Android: confirmWithCustomerLastUsedPaymentMethod(reactTag: number): Promise<string>
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(confirmWithCustomerLastUsedPaymentMethod:(double)reactTag
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] confirmWithCustomerLastUsedPaymentMethod:reactTag
                                                        resolve:resolve
                                                         reject:reject];
}

// ---------------------------------------------------------------------------
// confirmWithCustomerDefaultPaymentMethod
// JS / Android: confirmWithCustomerDefaultPaymentMethod(reactTag: number): Promise<string>
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(confirmWithCustomerDefaultPaymentMethod:(double)reactTag
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] confirmWithCustomerDefaultPaymentMethod:reactTag
                                                       resolve:resolve
                                                        reject:reject];
}

// ---------------------------------------------------------------------------
// confirmWithCustomerPaymentToken
// JS / Android: confirmWithCustomerPaymentToken(reactTag: number, token: string): Promise<string>
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(confirmWithCustomerPaymentToken:(double)reactTag
                  token:(nonnull NSString *)token
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] confirmWithCustomerPaymentToken:reactTag
                                                 token:token
                                               resolve:resolve
                                                reject:reject];
}

// ---------------------------------------------------------------------------
// checkGooglePayReadiness
// Google Pay is not available on iOS; always resolves false.
// JS / Android: checkGooglePayReadiness(isReadyToPayRequestJson: string): Promise<boolean>
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(checkGooglePayReadiness:(nonnull NSString *)isReadyToPayRequestJson
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    resolve(@(NO));
}

// ---------------------------------------------------------------------------
// checkApplePayReadiness
// JS / Android: checkApplePayReadiness(supportedNetworksJson: string): Promise<boolean>
// ---------------------------------------------------------------------------
RCT_EXPORT_METHOD(checkApplePayReadiness:(nonnull NSString *)supportedNetworksJson
                  resolve:(nonnull RCTPromiseResolveBlock)resolve
                  reject:(nonnull RCTPromiseRejectBlock)reject)
{
    [[self moduleImpl] checkApplePayReadiness:supportedNetworksJson
                                       resolve:resolve
                                        reject:reject];
}

// ---------------------------------------------------------------------------
// TurboModule (New Architecture) — JSI spec wiring
// The generated spec class name follows codegen convention:
//   NativeHyperswitchModuleSpec  →  NativeHyperswitchModuleSpecJSI
// ---------------------------------------------------------------------------
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeHyperswitchModuleSpecJSI>(params);
}

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

- (NativeHyperswitchModuleImpl *)moduleImpl
{
    return NativeHyperswitchModuleImpl.shared;
}

@end
