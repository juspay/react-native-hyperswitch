#import <Foundation/Foundation.h>

#import "HyperswitchVaultSpec.h"

NS_ASSUME_NONNULL_BEGIN

/*
 * The module the hosted bundle talks to (src/hosted/bridge.mjs). The instance that matters lives in
 * the vault's own engine. Events come out of the bundle through it, already cut down to the
 * allow-list by the bundle and written as JSON text; commands go in.
 *
 * It passes the text on untouched and never logs it.
 */
@interface HyperswitchVaultHostedModule : NativeHyperswitchVaultHostedSpecBase <NativeHyperswitchVaultHostedSpec>

/* NO when the bundle is not listening yet. */
- (BOOL)sendCommand:(NSDictionary *)command;

@end

NS_ASSUME_NONNULL_END
