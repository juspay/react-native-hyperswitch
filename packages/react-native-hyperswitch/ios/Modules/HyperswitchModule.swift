//
//  HyperswitchModule.swift
//  Hyperswitch
//
//  Created by Harshit Srivastava on 12/09/25.
//

import Foundation
import React

@objc(HyperswitchModule)
public class HyperswitchModule: NSObject {

  @objc public static let shared: HyperswitchModule = HyperswitchModule()
  var paymentSession: PaymentSession?

  @objc(initialiseWithPublishableKey:customBackendUrl:customLogUrl:customParams:resolve:reject:)
  public func initialise(publishableKey: String,
                         customBackendUrl: String?,
                         customLogUrl: String?,
                         customParams: [String:Any],
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) -> Void {

    self.paymentSession = PaymentSession(publishableKey: publishableKey,
                                         customBackendUrl: customBackendUrl,
                                         customParams: customParams,
                                         customLogUrl: customLogUrl)
    resolve(NSNull())
  }
  @objc(initPaymentSessionWithpaymentIntentClientSecret:resolve:reject:)
  public func initPaymentSession(paymentIntentClientSecret: String,
                                 resolve: @escaping RCTPromiseResolveBlock,
                                 reject: @escaping RCTPromiseRejectBlock) -> Void {

    self.paymentSession?.initPaymentSession(paymentIntentClientSecret: paymentIntentClientSecret)
    resolve(NSNull())
  }

  @objc(presentPaymentSheetWithConfiguration:resolver:rejecter:)
  public func presentPaymentSheet(configuration: [String:Any],
                                  resolve: @escaping RCTPromiseResolveBlock,
                                  reject: @escaping RCTPromiseRejectBlock) -> Void{
    DispatchQueue.main.async {
      guard let vc = RCTPresentedViewController() else {
        reject("error", "Could not find presented view controller", NSError())
        return
      }
      self.paymentSession?.presentPaymentSheetWithParams(viewController: vc, params: configuration, completion: { result in
        switch result {
        case .completed(let data):
          resolve(["status": "completed", "message": data])
        case .failed(let error as NSError):
          resolve(["status": "failed", "code": error.domain, "message": "\(error.userInfo["message"] ?? "Failed")"])
        case .canceled(let data):
          resolve(["status": "cancelled", "message": data])
        }
      })
    }
  }
}
