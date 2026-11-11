//
//  NativePaymentWidget.m
//  Hyperswitch
//
//  Created by Harshit Srivastava on 05/03/26.
//

#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>
#import <React/RCTLog.h>

@interface RCT_EXTERN_MODULE(NativePaymentWidget, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(widgetType, NSString)
RCT_EXPORT_VIEW_PROPERTY(options, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(sdkAuthorization, NSString)
RCT_EXPORT_VIEW_PROPERTY(onPaymentEvent, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPaymentResult, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMessageAction, RCTDirectEventBlock)

RCT_EXTERN_METHOD(showWidget:(nonnull NSNumber *)reactTag)
RCT_EXTERN_METHOD(removeWidget:(nonnull NSNumber *)reactTag)
RCT_EXTERN_METHOD(confirmPayment:(nonnull NSNumber *)reactTag :(RCTResponseSenderBlock)responseCallback)
RCT_EXTERN_METHOD(updateIntentInitForWidget:(nonnull NSNumber *)rootTag :(RCTResponseSenderBlock)responseCallback)
RCT_EXTERN_METHOD(updateIntentCompleteForWidget:(nonnull NSNumber *)rootTag :(NSString)sdkAuthorization :(RCTResponseSenderBlock)responseCallback)
RCT_EXTERN_METHOD(confirmPaymentCVC:(nonnull NSNumber *)reactTag :(NSString)paymentToken :(NSString)paymentMethodId :(RCTResponseSenderBlock)rnCallback)
@end
