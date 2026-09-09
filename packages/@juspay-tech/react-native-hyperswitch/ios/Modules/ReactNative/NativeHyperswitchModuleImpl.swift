//
//  NativeHyperswitchModuleImpl.swift
//  HyperswitchSdkReactNative
//

import Foundation
import PassKit
import React

@objc(NativeHyperswitchModuleImpl)
public class NativeHyperswitchModuleImpl: NSObject {

    @objc public static let shared: NativeHyperswitchModuleImpl = NativeHyperswitchModuleImpl()

    private var hyperswitchConfiguration: HyperswitchConfiguration?
    private var activePaymentSession: PaymentSession?
    private var activePaymentSessionHandler: PaymentSessionHandler?

    // MARK: - initialise
    @objc(initialiseWithPublishableKey:platformPublishableKey:profileId:environment:customEndpoints:resolve:reject:)
    public func initialise(
        publishableKey: String,
        platformPublishableKey: String,
        profileId: String,
        environment: String,
        customEndpoints: [String: Any],
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        // Build CustomEndpointConfiguration from the JS-side customEndpoints object
        var endpointsConfig: CustomEndpointConfiguration? = nil
        if let overrideDict = customEndpoints["overrideEndpoints"] as? [String: Any] {
            endpointsConfig = .overrideEndpoints(OverrideEndpointConfiguration(
                customBackendEndpoint: overrideDict["customBackendEndpoint"] as? String,
                customAssetEndpoint: overrideDict["customAssetEndpoint"] as? String,
                customSDKConfigEndpoint: overrideDict["customSDKConfigEndpoint"] as? String,
                customConfirmEndpoint: overrideDict["customConfirmEndpoint"] as? String,
                customAirborneEndpoint: overrideDict["customAirborneEndpoint"] as? String,
                customLoggingEndpoint: overrideDict["customLoggingEndpoint"] as? String
            ))
        } else if let common = customEndpoints["commonEndpoint"] as? String, !common.isEmpty {
            endpointsConfig = .commonEndpoint(common)
        }

        // Map environment string (Android uses "PROD"/"SANDBOX") to the Swift enum
        let envEnum: HyperswitchEnvironment?
        switch environment.uppercased() {
        case "PROD", "PRODUCTION":
            envEnum = .production
        case "SANDBOX":
            envEnum = .sandbox
        default:
            envEnum = nil
        }

        hyperswitchConfiguration = HyperswitchConfiguration(
            publishableKey: publishableKey,
            profileId: profileId.isEmpty ? nil : profileId,
            customEndpoints: endpointsConfig,
            environment: envEnum
        )

        // Resolve with a UUID handle (matches Android behaviour)
        resolve(UUID().uuidString)
    }

    // MARK: - presentPaymentSheet

    @objc(presentPaymentSheet:resolve:reject:)
    public func presentPaymentSheet(
        params: [String: Any],
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let hyperswitchConfig = hyperswitchConfiguration else {
            resolve([
                "status": "failed",
                "code": "NOT_INITIALIZED",
                "message": "SDK not initialized. Call initialise first.",
            ])
            return
        }

        guard
            let sessionConfig = params["paymentSessionConfig"] as? [String: Any],
            let sdkAuthorization = sessionConfig["sdkAuthorization"] as? String,
            !sdkAuthorization.isEmpty
        else {
            resolve([
                "status": "failed",
                "code": "INVALID_PARAMS",
                "message": "paymentSessionConfig.sdkAuthorization is required",
            ])
            return
        }

        let session = PaymentSession(
            paymentSessionConfiguration: PaymentSessionConfiguration(sdkAuthorization: sdkAuthorization),
            hyperswitchConfiguration: hyperswitchConfig
        )
        activePaymentSession = session
        activePaymentSessionHandler = nil

        DispatchQueue.main.async {
            guard let vc = RCTPresentedViewController() else {
                resolve([
                    "status": "failed",
                    "code": "NO_VIEW_CONTROLLER",
                    "message": "Could not find presented view controller",
                ])
                return
            }

            var sheetProps = params["configuration"] as? [String: Any] ?? [:]
            sheetProps["hyperswitchConfig"] = params["hyperswitchConfig"]
            sheetProps["paymentSessionConfig"] = params["paymentSessionConfig"]

            session.presentPaymentSheetWithParams(
                viewController: vc,
                params: sheetProps,
                completion: { result in
                    switch result {
                    case .completed(let data):
                        resolve(["status": "completed", "message": data])
                    case .failed(let error as NSError):
                        resolve([
                            "status": "failed",
                            "code": error.domain,
                            "message": "\(error.userInfo["message"] ?? "Failed")",
                        ])
                    case .canceled(let data):
                        resolve(["status": "cancelled", "message": data])
                    }
                }
            )
        }
    }

