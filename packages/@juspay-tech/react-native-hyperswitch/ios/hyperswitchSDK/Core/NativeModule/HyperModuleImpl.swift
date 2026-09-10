//
//  HyperModuleImpl.swift
//  Pods
//
//  Created by Kuntimaddi Manideep on 22/07/26.
//

import Foundation
import React
import React_RCTAppDelegate

/// Contract implemented by the ObjC++ `HyperModule` TurboModule (HyperModule.mm).
/// Mirrors the reference shim (juspay/hyperswitch-sdk-ios#110): the impl emits JS
/// events and resolves native views through this shim without touching the bridge.
@objc(HyperModuleShim)
public protocol HyperModuleShim: NSObjectProtocol {
    @objc(attachImpl:)
    func attach(impl: HyperModuleImpl)
    @objc(emitEventWithName:payload:)
    func emitEvent(name: String, payload: [String: Any])
    @objc(viewForRootTag:)
    func view(forRootTag rootTag: NSNumber) -> UIView?
}

@objc(HyperModuleImpl)
public class HyperModuleImpl: NSObject {

    /// The shared logic instance bound to the "hyperSwitch" host's HyperModule
    /// TurboModule by RNViewManager's `getModuleInstanceFromClass:`. All
    /// widget/sheet event emitters (`confirm`/`widget`/`triggerWidgetAction`/
    /// `updateIntent*`) are called through this singleton.
    @objc public static let shared = HyperModuleImpl()

    /// Every ObjC++ HyperModule TurboModule attached to this impl, held weakly to
    /// avoid a retain cycle. This is a set rather than a single reference because
    /// on RN < 0.81 the TurboModuleManagerDelegate attach point is unavailable, so
    /// each host's module self-attaches to `shared` in `init` (HyperModule.mm) —
    /// the embedded headless runtime included. With a single reference the most
    /// recently created host silently steals the emit channel from the widget
    /// host, and events like `updateIntentInit` are delivered to a bundle that
    /// has no listener for them.
    private let shims = NSHashTable<AnyObject>.weakObjects()

    /// Live shims, in no particular order. Deallocated hosts drop out on their own.
    private var attachedShims: [HyperModuleShim] {
        return shims.allObjects.compactMap { $0 as? HyperModuleShim }
    }

    /// Called by the host's TurboModuleManagerDelegate when the ObjC++ HyperModule
    /// is created. Attaches the bidirectional link: module -> impl, impl -> module.
    @objc public func attach(to shim: HyperModuleShim) {
        shim.attach(impl: self)
        DispatchQueue.main.async {
            self.shims.add(shim as AnyObject)
        }
    }

    private let applePayPaymentHandler = ApplePayHandler()
    private let expressCheckoutHandler = ExpressCheckoutLauncher()
    private var presentCallback: RCTResponseSenderBlock? = nil

    /// Direct reference to the currently-presented PaymentSheet.
    /// Set by PaymentSheetView+UIKit when the sheet is presented; cleared in exitPaymentsheet.
    /// Avoids relying on bridge.uiManager.addUIBlock (which doesn't find Fabric views).
    private var activePaymentSheet: PaymentSheet?
    private weak var activePaymentSheetVC: HyperUIViewController?

    internal override init() {
        super.init()
    }

    // MARK: - Payment sheet registration (called from PaymentSheetView+UIKit)

    internal func registerPaymentSheet(_ sheet: PaymentSheet, vc: HyperUIViewController) {
        activePaymentSheet = sheet
        activePaymentSheetVC = vc
    }

    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    // MARK: - Events
    //
    // Route through the attached shim (the ObjC++ HyperModule) which forwards to the
    // codegen typed EventEmitters — bridgeless-only. The rn82+ bundle subscribes to
    // these events exclusively via the codegen emitters.

    @objc public func emit(_ name: String, _ payload: [String: Any]) {
        onMain {
            for shim in self.attachedShims {
                shim.emitEvent(name: name, payload: payload)
            }
        }
    }

    @objc public func confirm(data: [String: Any]) {
        emit("confirm", data)
    }

    @objc public func widget(data: [String: Any]) {
        emit("widget", data)
    }

    // MARK: WIP
    @objc public func confirmEC(data: [String: Any]) {
        emit("confirmEC", data)
    }

    @objc public func triggerWidgetAction(data: [String: Any]) {
        emit("triggerWidgetAction", data)
    }

    @objc public func updateIntentInit(data: [String: Any]) {
        emit("updateIntentInit", data)
    }

    @objc public func updateIntentComplete(data: [String: Any]) {
        emit("updateIntentComplete", data)
    }

