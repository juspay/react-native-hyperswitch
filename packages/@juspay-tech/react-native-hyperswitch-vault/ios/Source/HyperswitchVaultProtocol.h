/*
 * The names this native code shares with the vault's hosted bundle (src/hosted/protocol.mjs) and
 * with the vault's JavaScript in the merchant's engine (src/native). All three hold a copy;
 * the version is how they notice they have drifted. Nothing else in this folder spells these names.
 */
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

static const NSInteger HyperswitchVaultProtocolVersion = 1;

/* The bundle the vault's own engine runs: hyperswitch-vault-fields.bundle. */
static NSString *const HyperswitchVaultBundleName = @"hyperswitch-vault-fields";
static NSString *const HyperswitchVaultBundleExtension = @"bundle";

/* The roots the bundle registers. */
static NSString *const HyperswitchVaultFormRoot = @"HyperswitchVaultForm";
static NSString *const HyperswitchVaultFieldRoot = @"HyperswitchVaultField";

static NSString *const HyperswitchVaultFormMounted = @"VAULT_FORM_MOUNTED";
static NSString *const HyperswitchVaultFormError = @"VAULT_FORM_ERROR";
static NSString *const HyperswitchVaultCommandResult = @"VAULT_COMMAND_RESULT";

/* Receives the events of one React root in the vault's engine. Called on the main thread. */
@protocol HyperswitchVaultEventTarget <NSObject>
- (void)vaultEvent:(NSString *)name payload:(NSString *)payloadJson;
@end

NS_ASSUME_NONNULL_END
