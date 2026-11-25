#import "HyperswitchVaultEngine.h"

#import <React/RCTBundleManager.h>
#import <React/RCTComponentViewFactory.h>
#import <React/RCTConvert.h>
#import <React/RCTSurfaceHostingProxyRootView.h>
#import <React/RCTSurfaceProtocol.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import <React-RCTAppDelegate/RCTReactNativeFactory.h>
#import <React-RCTAppDelegate/RCTRootViewFactory.h>

#import "HyperswitchVaultHostedModule.h"

#pragma mark - Surface

@interface HyperswitchVaultSurface ()
@property (nonatomic, weak) HyperswitchVaultEngine *engine;
@property (nonatomic, strong) UIView *rootView;
@property (nonatomic, strong, nullable) id<RCTSurfaceProtocol> surface;
@property (nonatomic, weak, readwrite, nullable) id<HyperswitchVaultEventTarget> owner;
@end

@implementation HyperswitchVaultSurface

- (NSInteger)rootTag
{
  return _surface != nil ? _surface.rootTag : -1;
}

- (UIView *)view
{
  return _rootView;
}

- (void)update:(NSDictionary *)props
{
  _surface.properties = props;
}

- (void)stop
{
  [_engine forget:self];
  _owner = nil;
  [_surface stop];
  [_rootView removeFromSuperview];
}

@end

#pragma mark - The second host's delegate

/*
 * What makes the second host the vault's: where its bundle is, and the one module that exists for
 * the bundle to talk to. Every other native module and view it can reach is what the app links.
 */
@interface HyperswitchVaultEngineDelegate : RCTDefaultReactNativeFactoryDelegate
@property (nonatomic, weak) HyperswitchVaultEngine *engine;
@end

@implementation HyperswitchVaultEngineDelegate

+ (NSURL *)bundleFile
{
  return [[NSBundle bundleForClass:HyperswitchVaultEngine.class] URLForResource:HyperswitchVaultBundleName
                                                                  withExtension:HyperswitchVaultBundleExtension];
}

/* The bundle inside the app, in every build type: never a development server. */
- (NSURL *)bundleURL
{
  return [HyperswitchVaultEngineDelegate bundleFile];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

/* The hosted module of THIS host is made here, so the engine knows which instance carries its commands. */
- (id<RCTTurboModule>)getModuleInstanceFromClass:(Class)moduleClass
{
  if (moduleClass == HyperswitchVaultHostedModule.class) {
    HyperswitchVaultHostedModule *module = [HyperswitchVaultHostedModule new];
    [_engine attach:module];
    return (id<RCTTurboModule>)module;
  }
  return nil;
}

@end

#pragma mark - Engine

/*
 * The release level the app's own React Native factory uses. React Native allows one per process:
 * a second factory created with another level raises. Expo apps record theirs in Info.plist
 * (expo-build-properties `ios.reactNativeReleaseLevel`); without that key it is Stable, React
 * Native's default.
 */
static RCTReleaseLevel AppReleaseLevel(void)
{
  id value = [NSBundle.mainBundle objectForInfoDictionaryKey:@"ReactNativeReleaseLevel"];
  if ([value isKindOfClass:NSString.class]) {
    NSString *level = [(NSString *)value lowercaseString];
    if ([level isEqualToString:@"experimental"]) {
      return Experimental;
    }
    if ([level isEqualToString:@"canary"]) {
      return Canary;
    }
  }
  return Stable;
}

@implementation HyperswitchVaultEngine {
  HyperswitchVaultEngineDelegate *_delegate;
  RCTReactNativeFactory *_factory;
  /* Set once, if the factory could not be made. Never retried in this process. */
  BOOL _unavailable;
  __weak HyperswitchVaultHostedModule *_module;

  /*
   * The running roots. An event from the bundle names its root by root tag, and the owner is found
   * by asking each root for its tag when the event arrives.
   */
  NSMutableArray<HyperswitchVaultSurface *> *_running;
}

+ (instancetype)shared
{
  static HyperswitchVaultEngine *engine;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    engine = [HyperswitchVaultEngine new];
  });
  return engine;
}

