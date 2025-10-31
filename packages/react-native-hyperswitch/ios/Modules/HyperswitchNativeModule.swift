//
//  HyperswitchNativeModule.swift
//  Hyperswitch
//
//  Created by Harshit Srivastava on 12/09/25.
//

import Foundation
import React

@objc(HyperswitchNativeModule)
public class HyperswitchNativeModule: NSObject {

    @objc public static let shared: HyperswitchNativeModule = HyperswitchNativeModule()
    private let applePayPaymentHandler = ApplePayHandler()
    private var presentCallback: RCTResponseSenderBlock? = nil


    @objc
    public func sendMessageToNative(_ rnMessage: String) {}

    @objc(launchApplePayWithRnMessage:rnCallback:)
    public func launchApplePay (_ rnMessage: String, _ rnCallback: @escaping RCTResponseSenderBlock) {
        applePayPaymentHandler.startPayment(rnMessage: rnMessage, rnCallback: rnCallback, presentCallback: self.presentCallback)
    }

    @objc(startApplePayWithRnMessage:rnCallback:)
    public func startApplePay (_ rnMessage: String, _ rnCallback: @escaping RCTResponseSenderBlock) {
        rnCallback([])
    }

    @objc(presentApplePayWithRnMessage:rnCallback:)
    public func presentApplePay (_ rnMessage: String, _ rnCallback: @escaping RCTResponseSenderBlock) {
        self.presentCallback = rnCallback
    }

    @objc(exitPaymentsheetWithRootTag:result:reset:)
    public func exitPaymentsheet(_ reactTag: Double, _ rnMessage: String, _ reset: Bool) {
        exitSheet(rnMessage)
    }

    //  @objc
    //  private func exitWidgetPaymentsheet(_ reactTag: NSNumber, _ rnMessage: String, _ reset: Bool) {
    //    exitSheet(rnMessage)
    //  }
    //
    //  @objc
    //  private func exitPaymentMethodManagement(_ reactTag: NSNumber, _ rnMessage: String, _ reset: Bool) {
    //    exitSheet(rnMessage)
    //  }

    //  @objc
    //  private func exitCardForm(_ rnMessage: String) {
    //    var response: String?
    //    var error: NSError?
    //
    //    if let data = rnMessage.data(using: .utf8) {
    //      do {
    //        if let jsonDictionary = try JSONSerialization.jsonObject(with: data, options: []) as? [String: String] {
    //          let status = jsonDictionary["status"]
    //
    //          if (status == "failed" || status == "requires_payment_method") {
    //            error = NSError(domain: (jsonDictionary["code"] ?? "") != "" ? jsonDictionary["code"]! : "UNKNOWN_ERROR", code: 0, userInfo: ["message" : jsonDictionary["message"] ?? "An error has occurred."])
    //          } else {
    //            response = status
    //          }
    //          RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(response: response, error: error)
    //        } else {
    //          RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(response: "failed", error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message" : "An error has occurred."]))
    //        }
    //      } catch {
    //        RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(response: "failed", error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message" : "An error has occurred."]))
    //      }
    //    } else {
    //      RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(response: "failed", error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message" : "An error has occurred."]))
    //    }
    //  }

    @objc
    private func exitSheet(_ rnMessage: String) {
        var response: String?
        var error: NSError?

        if let data = rnMessage.data(using: .utf8) {
            do {
                if let jsonDictionary = try JSONSerialization.jsonObject(with: data, options: []) as? [String: String] {
                    let status = jsonDictionary["status"]

                    if (status == "failed" || status == "requires_payment_method") {
                        error = NSError(domain: (jsonDictionary["code"] ?? "") != "" ? jsonDictionary["code"]! : "UNKNOWN_ERROR", code: 0, userInfo: ["message" : jsonDictionary["message"] ?? "An error has occurred."])
                    } else {
                        response = status
                    }
                    RNFabricManager.sharedInstance.responseHandler?.didReceiveResponse(response: response, error: error)
                } else {
                    RNFabricManager.sharedInstance.responseHandler?.didReceiveResponse(response: "failed", error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message" : "An error has occurred."]))
                }
            } catch {
                RNFabricManager.sharedInstance.responseHandler?.didReceiveResponse(response: "failed", error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message" : "An error has occurred."]))
            }
        } else {
            RNFabricManager.sharedInstance.responseHandler?.didReceiveResponse(response: "failed", error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message" : "An error has occurred."]))
        }
        DispatchQueue.main.async {
            if let view = RNFabricManager.sharedInstance.rootView {
                let reactNativeVC: UIViewController? = view.reactViewController()
                reactNativeVC?.dismiss(animated: false, completion: nil)
            }
        }
    }
}