    // MARK: - getCustomerSavedPaymentMethods

    @objc(getCustomerSavedPaymentMethods:resolve:reject:)
    public func getCustomerSavedPaymentMethods(
        params: [String: Any]?,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let hyperswitchConfig = hyperswitchConfiguration else {
            resolve("{\"code\":\"error\",\"message\":\"SDK not initialized. Call initialise first.\"}")
            return
        }

        guard
            let p = params,
            let sessionConfig = p["paymentSessionConfig"] as? [String: Any],
            let sdkAuthorization = sessionConfig["sdkAuthorization"] as? String,
            !sdkAuthorization.isEmpty
        else {
            resolve("{\"code\":\"error\",\"message\":\"paymentSessionConfig.sdkAuthorization is required\"}")
            return
        }

        let session = PaymentSession(
            paymentSessionConfiguration: PaymentSessionConfiguration(sdkAuthorization: sdkAuthorization),
            hyperswitchConfiguration: hyperswitchConfig
        )
        activePaymentSession = session

        // Extract configuration (hiddenPaymentMethods, etc.) from params
        let configuration: SavedPaymentMethodsConfiguration?
        if let configDict = p["configuration"] as? [String: Any],
           let jsonData = try? JSONSerialization.data(withJSONObject: configDict),
           let config = try? JSONDecoder().decode(SavedPaymentMethodsConfiguration.self, from: jsonData) {
            configuration = config
        } else {
            configuration = nil
        }

        // Guard against double-resolving the promise when Metro reload invalidates the
        // old JS context and the session callback fires on the still-live old module.
        var didResolve = false
        let safeResolve: RCTPromiseResolveBlock = { value in
            DispatchQueue.main.async {
                guard !didResolve else { return }
                didResolve = true
                resolve(value)
            }
        }

        session.getCustomerSavedPaymentMethods({ [weak self] handler in
            self?.activePaymentSessionHandler = handler
            safeResolve("{\"code\":\"success\",\"message\":\"Saved payment methods is initialized\"}")
        }, configuration: configuration)
    }

    // MARK: - getCustomerLastUsedPaymentMethodData

    @objc(getCustomerLastUsedPaymentMethodDataWithResolve:reject:)
    public func getCustomerLastUsedPaymentMethodData(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let handler = activePaymentSessionHandler else {
            resolve("{\"status\":\"error\",\"message\":\"Payment session handler not initialized.\"}")
            return
        }

        let result = handler.getCustomerLastUsedPaymentMethodData()
        switch result {
        case .success(let paymentMethod):
            let jsonString = HyperswitchModule.toJSONString(paymentMethod.toDictionary())
            resolve(jsonString)
        case .failure(let error):
            let errorDict: [String: Any?] = [
                "status": "failed",
                "code": error.code,
                "message": error.message
            ]
            resolve(HyperswitchModule.toJSONString(errorDict))
        }
    }

    // MARK: - getCustomerDefaultSavedPaymentMethodData

    @objc(getCustomerDefaultSavedPaymentMethodDataWithResolve:reject:)
    public func getCustomerDefaultSavedPaymentMethodData(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let handler = activePaymentSessionHandler else {
            resolve("{\"status\":\"error\",\"message\":\"Payment session handler not initialized.\"}")
            return
        }

        let result = handler.getCustomerDefaultSavedPaymentMethodData()
        switch result {
        case .success(let paymentMethod):
            let jsonString = HyperswitchModule.toJSONString(paymentMethod.toDictionary())
            resolve(jsonString)
        case .failure(let error):
            let errorDict: [String: Any?] = [
                "status": "failed",
                "code": error.code,
                "message": error.message
            ]
            resolve(HyperswitchModule.toJSONString(errorDict))
        }
    }

    // MARK: - getCustomerSavedPaymentMethodData  ← NEW (not in prior iOS module)