+ (BOOL)isBundled
{
  return [HyperswitchVaultEngineDelegate bundleFile] != nil;
}

- (instancetype)init
{
  if (self = [super init]) {
    _running = [NSMutableArray new];
    _delegate = [HyperswitchVaultEngineDelegate new];
    _delegate.engine = self;
    _delegate.dependencyProvider = [RCTAppDependencyProvider new];
  }
  return self;
}

/*
 * The second host, made the first time a root is asked for, or nil when it cannot be made here.
 *
 * RCTReactNativeFactory assumes it is the app's only factory. Creating it
 *   - raises if the app's own factory chose another release level (one per process);
 *   - makes itself the process-wide provider of third-party Fabric components;
 *   - sets the process-wide default colour space.
 * So it is created with the app's release level, the provider and the colour space are put back
 * right after, and any failure (an Objective-C or a C++ exception) is caught, remembered and never
 * retried: React Native's set-up may be half done after one. The forms then use the plain fields.
 */
- (nullable RCTReactNativeFactory *)factory
{
  if (_factory != nil || _unavailable) {
    return _factory;
  }
  RCTComponentViewFactory *components = [RCTComponentViewFactory currentComponentViewFactory];
  id<RCTComponentViewFactoryComponentProvider> provider = components.thirdPartyFabricComponentsProvider;
  RCTColorSpace colorSpace = RCTGetDefaultColorSpace();
  RCTReactNativeFactory *factory = nil;
  @try {
    try {
      factory = [[RCTReactNativeFactory alloc] initWithDelegate:_delegate releaseLevel:AppReleaseLevel()];
    } catch (...) {
      factory = nil;
    }
  } @catch (NSException *exception) {
    factory = nil;
  }
  components.thirdPartyFabricComponentsProvider = provider;
  RCTSetDefaultColorSpace(colorSpace);
  _factory = factory;
  _unavailable = factory == nil;
  return _factory;
}

- (nullable HyperswitchVaultSurface *)start:(NSString *)rootName
                                      props:(NSDictionary *)props
                                      owner:(id<HyperswitchVaultEventTarget>)owner
{
  RCTReactNativeFactory *factory = [self factory];
  if (factory == nil) {
    return nil;
  }
  UIView *rootView = [factory.rootViewFactory viewWithModuleName:rootName initialProperties:props];
  rootView.backgroundColor = UIColor.clearColor;

  HyperswitchVaultSurface *surface = [HyperswitchVaultSurface new];
  surface.engine = self;
  surface.rootView = rootView;
  surface.owner = owner;
  if ([rootView isKindOfClass:RCTSurfaceHostingProxyRootView.class]) {
    RCTSurfaceHostingProxyRootView *hosting = (RCTSurfaceHostingProxyRootView *)rootView;
    /* As wide as the view it is put in, as tall as its own content. */
    hosting.sizeFlexibility = RCTRootViewSizeFlexibilityHeight;
    surface.surface = hosting.surface;
  }
  [_running addObject:surface];
  return surface;
}

- (void)forget:(HyperswitchVaultSurface *)surface
{
  [_running removeObject:surface];
}

- (void)deliver:(NSInteger)rootTag eventName:(NSString *)eventName payload:(NSString *)payloadJson
{
  dispatch_block_t work = ^{
    for (HyperswitchVaultSurface *surface in [self->_running copy]) {
      if (surface.rootTag == rootTag) {
        [surface.owner vaultEvent:eventName payload:payloadJson];
        return;
      }
    }
  };
  if (NSThread.isMainThread) {
    work();
  } else {
    dispatch_async(dispatch_get_main_queue(), work);
  }
}

- (void)attach:(HyperswitchVaultHostedModule *)module
{
  _module = module;
}

- (BOOL)send:(NSDictionary *)command
{
  HyperswitchVaultHostedModule *module = _module;
  if (module == nil) {
    return NO;
  }
  return [module sendCommand:command];
}

@end
