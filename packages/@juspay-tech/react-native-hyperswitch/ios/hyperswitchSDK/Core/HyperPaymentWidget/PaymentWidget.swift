//
//  PaymentWidget.swift
//  hyperswitch
//
//  Created by Harshit Srivastava on 21/04/26.
//

import Combine
import Foundation
import React

public class PaymentWidget: UIControl {

    private let paymentSession: PaymentSession
    private let configuration: PaymentSheet.Configuration?
    private var configurationDict: [String: Any]?
    private var widgetReactTag: NSNumber?
    internal var rootReactTag: NSNumber? { widgetReactTag }
    private var rootView: UIView?
    private var initCallback: ((PaymentResult) -> Void)?
    private var shouldProceedWithPaymentCallback: ((PaymentRequestData, @escaping (Bool) -> Void) -> Void)?
    private var cancellables = Set<AnyCancellable>()
    internal var paymentEventListener: PaymentEventListener?

    public init(
        paymentSession: PaymentSession,
        configuration: PaymentSheet.Configuration? = nil,
        completion: @escaping ((PaymentResult) -> Void)
    ) {
        self.paymentSession = paymentSession
        self.configuration = configuration
        self.configurationDict = nil
        self.initCallback = completion
        super.init(frame: .zero)
        commonInit()
    }

    public init(
        paymentSession: PaymentSession,
        configurationDict: [String: Any]?,
        completion: @escaping ((PaymentResult) -> Void)
    ) {
        self.paymentSession = paymentSession
        self.configuration = nil
        self.configurationDict = configurationDict
        self.initCallback = completion
        super.init(frame: .zero)
        commonInit()
    }

    private func dispatchToMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public func shouldProceedWithPayment(_ callback: @escaping (PaymentRequestData, @escaping (Bool) -> Void) -> Void) {
        self.shouldProceedWithPaymentCallback = callback
    }

    private func commonInit() {
        let sdkParams = SDKParams.getSDKParams()

        // Use configurationDict directly from React Native (already contains everything)
        var props = configurationDict ?? [:]
        props["sdkParams"] = sdkParams

        self.rootView = RNViewManager.sharedInstance.widgetViewForModule(
            "hyperSwitch",
            initialProperties: ["props": props]
        )
        if let rootView = self.rootView {
            self.widgetReactTag = rootView.reactTag

            rootView.backgroundColor = .clear

            addSubview(rootView)

            rootView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                rootView.topAnchor.constraint(equalTo: topAnchor),
                rootView.bottomAnchor.constraint(equalTo: bottomAnchor),
                rootView.leadingAnchor.constraint(equalTo: leadingAnchor),
                rootView.trailingAnchor.constraint(equalTo: trailingAnchor),
            ])
        }

        paymentSession.updateIntentDidStart
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in
                guard let self = self else { return }
                let payload: [String: Any] = ["rootTag": self.widgetReactTag ?? -1]
                HyperModuleImpl.shared.updateIntentInit(data: payload)
            }
            .store(in: &cancellables)

        paymentSession.updateIntentDidComplete
            .receive(on: DispatchQueue.main)
            .sink { [weak self] sdkAuthorization in
                guard let self = self else { return }
                let payload: [String: Any] = [
                    "rootTag": self.widgetReactTag ?? -1,
                    "sdkAuthorization": sdkAuthorization,
                ]
                HyperModuleImpl.shared.updateIntentComplete(data: payload)
            }
            .store(in: &cancellables)
    }

    public func confirm() {
        let payload: [String: Any] = [
            "rootTag": self.widgetReactTag ?? -1,
            "actionType": "CONFIRM_PAYMENT_ACTION",
        ]
        dispatchToMain {
            HyperModuleImpl.shared.triggerWidgetAction(data: payload)
        }
    }

    internal func setPaymentEventListener(_ listener: PaymentEventListener?) {
        self.paymentEventListener = listener
    }

    internal func handleShouldProceedWithPayment(payload: String, callback: @escaping (Bool) -> Void) {
        if shouldProceedWithPaymentCallback == nil {
            callback(true)
        } else {
            if let data = payload.data(using: .utf8),
                let paymentRequestData = try? JSONDecoder().decode(PaymentRequestData.self, from: data)
            {
                shouldProceedWithPaymentCallback?(paymentRequestData, callback)
            }
        }
    }

    internal func handleUpdateIntentEvent(type: String, result: String) {
        // Send to Combine publishers (for potential future use)
        switch type {
        case "UPDATE_INTENT_INIT_RETURNED":
            paymentSession.updateIntentInitReturned.send(result)
        case "UPDATE_INTENT_COMPLETE_RETURNED":
            paymentSession.updateIntentCompleteReturned.send(result)
        default:
            break
        }
    }

    internal func handleConfirmPaymentResponse(_ result: PaymentResult) {
        initCallback?(result)
        initCallback = nil
        cancellables.removeAll()
        rootView?.removeFromSuperview()
        rootView = nil
        widgetReactTag = nil
    }

    internal func dispatchPaymentEvent(type: String, payload: [String: Any]) {
        guard let listener = paymentEventListener else { return }
        let event = PaymentEvent(eventName: type, payload: payload)
        if Thread.isMainThread {
            listener.onPaymentEvent(event)
        } else {
            DispatchQueue.main.async { listener.onPaymentEvent(event) }
        }
    }
}

