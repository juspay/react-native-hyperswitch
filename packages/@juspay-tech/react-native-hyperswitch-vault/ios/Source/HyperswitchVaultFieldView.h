#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/*
 * The native view the merchant's engine places for one card field. It is an empty frame in the
 * merchant's layout; inside it sits a root of the vault's own engine, and that root draws the
 * field. The merchant's engine sets three props and hears one event; it never sees what is typed.
 */
@interface HyperswitchVaultFieldView : RCTViewComponentView
@end

NS_ASSUME_NONNULL_END
