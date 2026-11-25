#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^HyperswitchVaultEmit)(NSString *name, NSString *payloadJson);
typedef void (^HyperswitchVaultReply)(NSString *resultJson);

/*
 * One card form, as native code sees it: a hidden root in the vault's engine that owns the form,
 * and the commands on their way to it. Everything here runs on the main thread.
 *
 * EVERY COMMAND IS ANSWERED EXACTLY ONCE. A command's reply is a promise in the merchant's engine
 * (await tokenize()), so each way a command can end replies: the bundle's answer, a form that never
 * started, a form that was closed, an unreachable bundle, and silence for too long. Removing the
 * command from `pending` is the one gate: whoever removes it replies, and nobody can remove it twice.
 *
 * Payloads are JSON text made by the bundle's allow-list. This class reads `commandId` and
 * `message` out of them and nothing else, and never logs one.
 */
@interface HyperswitchVaultForm : NSObject

@property (nonatomic, copy, readonly) NSString *formId;

- (instancetype)initWithFormId:(NSString *)formId emit:(HyperswitchVaultEmit)emit;

- (void)open:(NSString *)settings;

/* A prop update for the running root: the form applies it and keeps the card. */
- (void)update:(NSString *)settings;

- (void)command:(NSString *)name elementType:(NSString *)elementType reply:(HyperswitchVaultReply)reply;

- (void)close;

/* A command that did not run: the same shape the bundle uses for one. */
+ (NSString *)refusal:(NSString *)message;

@end

/* The open forms, by formId. Main thread only. */
@interface HyperswitchVaultForms : NSObject

+ (void)open:(NSString *)formId settings:(NSString *)settings emit:(HyperswitchVaultEmit)emit;
+ (nullable HyperswitchVaultForm *)get:(NSString *)formId;
+ (void)close:(NSString *)formId;

@end

NS_ASSUME_NONNULL_END
