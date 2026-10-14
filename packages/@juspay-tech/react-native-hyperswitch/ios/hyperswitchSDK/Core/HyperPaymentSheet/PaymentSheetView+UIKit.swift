//
//  PaymentSheetView+UIKit.swift
//  Hyperswitch
//
//  Created by Harshit Srivastava on 15/12/23.
//

import Foundation
import React

/// Extension on the PaymentSheet class to handle the presentation of the payment sheet view.
internal extension PaymentSheet {

    /// Present with a raw-string completion — the JS bundle's exit message is forwarded
    /// unchanged to the caller. Used by the React Native TurboModule path.
    private func presentWithRootView(
        from presentingViewController: UIViewController,
        rootView: UIView,
        completion: @escaping (String) -> Void
    ) {
        self.completion = completion

        let paymentSheetViewController = HyperUIViewController()
        paymentSheetViewController.paymentSheet = self
        paymentSheetViewController.modalPresentationStyle = .overFullScreen
        paymentSheetViewController.view = rootView

        presentingViewController.present(paymentSheetViewController, animated: false)
    }

    // MARK: - Public-facing helpers (PaymentResult overloads kept for SwiftUI / native SDK usage)

    /// Present with a typed `PaymentResult` — the result is serialised to a JSON string
    /// internally so the single `completion: ((String) -> Void)?` property is shared.
    func present(
        from presentingViewController: UIViewController,
        completion: @escaping (PaymentResult) -> Void
    ) {
        presentWithRootView(
            from: presentingViewController,
            rootView: getRootView(),
            completion: { raw in completion(PaymentSheet.paymentResult(from: raw)) }
        )
    }

    /// Present with custom props and a typed `PaymentResult` completion.
    func presentWithParams(
        from presentingViewController: UIViewController,
        props: [String: Any],
        completion: @escaping (PaymentResult) -> Void
    ) {
        presentWithRootView(
            from: presentingViewController,
            rootView: getRootViewWithParams(props: props),
            completion: { raw in completion(PaymentSheet.paymentResult(from: raw)) }
        )
    }

    // MARK: - Internal raw-string overloads (used by HyperswitchModule / TurboModule path)

    /// Present with default configuration and a raw-string completion.
    func present(
        from presentingViewController: UIViewController,
        rawCompletion: @escaping (String) -> Void
    ) {
        presentWithRootView(
            from: presentingViewController,
            rootView: getRootView(),
            completion: rawCompletion
        )
    }

    /// Present with custom props and a raw-string completion.
    func presentWithParams(
        from presentingViewController: UIViewController,
        props: [String: Any],
        rawCompletion: @escaping (String) -> Void
    ) {
        presentWithRootView(
            from: presentingViewController,
            rootView: getRootViewWithParams(props: props),
            completion: rawCompletion
        )
    }

    // MARK: - Shared result deserialiser

    /// Convert the raw JSON string sent by the JS bundle into a typed `PaymentResult`.
    /// Mirrors the logic in `HyperModuleImpl.paymentResult(from:)`.
    private static func paymentResult(from raw: String) -> PaymentResult {
        guard
            let data = raw.data(using: .utf8),
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let status = dict["status"] as? String
        else {
            return .failed(error: NSError(domain: "UNKNOWN_ERROR", code: 0,
                                          userInfo: ["message": "An error has occurred."]))
        }
        switch status {
        case "success", "succeeded", "completed", "requires_capture":
            return .completed(data: raw)  // Pass raw JSON string, not just status
        case "cancelled", "canceled":
            return .canceled(data: raw)   // Pass raw JSON string, not just status
        default:
            // Failed result - preserve original raw JSON for JS layer
            let code    = (dict["code"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "UNKNOWN_ERROR"
            let message = dict["message"] as? String ?? "An error has occurred."
            
            // Store raw JSON in userInfo so it can be passed to JS without data loss
            return .failed(error: NSError(domain: code, code: 0, userInfo: [
                "message": message,
                "rawJSON": raw  // Preserve original JSON with all fields (type_, etc.)
            ]))
        }
    }
}
