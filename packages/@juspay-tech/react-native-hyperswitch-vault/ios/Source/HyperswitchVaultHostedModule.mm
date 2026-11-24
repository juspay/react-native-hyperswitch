#import "HyperswitchVaultHostedModule.h"

#import "HyperswitchVaultEngine.h"

@implementation HyperswitchVaultHostedModule

RCT_EXPORT_MODULE(HyperswitchVaultHosted)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

/* Events are handed to their owners on the main thread, so they arrive in the order they were sent. */
- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (BOOL)sendCommand:(NSDictionary *)command
{
  if (!_eventEmitterCallback) {
    return NO;
  }
  [self emitOnCommand:command];
  return YES;
}

#pragma mark - NativeHyperswitchVaultHostedSpec

- (void)emitFieldEvent:(NSInteger)rootTag eventName:(NSString *)eventName payload:(NSString *)payload
{
  [HyperswitchVaultEngine.shared deliver:rootTag eventName:eventName payload:payload ?: @"{}"];
}

- (void)emitFormEvent:(NSInteger)rootTag eventName:(NSString *)eventName payload:(NSString *)payload
{
  [HyperswitchVaultEngine.shared deliver:rootTag eventName:eventName payload:payload ?: @"{}"];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeHyperswitchVaultHostedSpecJSI>(params);
}

@end
