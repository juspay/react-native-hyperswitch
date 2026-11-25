/*
 * What an app links when the vault's own engine is not built into it: React Native older than the
 * bundle is built for, or the app chose to build without the native fields (the podspec decides).
 *
 * React Native's generated code names these three classes for every app on the new architecture,
 * and a missing view class would crash the app at start. So they exist here, and do nothing: the
 * module reports that there is no bundle, the vault's JavaScript reads that and renders the card
 * fields in plain JavaScript, as it did before there was a native path.
 */
#import <React/RCTUtils.h>
#import <React/RCTVersion.h>
#import <React/RCTViewComponentView.h>

#if __has_include(<ReactCodegen/HyperswitchVaultSpec/HyperswitchVaultSpec.h>)
#import <ReactCodegen/HyperswitchVaultSpec/HyperswitchVaultSpec.h>
#elif __has_include(<HyperswitchVaultSpec/HyperswitchVaultSpec.h>)
#import <HyperswitchVaultSpec/HyperswitchVaultSpec.h>
#else
#import "HyperswitchVaultSpec/HyperswitchVaultSpec.h"
#endif

#import <react/renderer/components/HyperswitchVaultSpec/ComponentDescriptors.h>
#import <react/renderer/components/HyperswitchVaultSpec/Props.h>

using namespace facebook::react;

#pragma mark - The forms module: present, and says there is no engine

@interface HyperswitchVaultFormsModule : NativeHyperswitchVaultFormsSpecBase <NativeHyperswitchVaultFormsSpec>
@end

@implementation HyperswitchVaultFormsModule

RCT_EXPORT_MODULE(HyperswitchVaultForms)

- (ModuleConstants<JS::NativeHyperswitchVaultForms::Constants::Builder>)constantsToExport
{
  return [self getConstants];
}

- (ModuleConstants<JS::NativeHyperswitchVaultForms::Constants::Builder>)getConstants
{
  NSNumber *minor = RCTGetReactNativeVersion()[@"minor"];
  return typedConstants<JS::NativeHyperswitchVaultForms::Constants::Builder>({
      .newArchitecture = RCTIsNewArchEnabled(),
      .reactNativeMinor = [minor isKindOfClass:NSNumber.class] ? minor.doubleValue : 0,
      .protocolVersion = 1,
      /* No bundle in this build: the JavaScript takes the plain path on this alone. */
      .bundled = NO,
  });
}

- (void)openForm:(NSString *)formId settings:(NSString *)settings
{
}

- (void)updateForm:(NSString *)formId settings:(NSString *)settings
{
}

- (void)closeForm:(NSString *)formId
{
}

- (void)sendCommand:(NSString *)formId
               name:(NSString *)name
        elementType:(NSString *)elementType
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  resolve(@"{\"ok\":false,\"message\":\"This build of the app has no card-form engine.\"}");
}

- (std::shared_ptr<TurboModule>)getTurboModule:(const ObjCTurboModule::InitParams &)params
{
  return std::make_shared<NativeHyperswitchVaultFormsSpecJSI>(params);
}

@end

#pragma mark - The hosted module: nothing hosts a bundle here

@interface HyperswitchVaultHostedModule : NativeHyperswitchVaultHostedSpecBase <NativeHyperswitchVaultHostedSpec>
@end

@implementation HyperswitchVaultHostedModule

RCT_EXPORT_MODULE(HyperswitchVaultHosted)

- (void)emitFieldEvent:(NSInteger)rootTag eventName:(NSString *)eventName payload:(NSString *)payload
{
}

- (void)emitFormEvent:(NSInteger)rootTag eventName:(NSString *)eventName payload:(NSString *)payload
{
}

- (std::shared_ptr<TurboModule>)getTurboModule:(const ObjCTurboModule::InitParams &)params
{
  return std::make_shared<NativeHyperswitchVaultHostedSpecJSI>(params);
}

@end

#pragma mark - The field view: an empty view that is never rendered

@interface HyperswitchVaultFieldView : RCTViewComponentView
@end

@implementation HyperswitchVaultFieldView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<HyperswitchVaultFieldViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const HyperswitchVaultFieldViewProps>();
    _props = defaultProps;
  }
  return self;
}

@end
