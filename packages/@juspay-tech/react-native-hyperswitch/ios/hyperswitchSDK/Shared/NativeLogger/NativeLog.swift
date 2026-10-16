//
//  NativeLog.swift
//  hyperswitch
//

import Foundation
import UIKit

/// Native SDK lifecycle logs sent through `LogManager`. Same shape as Android's `NativeLog`:
///  - event_name         RN_SDK_LIFE_CYCLE
///  - value              a stable snake_case event id (filterable, no variable data)
///  - internal_metadata  a JSON object with the event's details, plus `app_state` and `orientation`
///  - source             "native"
///
/// Never throws. Builds on the main thread because it reads UIKit state.
internal enum NativeLog {
    private static let source = "native"

    /// Payment of the latest session the SDK was asked about; nil until the first one.
    private static var paymentId: String?
    private static let paymentIdLock = NSLock()

    /// Every later log carries the payment id read from `sdkAuthorization`.
    static func setSdkAuthorization(_ sdkAuthorization: String?) {
        let id = paymentId(from: sdkAuthorization)
        paymentIdLock.lock()
        paymentId = id
        paymentIdLock.unlock()
    }

    private static func currentPaymentId() -> String {
        paymentIdLock.lock()
        defer { paymentIdLock.unlock() }
        return paymentId ?? ""
    }

    /// Same rule as client-core's Utils.getSdkAuthorizationData: base64 "key=value,..." pairs,
    /// payment_id, else the client_secret part before "_secret_".
    private static func paymentId(from sdkAuthorization: String?) -> String? {
        guard var base64 = sdkAuthorization, !base64.isEmpty else { return nil }
        base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
        guard let data = Data(base64Encoded: base64),
              let decoded = String(data: data, encoding: .utf8) else { return nil }
        var fields: [String: String] = [:]
        for pair in decoded.split(separator: ",") {
            guard let i = pair.firstIndex(of: "="), i != pair.startIndex else { continue }
            fields[String(pair[..<i])] = String(pair[pair.index(after: i)...])
        }
        if let id = fields["payment_id"], !id.isEmpty { return id }
        guard let secret = fields["client_secret"] else { return nil }
        let id = secret.components(separatedBy: "_secret_")[0]
        return id.isEmpty ? nil : id
    }

    static func debug(_ event: String, _ details: [String: Any?] = [:]) { send(.DEBUG, event, details) }
    static func warning(_ event: String, _ details: [String: Any?] = [:]) { send(.WARNING, event, details) }
    static func error(_ event: String, _ details: [String: Any?] = [:]) { send(.ERROR, event, details) }

    private static func send(_ type: LogType, _ event: String, _ details: [String: Any?]) {
        let build = {
            var metadata: [String: Any] = details.compactMapValues { $0 }
            metadata["app_state"] = appState()
            metadata["orientation"] = orientation()
            let json = (try? JSONSerialization.data(withJSONObject: metadata, options: [.sortedKeys]))
                .flatMap { String(data: $0, encoding: .utf8) } ?? ""
            let log = LogBuilder()
                .setLogType(type.rawValue)
                .setCategory(.API)
                .setEventName(.rnSdkLifeCycle)
                .setValue(event)
                .setPaymentId(currentPaymentId())
                .setInternalMetadata(json)
                .setAppId(Bundle.main.bundleIdentifier)
                .setSource(source)
                .build()
            LogManager.addLog(log)
        }
        if Thread.isMainThread { build() } else { DispatchQueue.main.async(execute: build) }
    }

    private static func appState() -> String {
        switch UIApplication.shared.applicationState {
        case .active: return "active"
        case .inactive: return "inactive"
        case .background: return "background"
        @unknown default: return "unknown"
        }
    }

    private static func orientation() -> String {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        switch scene?.interfaceOrientation {
        case .portrait: return "portrait"
        case .portraitUpsideDown: return "portraitUpsideDown"
        case .landscapeLeft: return "landscapeLeft"
        case .landscapeRight: return "landscapeRight"
        default: return "unknown"
        }
    }
}
