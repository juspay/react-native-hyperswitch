//
//  NativePaymentWidget.swift
//  Hyperswitch
//
//  Created by Harshit Srivastava on 05/03/26.
//

import React
import UIKit

@objc(NativePaymentWidget)
internal class NativePaymentWidget: RCTViewManager {

    override func view() -> NativePaymentWidgetView {
        return NativePaymentWidgetView()
    }

    @objc override static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc func showWidget(_ reactTag: NSNumber) {
        // No-op on iOS: widget is automatically shown when added as subview in didSetProps()
    }

    @objc func removeWidget(_ reactTag: NSNumber) {
        // No-op on iOS: widget cleanup happens automatically via clearWidget() / view lifecycle
    }

    @objc func confirmPayment(_ reactTag: NSNumber, _ rnCallback: @escaping RCTResponseSenderBlock) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            // Old-arch path: the view is NativePaymentWidgetView directly.
            if let view = viewRegistry?[reactTag] as? NativePaymentWidgetView {
                view.confirmPayment(rnCallback)
                return
            }
            rnCallback([["status": "failed", "message": "Widget view not found for tag \(reactTag)"]])
        }
    }

    @objc func updateIntentInitForWidget(_ rootTag: NSNumber, _ rnCallback: @escaping RCTResponseSenderBlock) {
        // Try registry first (works for both old-arch and Fabric/new-arch)
        if let view = NativePaymentWidgetRegistry.shared.view(forTag: rootTag) {
            view.updateIntentInit(rnCallback)
            return
        }
        
        // Fall back to bridge-based lookup for old-arch
        bridge.uiManager.addUIBlock { _, viewRegistry in
            if let view = viewRegistry?[rootTag] as? NativePaymentWidgetView {
                view.updateIntentInit(rnCallback)
                return
            }
            rnCallback([["status": "failed", "message": "Widget view not found for tag \(rootTag)"]])
        }
    }

    @objc func updateIntentCompleteForWidget(
        _ rootTag: NSNumber,
        _ sdkAuthorization: String,
        _ rnCallback: @escaping RCTResponseSenderBlock
    ) {
        // Try registry first (works for both old-arch and Fabric/new-arch)
        if let view = NativePaymentWidgetRegistry.shared.view(forTag: rootTag) {
            view.updateIntentComplete(sdkAuthorization: sdkAuthorization, resolve: rnCallback)
            return
        }
        
        // Fall back to bridge-based lookup for old-arch
        bridge.uiManager.addUIBlock { _, viewRegistry in
            if let view = viewRegistry?[rootTag] as? NativePaymentWidgetView {
                view.updateIntentComplete(sdkAuthorization: sdkAuthorization, resolve: rnCallback)
                return
            }
            rnCallback([["status": "failed", "message": "Widget view not found for tag \(rootTag)"]])
        }
    }


    @objc func confirmPaymentCVC(
        _ reactTag: NSNumber,
        _ paymentToken: String,
        _ paymentMethodId: String,
        _ rnCallback: @escaping RCTResponseSenderBlock
    ) {
        bridge.uiManager.addUIBlock { _, viewRegistry in
            if let view = viewRegistry?[reactTag] as? NativePaymentWidgetView {
                view.confirmCVCPayment(paymentToken: paymentToken, paymentMethodId: paymentMethodId, resolve: rnCallback)
                return
            }
            rnCallback([["status": "failed", "message": "Widget view not found for tag \(reactTag)"]])
        }
    }
}

// public + @objc exposes this class (and the members below marked @objc) in the
// generated HyperswitchSdkReactNative-Swift.h header so the Objective-C++ Fabric
// component (NativePaymentElementView.mm) and TurboModule (NativePaymentElementModule.mm)
// can instantiate it, type-check it, and call its commands. Framework targets only emit
// public declarations into that header, even for callers in the same module.
@objc(NativePaymentWidgetView)
public class NativePaymentWidgetView: UIView {

