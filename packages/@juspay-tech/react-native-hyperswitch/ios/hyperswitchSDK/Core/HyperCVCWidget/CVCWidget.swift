//
//  CVCWidget.swift
//  hyperswitch
//
//  Created by Harshit Srivastava on 21/04/26.
//

import Foundation
import React

public class CVCWidget: UIControl {

    private let configuration: PaymentSheet.Configuration?
    private var configurationDict: [String: Any]?
    private var widgetReactTag: NSNumber?
    internal var rootReactTag: NSNumber? { widgetReactTag }
    private var rootView: UIView?
    private var cvcCallback: ((PaymentResult) -> Void)?
    private let hyperswitch: Hyperswitch

    internal var paymentEventListener: PaymentEventListener?

    public init(
        hyperswitch: Hyperswitch,
        configuration: PaymentSheet.Configuration? = nil
    ) {
        self.hyperswitch = hyperswitch
        self.configuration = configuration
        self.configurationDict = nil
        super.init(frame: .zero)
        commonInit()
    }

    //MARK: pass through
    public init(hyperswitch: Hyperswitch, configurationDict: [String: Any]?)
    {
        self.hyperswitch = hyperswitch
        self.configuration = nil
        self.configurationDict = configurationDict
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
        } else {
        }
    }

    func confirm(sdkAuthorization: String, paymentToken: String, paymentMethodId: String? = nil) {
        let payload: [String: Any] = [
            "actionType": "CONFIRM_CVC_PAYMENT",
            "rootTag": self.widgetReactTag ?? -1,
            "sdkAuthorization": sdkAuthorization,
            "paymentToken": paymentToken,
            "paymentMethodId": paymentMethodId as Any,
        ]
        dispatchToMain {
            // Route through the codegen typed EventEmitter (bridgeless-compatible).
            // HyperModule.emitEvent falls back to the RCTEventEmitter device event
            // when the codegen callback isn't wired yet (old arch / early runtime).
            HyperModuleImpl.shared.triggerWidgetAction(data: payload)
        }
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

    internal func setPaymentEventListener(_ listener: PaymentEventListener?) {
        self.paymentEventListener = listener
    }
}

