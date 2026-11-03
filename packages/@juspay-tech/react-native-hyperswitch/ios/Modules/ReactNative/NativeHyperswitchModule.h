#import <HyperswitchSdkReactNativeSpec/HyperswitchSdkReactNativeSpec.h>

/**
 * iOS TurboModule / legacy bridge implementation for the NativeHyperswitchModule spec.
 *
 * Matches the Android ReactNativeHyperswitchModule API exactly:
 *   • initialise(publishableKey, platformPublishableKey, profileId, environment, customEndpoints)
 *   • presentPaymentSheet(params)
 *   • getCustomerSavedPaymentMethods(params?)
 *   • getCustomerLastUsedPaymentMethodData()
 *   • getCustomerDefaultSavedPaymentMethodData()
 *   • getCustomerSavedPaymentMethodData()          ← new
 *   • confirmWithCustomerLastUsedPaymentMethod()   ← no cvcWidgetReactTag
 *   • confirmWithCustomerDefaultPaymentMethod()    ← no cvcWidgetReactTag
 */
@interface NativeHyperswitchModule : NativeHyperswitchModuleSpecBase <NativeHyperswitchModuleSpec>

@end