    internal var paymentWidget: PaymentWidget?
    internal var cvcWidget: CVCWidget?
    internal var cvcWidgetRef: CVCWidget? { cvcWidget }
    // Public (not just internal) so these show up in the generated Objective-C
    // header for the Fabric wrapper (NativePaymentElementView.mm) to set via the ObjC bridge.
    @objc public var widgetType: String?
    @objc public var sdkAuthorization: String?
    @objc public var options: [String: Any]?
    @objc internal var onPaymentEvent: RCTDirectEventBlock?
    @objc internal var onPaymentResult: RCTDirectEventBlock?
    private var responseSenderCallback: RCTResponseSenderBlock?
    private var updateIntentInitCallback: RCTResponseSenderBlock?
    private var updateIntentCompleteCallback: RCTResponseSenderBlock?
    private var appliedConfigKey: String?

    internal var rctRootTag: NSNumber?

    private func callbackPayload(_ data: Any?) -> Any {
        guard let stringData = data as? String,
            let jsonData = stringData.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
        else {
            return data ?? NSNull()
        }
        return json
    }

    private func nonEmptyString(_ value: String?) -> String? {
        guard let value = value, !value.isEmpty else { return nil }
        return value
    }

    private func optionString(_ key: String) -> String? {
        return options?[key] as? String
    }

    private func effectiveSdkAuthorization() -> String? {
        // Priority: direct prop > options.paymentSessionConfig.sdkAuthorization > active session
        if let direct = nonEmptyString(sdkAuthorization) {
            return direct
        }
        if let paymentSessionConfig = options?["paymentSessionConfig"] as? [String: Any],
           let auth = paymentSessionConfig["sdkAuthorization"] as? String {
            return nonEmptyString(auth)
        }
        return nonEmptyString(PaymentSession.activeSession?.paymentSessionConfiguration.sdkAuthorization)
    }

    private func effectivePublishableKey() -> String? {
        // Priority: options.hyperswitchConfig.publishableKey > active Hyperswitch
        if let hyperswitchConfig = options?["hyperswitchConfig"] as? [String: Any],
           let key = hyperswitchConfig["publishableKey"] as? String {
            return nonEmptyString(key)
        }
        return nonEmptyString(HyperswitchModule.getActivePublishableKey())
    }

    private func effectiveProfileId() -> String? {
        // Priority: options.hyperswitchConfig.profileId > active Hyperswitch
        if let hyperswitchConfig = options?["hyperswitchConfig"] as? [String: Any],
           let id = hyperswitchConfig["profileId"] as? String {
            return nonEmptyString(id)
        }
        return nonEmptyString(HyperswitchModule.getActiveProfileId())
    }

    private func isSupportedWidgetType() -> Bool {
        return widgetType == "cvcWidget" || widgetType == "paymentElement" || widgetType == "widgetPaymentSheet" || widgetType == "hostedCheckout" || widgetType == "google_pay" || widgetType == "apple_pay" || widgetType == "paypal" || widgetType == "card" || widgetType == "paymentMethodsManagement"
    }

    private func activeOrNewHyperswitch() -> Hyperswitch? {
        if let active = HyperswitchModule.getActiveHyperswitch(), nonEmptyString(optionString("publishableKey")) == nil {
            return active
        }

        guard let publishableKey = effectivePublishableKey() else { return nil }
        return Hyperswitch(
            configuration: HyperswitchConfiguration(
                publishableKey: publishableKey,
                profileId: effectiveProfileId()
            )
        )
    }

    private func activeOrNewPaymentSession(sdkAuthorization: String) -> PaymentSession? {
        if let activeSession = HyperswitchModule.getActivePaymentSession(), nonEmptyString(optionString("sdkAuthorization")) == nil {
            return activeSession
        }

        return activeOrNewHyperswitch()?.initPaymentSession(
            configuration: PaymentSessionConfiguration(sdkAuthorization: sdkAuthorization)
        )
    }

    private func clearWidget() {
        paymentWidget?.removeFromSuperview()
        cvcWidget?.removeFromSuperview()
        paymentWidget = nil
        cvcWidget = nil
        rctRootTag = nil
        responseSenderCallback = nil
    }

    // MARK: - Payment Result Handling
    
    /// Called from exitWidgetPaymentsheet - final result that triggers exit
    /// Matches Android: notifyResult(CallbackType.PAYMENT_RESULT, result)
    internal func handlePaymentResult(_ rnMessage: String, triggerExit: Bool = false) {
        // Priority: confirmPayment callback > onPaymentResult event
        if let callback = responseSenderCallback {
            callback([rnMessage])
            responseSenderCallback = nil
            // triggerExit is handled by the caller (embedded bundle calls exitWidgetPaymentsheet)
            return
        }
        
        // No callback, send via event
        onPaymentResult?(["result": rnMessage])
    }