    // MARK: - Generic message passing

    @objc public func sendMessageToNative(_ rnMessage: String) {}

    // MARK: - Apple Pay

    @objc public func launchApplePay(_ rnMessage: String, callback: @escaping RCTResponseSenderBlock) {
        applePayPaymentHandler.startPayment(rnMessage: rnMessage, rnCallback: callback, presentCallback: self.presentCallback)
    }

    @objc public func startApplePay(_ rnMessage: String, callback: @escaping RCTResponseSenderBlock) {
        callback([])
    }

    @objc public func presentApplePay(_ rnMessage: String, callback: @escaping RCTResponseSenderBlock) {
        self.presentCallback = callback
    }

    // MARK: - Google Pay (Android only — no-op on iOS)

    @objc public func launchGPay(_ requestObj: String, callback: @escaping RCTResponseSenderBlock) {
        callback(["Google Pay is not available on iOS"])
    }

    // MARK: - Widget (Android-oriented no-ops on iOS)

    @objc public func exitWidget(_ result: String, widgetType: String) {
        // No dedicated iOS implementation (Android-oriented); no-op.
    }

    @objc public func updateWidgetHeight(_ height: NSNumber) {
        // Height is driven by the native widget view on iOS; no-op.
    }

    // MARK: - Widget (commented out — relies on RCTBridge/uiManager)

       @objc public func launchWidgetPaymentSheet(_ requestObj: String, callback: @escaping RCTResponseSenderBlock) {
        //    let request = HyperModuleImpl.jsonObject(from: requestObj)
        //    expressCheckoutHandler.launchPaymentSheet(paymentResult: request, callBack: callback)
       }
    //
       @objc public func onAddPaymentMethod(_ rnMessage: String) {
        //    PaymentMethodManagementWidget.onAddPaymentMethod?()
       }

    // MARK: - Payment sheet exits

    @objc public func exitPaymentsheet(_ reactTag: NSNumber, result rnMessage: String, reset: Bool) {
        // Consume and clear so they can't be called a second time.
        let sheet = activePaymentSheet
        let vc    = activePaymentSheetVC
        activePaymentSheet   = nil
        activePaymentSheetVC = nil

        // Pass the raw JS result string directly — no PaymentResult conversion.
        // PaymentSheet.completion is (String) -> Void, so this goes straight to
        // the promise resolve in HyperswitchModule.presentPaymentSheet.
        sheet?.completion?(rnMessage)

        // Dismiss the VC, then release the rootView so the Fabric surface is torn down.
        vc?.dismiss(animated: false) {
            RNViewManager.sharedInstance.rootView?.removeFromSuperview()
            RNViewManager.sharedInstance.rootView = nil
        }
    }

    @objc public func exitWidgetPaymentsheet(_ reactTag: NSNumber, result rnMessage: String, reset: Bool) {
        // Final result - send to callback/event and trigger exit
        withNativePaymentWidgetView(reactTag) { view in
            view.handlePaymentResult(rnMessage, triggerExit: true)
        }
    }

    @objc public func exitPaymentMethodManagement(_ reactTag: NSNumber, result rnMessage: String, reset: Bool) {
        exitSheet(rnMessage)
    }

    @objc public func exitCardForm(_ rnMessage: String) {
        exitCardFormInternal(rnMessage)
    }

    // MARK: - Payment result / events (commented out — rely on RCTBridge/uiManager)

    @objc public func notifyWidgetPaymentResult(_ rootTag: NSNumber, result rnMessage: String) {
        // Intermediate result (e.g. validation errors) - send to callback only, don't exit
        withNativePaymentWidgetView(rootTag) { view in
            view.handleConfirmPaymentNotification(rnMessage)
        }
    }

    @objc public func onUpdateIntentEvent(_ rootTag: NSNumber, type: String, result: String) {
        // Notify the widget for Combine publishers (optional)
        withWidget(rootTag) { widget in
            widget.handleUpdateIntentEvent(type: type, result: result)
        }
        
        // Call the view's callback handlers directly
        withNativePaymentWidgetView(rootTag) { view in
            switch type {
            case "UPDATE_INTENT_INIT_RETURNED":
                view.handleUpdateIntentInitResponse(result)
            case "UPDATE_INTENT_COMPLETE_RETURNED":
                view.handleUpdateIntentCompleteResponse(result)
            default:
                break
            }
        }
    }

