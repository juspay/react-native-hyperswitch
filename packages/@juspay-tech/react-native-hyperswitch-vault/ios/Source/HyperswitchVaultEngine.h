#import <UIKit/UIKit.h>

#import "HyperswitchVaultProtocol.h"

NS_ASSUME_NONNULL_BEGIN

@class HyperswitchVaultHostedModule;

/* One running root of the bundle, and who receives its events. */
@interface HyperswitchVaultSurface : NSObject

/* What the bundle calls rootTag. */
@property (nonatomic, readonly) NSInteger rootTag;

/* The view that draws the root. A form's root has one too, and it is never put on screen. */
@property (nonatomic, readonly) UIView *view;

@property (nonatomic, weak, readonly, nullable) id<HyperswitchVaultEventTarget> owner;

/* New props for the running root. The root keeps its state: an update, not a restart. */
- (void)update:(NSDictionary *)props;

- (void)stop;

@end

/*
 * The vault's own JavaScript engine: a second React host, started the first time a card form opens
 * and kept for the life of the app process. It runs only hyperswitch-vault-fields.bundle. The card
 * number and the CVC exist in THIS engine's memory and in the text inputs it draws; the merchant's
 * engine never holds them.
 *
 * NO CODE FROM OUTSIDE. The bundle is read from the app, in every build type. This engine never
 * loads JavaScript from a development server.
 *
 * Everything here runs on the main thread.
 */
@interface HyperswitchVaultEngine : NSObject

+ (instancetype)shared;

/* Whether this build of the app carries the bundle. */
+ (BOOL)isBundled;

/*
 * Starts a root of the bundle. `owner` receives its events until stop. nil when the engine cannot
 * start in this app: the form then fails before it mounts, and the fields render the plain way.
 */
- (nullable HyperswitchVaultSurface *)start:(NSString *)rootName
                                      props:(NSDictionary *)props
                                      owner:(id<HyperswitchVaultEventTarget>)owner;

/* From the bundle: hand the event to the root's owner. */
- (void)deliver:(NSInteger)rootTag eventName:(NSString *)eventName payload:(NSString *)payloadJson;

/* NO when the bundle cannot be reached: the caller answers the command itself. */
- (BOOL)send:(NSDictionary *)command;

/* The module of this engine that carries commands to the bundle. */
- (void)attach:(HyperswitchVaultHostedModule *)module;

- (void)forget:(HyperswitchVaultSurface *)surface;

@end

NS_ASSUME_NONNULL_END
