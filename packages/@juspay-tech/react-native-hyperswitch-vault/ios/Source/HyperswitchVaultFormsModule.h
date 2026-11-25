#import <Foundation/Foundation.h>

#import "HyperswitchVaultSpec.h"

NS_ASSUME_NONNULL_BEGIN

/*
 * The module the MERCHANT's engine talks to (src/native in the vault's JavaScript). It opens,
 * updates and closes card forms in the vault's own engine and carries commands to them.
 *
 * What crosses here, in both directions, is JSON text. Going in: the merchant's own settings.
 * Coming out: events and results the hosted bundle has already cut down to its allow-list. This
 * class passes the text on and never logs it.
 */
@interface HyperswitchVaultFormsModule : NativeHyperswitchVaultFormsSpecBase <NativeHyperswitchVaultFormsSpec>
@end

NS_ASSUME_NONNULL_END