    @objc public func emitPaymentEvent(_ rootTag: NSNumber, eventType: String, payload: NSDictionary) {
        // Copy the payload to prevent concurrent mutation during iteration
        // (Fixes F14Set assertion crash in debug builds when embedded
        // RN bundle's TextInput fires rapid focus/blur events)
        let map = (payload as? [String: Any]) ?? [:]
        let safeMap = map.reduce(into: [:]) { $0[$1.key] = $1.value }
        resolveSubscribingTarget(rootTag) { target in
            if let widget = target as? PaymentWidget, widget.paymentEventListener != nil {
                widget.dispatchPaymentEvent(type: eventType, payload: safeMap)
            } else if let cvc = target as? CVCWidget, cvc.paymentEventListener != nil {
                cvc.dispatchPaymentEvent(type: eventType, payload: safeMap)
            } else if let sheet = target as? PaymentSheet, sheet.paymentEventListener != nil {
                sheet.dispatchPaymentEvent(type: eventType, payload: safeMap)
            }
        }
    }

    @objc public func onPaymentConfirmButtonClick(_ rootTag: NSNumber, payload: String, callback: @escaping RCTResponseSenderBlock) {
        resolveSubscribingTarget(rootTag) { target in
            if let widget = target as? PaymentWidget {
                widget.handleShouldProceedWithPayment(payload: payload) { shouldProceed in
                    callback([shouldProceed])
                }
            } else if let sheet = target as? PaymentSheet {
                sheet.handleShouldProceedWithPayment(payload: payload) { shouldProceed in
                    callback([shouldProceed])
                }
            } else {
                callback([true])
            }
        }
    }

    // MARK: - 3DS / DDC iframe bridge

    @objc public func openIframeBridge(_ url: String, timeoutMs: NSNumber, callback: @escaping RCTResponseSenderBlock) {
        DispatchQueue.main.async {
            let headlessWebView = HeadlessWebView(url: url, timeoutMs: timeoutMs, callback: callback)
            headlessWebView.startFlow()
        }
    }

    // MARK: - Helpers

    private static func jsonObject(from string: String) -> NSMutableDictionary {
        guard
            let data = string.data(using: .utf8),
            let obj = try? JSONSerialization.jsonObject(with: data, options: []) as? [AnyHashable: Any]
        else {
            return NSMutableDictionary()
        }
        return NSMutableDictionary(dictionary: obj)
    }

    private func paymentResult(from rnMessage: String) -> PaymentResult {
        guard let data = rnMessage.data(using: .utf8) else {
            return .failed(
                error: NSError(
                    domain: "UNKNOWN_ERROR",
                    code: 0,
                    userInfo: ["message": "An error has occurred."]
                )
            )
        }

        do {
            guard let jsonDictionary = try JSONSerialization.jsonObject(with: data, options: []) as? [String: String] else {
                return .failed(
                    error: NSError(
                        domain: "UNKNOWN_ERROR",
                        code: 0,
                        userInfo: ["message": "An error has occurred."]
                    )
                )
            }

            let status = jsonDictionary["status"]

            if status == "success" || status == "succeeded" || status == "completed" || status == "requires_capture" {
                return .completed(data: rnMessage)  // Pass full raw JSON
            } else if status == "cancelled" || status == "canceled" {
                return .canceled(data: rnMessage)  // Pass full raw JSON
            } else {
                // Store the original raw JSON string in userInfo so it can be passed through without loss
                let error = NSError(
                    domain: (jsonDictionary["code"] ?? "") != "" ? jsonDictionary["code"]! : "",
                    code: 0,
                    userInfo: [
                        "message": jsonDictionary["message"] ?? status ?? "An error has occurred.",
                        "rawJSON": rnMessage  // Preserve original JSON from embedded bundle
                    ]
                )
                return .failed(error: error)
            }
        } catch {
            return .failed(
                error: NSError(
                    domain: "UNKNOWN_ERROR",
                    code: 0,
                    userInfo: ["message": "An error has occurred."]
                )
            )
        }
    }

    private func exitCardFormInternal(_ rnMessage: String) {
        var response: String?
        var error: NSError?

        if let data = rnMessage.data(using: .utf8) {
            do {
                if let jsonDictionary = try JSONSerialization.jsonObject(with: data, options: []) as? [String: String] {
                    let status = jsonDictionary["status"]

                    if status == "failed" || status == "requires_payment_method" {
                        error = NSError(
                            domain: (jsonDictionary["code"] ?? "") != "" ? jsonDictionary["code"]! : "UNKNOWN_ERROR",
                            code: 0,
                            userInfo: ["message": jsonDictionary["message"] ?? "An error has occurred."]
                        )
                    } else {
                        response = status
                    }
                    RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(response: response, error: error)
                } else {
                    RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(
                        response: "failed",
                        error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message": "An error has occurred."])
                    )
                }
            } catch {
                RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(
                    response: "failed",
                    error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message": "An error has occurred."])
                )
            }
        } else {
            RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(
                response: "failed",
                error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message": "An error has occurred."])
            )
        }
    }