    @objc(getCustomerSavedPaymentMethodDataWithResolve:reject:)
    public func getCustomerSavedPaymentMethodData(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let handler = activePaymentSessionHandler else {
            resolve("{\"status\":\"error\",\"message\":\"Payment session handler not initialized.\"}")
            return
        }

        let result = handler.getCustomerSavedPaymentMethodData()
        switch result {
        case .success(let paymentMethods):
            let dicts = paymentMethods.map { $0.toDictionary() }
            let jsonString = HyperswitchModule.toJSONString(dicts)
            resolve(jsonString)
        case .failure(let error):
            let errorDict: [String: Any?] = [
                "status": "failed",
                "code": error.code,
                "message": error.message
            ]
            resolve(HyperswitchModule.toJSONString(errorDict))
        }
    }

    // MARK: - confirmWithCustomerLastUsedPaymentMethod

    @objc(confirmWithCustomerLastUsedPaymentMethod:resolve:reject:)
    public func confirmWithCustomerLastUsedPaymentMethod(
        reactTag: Double,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let handler = activePaymentSessionHandler else {
            resolve(StandardResult.failed(error: NSError(domain: "NO_HANDLER", code: 0, userInfo: ["message": "Payment session handler not initialized."])).rawJSON)
            return
        }
        
        let tag = Int(reactTag)
        
        if tag > 0 {
            // CVC widget path: check if payment method requires CVC
            let result = handler.getCustomerLastUsedPaymentMethodData()
            switch result {
            case .success(let pm):
                if pm.requiresCvv && pm.paymentMethod == "card" {
                    // Route to CVC widget
                    confirmViaWidgetView(
                        reactTag: NSNumber(value: tag),
                        paymentToken: pm.paymentToken,
                        paymentMethodId: pm.paymentMethodId,
                        resolve: resolve
                    )
                } else {
                    // No CVC needed, confirm directly with payment token
                    handler.confirmWithCustomerPaymentToken(
                        paymentToken: pm.paymentToken
                    ) { paymentResult in
                        resolve(self.paymentResultToString(paymentResult))
                    }
                }
            case .failure(let error):
                resolve(StandardResult.failed(
                    code: error.code,
                    message: error.message,
                    error: NSError(domain: error.code, code: 0, userInfo: ["message": error.message])
                ).rawJSON)
            }
        } else {
            // No widget tag, get last payment method first
            let result = handler.getCustomerLastUsedPaymentMethodData()
            switch result {
            case .success(let pm):
                handler.confirmWithCustomerPaymentToken(
                    paymentToken: pm.paymentToken
                ) { paymentResult in
                    resolve(self.paymentResultToString(paymentResult))
                }
            case .failure(let error):
                resolve(StandardResult.failed(
                    code: error.code,
                    message: error.message,
                    error: NSError(domain: error.code, code: 0, userInfo: ["message": error.message])
                ).rawJSON)
            }
        }
    }

    // MARK: - confirmWithCustomerDefaultPaymentMethod

    @objc(confirmWithCustomerDefaultPaymentMethod:resolve:reject:)
    public func confirmWithCustomerDefaultPaymentMethod(
        reactTag: Double,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let handler = activePaymentSessionHandler else {
            resolve(StandardResult.failed(error: NSError(domain: "NO_HANDLER", code: 0, userInfo: ["message": "Payment session handler not initialized."])).rawJSON)
            return
        }
        
        let tag = Int(reactTag)
        
        if tag > 0 {
            // CVC widget path: check if payment method requires CVC
            let result = handler.getCustomerDefaultSavedPaymentMethodData()
            switch result {
            case .success(let pm):
                if pm.requiresCvv && pm.paymentMethod == "card" {
                    // Route to CVC widget
                    confirmViaWidgetView(
                        reactTag: NSNumber(value: tag),
                        paymentToken: pm.paymentToken,
                        paymentMethodId: pm.paymentMethodId,
                        resolve: resolve
                    )
                } else {
                    // No CVC needed, confirm directly with payment token
                    handler.confirmWithCustomerPaymentToken(
                        paymentToken: pm.paymentToken
                    ) { paymentResult in
                        resolve(self.paymentResultToString(paymentResult))
                    }
                }
            case .failure(let error):
                resolve(StandardResult.failed(
                    code: error.code,
                    message: error.message,
                    error: NSError(domain: error.code, code: 0, userInfo: ["message": error.message])
                ).rawJSON)
            }
        } else {
            // No widget tag, get default payment method first
            let result = handler.getCustomerDefaultSavedPaymentMethodData()
            switch result {
            case .success(let pm):
                handler.confirmWithCustomerPaymentToken(
                    paymentToken: pm.paymentToken
                ) { paymentResult in
                    resolve(self.paymentResultToString(paymentResult))
                }
            case .failure(let error):
                resolve(StandardResult.failed(
                    code: error.code,
                    message: error.message,
                    error: NSError(domain: error.code, code: 0, userInfo: ["message": error.message])
                ).rawJSON)
            }
        }
    }
    
