//
//  PaymentEventType.swift
//  Hyperswitch
//
//  Created by Harshit Srivastava on 21/04/26.
//

import Foundation

public enum PaymentEventType: String, CaseIterable, Sendable {
    case paymentMethodInfoCard = "cardDetailsChange"
    case paymentMethodStatus = "paymentMethodChange"
    case formStatus = "formStatusChange"
    case paymentMethodInfoBillingAddress = "billingDetailsChange"
    case cvcStatus = "cvcStatusChange"
}

public struct PaymentEvent {
    public let type: String
    public let payload: [String: Any]

    public var data: PaymentEventData? {
        PaymentEventData.from(type: type, payload: payload)
    }

    public init(type: String, payload: [String: Any]) {
        self.type = type
        self.payload = payload
    }
}
