#import "HyperswitchVaultEngine.h"

#import <React/RCTBundleManager.h>
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

@implementation HyperswitchVaultEngine {
  HyperswitchVaultEngineDelegate *_delegate;
  RCTReactNativeFactory *_factory;
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

/* The second host, made the first time a root is asked for. */
- (RCTReactNativeFactory *)factory
{
  if (_factory == nil) {
    _factory = [[RCTReactNativeFactory alloc] initWithDelegate:_delegate];
  }
  return _factory;
}

- (HyperswitchVaultSurface *)start:(NSString *)rootName
                             props:(NSDictionary *)props
                             owner:(id<HyperswitchVaultEventTarget>)owner
{
  UIView *rootView = [[self factory].rootViewFactory viewWithModuleName:rootName initialProperties:props];
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