    private func exitSheet(_ rnMessage: String) {
        var response: String?
        var error: NSError?

        if let data = rnMessage.data(using: .utf8) {
            do {
                if let jsonDictionary = try JSONSerialization.jsonObject(with: data, options: []) as? [String: String] {
                    let status = jsonDictionary["status"]

                    if status == "failed" || status == "requires_payment_method" {
                        error = NSError(
                            domain: (jsonDictionary["code"] ?? "") != "" ? jsonDictionary["code"]! : "UNKNOWN_ERROR",
                            code: 0,
                            userInfo: ["message": jsonDictionary["message"] ?? "An error has occurred."]
                        )
                    } else {
                        response = status
                    }
                    RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(response: response, error: error)
                } else {
                    RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(
                        response: "failed",
                        error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message": "An error has occurred."])
                    )
                }
            } catch {
                RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(
                    response: "failed",
                    error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message": "An error has occurred."])
                )
            }
        } else {
            RNViewManager.sharedInstance.responseHandler?.didReceiveResponse(
                response: "failed",
                error: NSError(domain: "UNKNOWN_ERROR", code: 0, userInfo: ["message": "An error has occurred."])
            )
        }
        DispatchQueue.main.async {
            if let view = RNViewManager.sharedInstance.rootView {
                let reactNativeVC: UIViewController? = view.reactViewController()
                reactNativeVC?.dismiss(animated: false, completion: nil)
            }
        }
    }

    // MARK: - View lookup helpers (surface-based, New Architecture)
    //
    // Views are resolved through the attached shims' `view(forRootTag:)` — which uses
    // the Fabric surface presenter — instead of the bridge's `uiManager`. A tag only
    // resolves on the host that owns the surface, so the first hit is the right one.

    private func resolveView(forRootTag rootTag: NSNumber) -> UIView? {
        for shim in attachedShims {
            if let view = shim.view(forRootTag: rootTag) {
                return view
            }
        }
        return nil
    }

    private func withWidget(_ rootTag: NSNumber, _ block: @escaping (PaymentWidget) -> Void) {
        DispatchQueue.main.async {
            // Prefer the registry (embedded widget tag -> outer NativePaymentWidgetView).
            if let view = NativePaymentWidgetRegistry.shared.view(forEmbeddedTag: rootTag),
               let widget = view.paymentWidget {
                block(widget)
                return
            }
            // Fall back to surface-based lookup.
            if let widget = self.resolveView(forRootTag: rootTag)?
                .nearestAncestor(ofType: PaymentWidget.self) {
                block(widget)
            }
        }
    }

    private func withNativePaymentWidgetView(_ rootTag: NSNumber, _ block: @escaping (NativePaymentWidgetView) -> Void) {
        DispatchQueue.main.async {
            if let view = NativePaymentWidgetRegistry.shared.view(forEmbeddedTag: rootTag) {
                block(view)
            }
        }
    }

    private func resolveSubscribingTarget(_ rootTag: NSNumber, _ block: @escaping (AnyObject?) -> Void) {
        DispatchQueue.main.async {
            // First try widget registry (embedded tag -> outer view).
            if let view = NativePaymentWidgetRegistry.shared.view(forEmbeddedTag: rootTag) {
                if let widget = view.paymentWidget {
                    block(widget)
                    return
                }
                if let cvc = view.cvcWidget {
                    block(cvc)
                    return
                }
            }

            // Surface-based lookup (payment sheets / modal presentations).
            guard let view = self.resolveView(forRootTag: rootTag) else {
                block(nil)
                return
            }
            if let widget = view.nearestAncestor(where: { $0 is PaymentWidget || $0 is CVCWidget }) {
                block(widget)
                return
            }
            block((view.reactViewController() as? HyperUIViewController)?.paymentSheet)
        }
    }

    private func withPaymentSheet(_ rootTag: NSNumber, _ block: @escaping (UIViewController?, PaymentSheet?) -> Void) {
        DispatchQueue.main.async {
            let view = self.resolveView(forRootTag: rootTag)
            let vc = view?.reactViewController() as? HyperUIViewController
            let sheet = vc?.paymentSheet
            block(vc, sheet)
        }
    }
}