    // MARK: - confirmWithCustomerPaymentToken
    
    @objc(confirmWithCustomerPaymentToken:token:resolve:reject:)
    public func confirmWithCustomerPaymentToken(
        reactTag: Double,
        token: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let handler = activePaymentSessionHandler else {
            resolve(StandardResult.failed(error: NSError(domain: "NO_HANDLER", code: 0, userInfo: ["message": "Payment session handler not initialized."])).rawJSON)
            return
        }
        
        // Direct confirm with the provided payment token (no CVC widget needed)
        handler.confirmWithCustomerPaymentToken(paymentToken: token) { paymentResult in
            resolve(self.paymentResultToString(paymentResult))
        }
    }
    
    // MARK: - checkApplePayReadiness

    /// PassKit network name (as used in the JS-side default request) → PKPaymentNetwork.
    private static let supportedNetworksByName: [String: PKPaymentNetwork] = [
        "visa": .visa,
        "masterCard": .masterCard,
        "amex": .amex,
        "discover": .discover,
        "jcb": .JCB,
        "chinaUnionPay": .chinaUnionPay,
        "interac": .interac,
        "maestro": .maestro,
        "mada": .mada,
        "elo": .elo,
        "cartesBancaires": .cartesBancaires,
    ]

    /// Device-level Apple Pay readiness check (`PKPaymentAuthorizationController.canMakePayments`).
    /// Reflects device capability only, not merchant/connector configuration.
    @objc(checkApplePayReadiness:resolve:reject:)
    public func checkApplePayReadiness(
        supportedNetworksJson: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard
            let data = supportedNetworksJson.data(using: .utf8),
            let names = try? JSONDecoder().decode([String].self, from: data)
        else {
            resolve(PKPaymentAuthorizationController.canMakePayments())
            return
        }

        let networks = names.compactMap { NativeHyperswitchModuleImpl.supportedNetworksByName[$0] }

        if networks.isEmpty {
            resolve(PKPaymentAuthorizationController.canMakePayments())
        } else {
            resolve(PKPaymentAuthorizationController.canMakePayments(usingNetworks: networks))
        }
    }

    // MARK: - Private Helper: paymentResultToString
    
    private func paymentResultToString(_ result: PaymentResult) -> String {
        switch result {
        case .completed(let data):
            return data
        case .canceled(let data):
            return data
        case .failed(let error):
            let nsError = error as NSError
            if let rawJSON = nsError.userInfo["rawJSON"] as? String {
                return rawJSON
            }
            // Fallback: construct error JSON
            let errorDict: [String: Any?] = [
                "status": "failed",
                "code": nsError.domain.isEmpty ? "UNKNOWN_ERROR" : nsError.domain,
                "message": nsError.userInfo["message"] as? String ?? error.localizedDescription
            ]
            return HyperswitchModule.toJSONString(errorDict)
        }
    }
    
    // MARK: - Private Helper: confirmViaWidgetView
   
    private func confirmViaWidgetView(
        reactTag: NSNumber,
        paymentToken: String,
        paymentMethodId: String,
        resolve: @escaping RCTPromiseResolveBlock
    ) {
        guard let handler = activePaymentSessionHandler else {
            resolve(StandardResult.failed(code: "NO_HANDLER", message: "Payment session handler not initialized.").rawJSON)
            return
        }
        
        // Registry lookup (Fabric / New Architecture).
        guard let view = NativePaymentWidgetRegistry.shared.view(forTag: reactTag) else {
            resolve(StandardResult.failed(code: "NO_WIDGET", message: "CvcWidget not found at reactTag \(reactTag)").rawJSON)
            return
        }

        guard let cvcWidget = view.cvcWidgetRef else {
            resolve(StandardResult.failed(code: "NO_CVC_WIDGET", message: "CVCWidget instance not found in view").rawJSON)
            return
        }

        // Handler calls cvcWidget.confirm() → embedded bundle → exitHeadless → resultHandler callback.
        handler.confirmWithCustomerLastUsedPaymentMethod(cvcWidget) { paymentResult in
            resolve(self.paymentResultToString(paymentResult))
        }
    }
}