    /// Called from notifyWidgetPaymentResult - intermediate result (validation errors)
    /// Matches Android: notifyResult(CallbackType.CONFIRM_ACTION, result)
    internal func handleConfirmPaymentNotification(_ rnMessage: String) {
        // Only send to confirmPayment callback if it exists
        // This keeps the widget open for validation errors
        if let callback = responseSenderCallback {
            callback([rnMessage])
            responseSenderCallback = nil
            return
        }
        
        // No callback, send via event (for inline form submissions)
        onPaymentResult?(["result": rnMessage])
    }
    
    /// Adapter: the inner PaymentWidget still completes with the public PaymentResult type.
    /// This is the single place where PaymentResult is converted to StandardResult;
    /// everything downstream operates on StandardResult.rawJSON.
    private func handlePaymentResult(_ result: PaymentResult) {
        handlePaymentResult(StandardResult(paymentResult: result).rawJSON, triggerExit: false)
    }

    @objc public func didSetProps() {
        guard isSupportedWidgetType(), let sdkAuthorization = effectiveSdkAuthorization() else {
            return
        }

        let configKey = [widgetType ?? "", effectivePublishableKey() ?? "", effectiveProfileId() ?? "", sdkAuthorization].joined(separator: ":")
        if paymentWidget != nil || cvcWidget != nil, appliedConfigKey == configKey {
            return
        }

        clearWidget()
        appliedConfigKey = configKey

        // putAll(widgetConfig) + put("type", widgetType)
        var configuration = options ?? [:]
        configuration["type"] = widgetType

        let listener = PaymentEventListener { [weak self] event in
            // Codegen types the payload as a string on every platform; JS parses it.
            let payloadData = JSONSerialization.isValidJSONObject(event.payload)
                ? try? JSONSerialization.data(withJSONObject: event.payload)
                : nil
            let payload = payloadData.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
            self?.onPaymentEvent?([
                "eventName": event.type,
                "payload": payload,
            ])
        }

        let widget: UIView?
        if widgetType == "cvcWidget" {
            guard let hyperswitch = activeOrNewHyperswitch() else {
                return
            }
            let cvc = CVCWidget(
                hyperswitch: hyperswitch,
                configurationDict: configuration,
                subscribe: nil
            )
            cvc.setPaymentEventListener(listener)
            cvcWidget = cvc
            widget = cvc
        } else {
            guard let session = activeOrNewPaymentSession(sdkAuthorization: sdkAuthorization) else {
                return
            }
            let payment = PaymentWidget(
                paymentSession: session,
                configurationDict: configuration,
                completion: { [weak self] result in
                    self?.handlePaymentResult(result)
                },
                subscribe: nil
            )
            payment.setPaymentEventListener(listener)
            paymentWidget = payment
            widget = payment
        }

        guard let widget = widget else {
            return
        }
        addSubview(widget)
        widget.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widget.topAnchor.constraint(equalTo: topAnchor),
            widget.bottomAnchor.constraint(equalTo: bottomAnchor),
            widget.leadingAnchor.constraint(equalTo: leadingAnchor),
            widget.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])

        if let paymentWidget = widget as? PaymentWidget {
            rctRootTag = paymentWidget.rootReactTag
            
            // Update registry mapping: embedded tag -> outer tag
            if let embeddedTag = paymentWidget.rootReactTag, let outerTag = reactTag {
                NativePaymentWidgetRegistry.shared.updateEmbeddedTag(embeddedTag, forOuterTag: outerTag)
            }
        } else if let cvcWidget = widget as? CVCWidget {
            rctRootTag = cvcWidget.rootReactTag
            
            // Update registry mapping: embedded tag -> outer tag
            if let embeddedTag = cvcWidget.rootReactTag, let outerTag = reactTag {
                NativePaymentWidgetRegistry.shared.updateEmbeddedTag(embeddedTag, forOuterTag: outerTag)
            }
        }
    }

    public override func didSetProps(_ changedProps: [String]) {
        self.didSetProps()
    }
    
    public override func didMoveToWindow() {
        super.didMoveToWindow()
        // Register when view is added to window hierarchy
        if window != nil, let tag = reactTag {
            NativePaymentWidgetRegistry.shared.register(view: self, tag: tag)
        }
    }
    
    public override func willMove(toWindow newWindow: UIWindow?) {
        super.willMove(toWindow: newWindow)
        // Unregister when view is removed from window hierarchy
        if newWindow == nil, let tag = reactTag {
            NativePaymentWidgetRegistry.shared.unregister(tag: tag)
        }
    }
    
    deinit {
        // Final cleanup on dealloc
        if let tag = reactTag {
            NativePaymentWidgetRegistry.shared.unregister(tag: tag)
        }
        clearWidget()
    }

    public override init(frame: CGRect) {
        super.init(frame: frame)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        paymentWidget?.frame = bounds
        cvcWidget?.frame = bounds
    }

    @objc public func confirmPayment(_ rnCallback: @escaping RCTResponseSenderBlock) {
        // avoiding duplicate confirm calls (confirmPayment triggered multiple times from RN layer)
        if self.responseSenderCallback != nil {
            let response = ["status": "failed", "error": "invalid call"]
            rnCallback([response])
            return
        }

        self.responseSenderCallback = rnCallback
        guard let paymentWidget = paymentWidget else {
            self.responseSenderCallback = nil
            rnCallback([[
                "status": "failed",
                "code": "WIDGET_NOT_READY",
                "message": "Widget not ready",
            ]])
            return
        }
        paymentWidget.confirm()
    }

    @objc public func updateIntentInit(_ resolve: @escaping RCTResponseSenderBlock) {
        guard let tag = rctRootTag else {
            resolve([["status": "failed", "message": "Widget root tag not found"]])
            return
        }

        // Prevent race conditions - reject if callback already pending
        if updateIntentInitCallback != nil {
            resolve([["status": "failed", "message": "updateIntentInit already in progress"]])
            return
        }

        // Store callback to be invoked when embedded bundle responds
        updateIntentInitCallback = resolve

        let eventData: [String: Any] = ["rootTag": tag]
        // Bridgeless: route to the embedded bundle via the codegen typed emitter.
        HyperModuleImpl.shared.updateIntentInit(data: eventData)
    }

    @objc public func updateIntentComplete(sdkAuthorization: String, resolve: @escaping RCTResponseSenderBlock) {
        guard let tag = rctRootTag else {
            resolve([["status": "failed", "message": "Widget root tag not found"]])
            return
        }

        // Prevent race conditions - reject if callback already pending
        if updateIntentCompleteCallback != nil {
            resolve([["status": "failed", "message": "updateIntentComplete already in progress"]])
            return
        }

        // Store callback to be invoked when embedded bundle responds
        updateIntentCompleteCallback = resolve

        let eventData: [String: Any] = [
            "rootTag": tag,
            "sdkAuthorization": sdkAuthorization,
        ]
        // Bridgeless: route to the embedded bundle via the codegen typed emitter.
        HyperModuleImpl.shared.updateIntentComplete(data: eventData)
    }
    
    // Called by PaymentWidget when embedded bundle responds
    internal func handleUpdateIntentInitResponse(_ result: String) {
        if let callback = updateIntentInitCallback {
            callback([callbackPayload(result)])
            updateIntentInitCallback = nil
        }
    }
    
    internal func handleUpdateIntentCompleteResponse(_ result: String) {
        if let callback = updateIntentCompleteCallback {
            callback([callbackPayload(result)])
            updateIntentCompleteCallback = nil
        }
    }

    internal func confirmCVCPayment(paymentToken: String, paymentMethodId: String, resolve: @escaping RCTResponseSenderBlock) {
        if let tag = rctRootTag {
            WidgetResponseRegistry.shared.register(rootTag: tag, action: .confirmCVCPayment) { [weak self] response, shouldRemoveView in
                guard let self = self else { return }
                resolve([self.callbackPayload(response["data"])])
            }
        }

        if let sdkAuthorization = effectiveSdkAuthorization(), let cvcWidget = cvcWidget {
            cvcWidget.confirm(sdkAuthorization: sdkAuthorization, paymentToken: paymentToken, paymentMethodId: paymentMethodId)
        }
    }
}
