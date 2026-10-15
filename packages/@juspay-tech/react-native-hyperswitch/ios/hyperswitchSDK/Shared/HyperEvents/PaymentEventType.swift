//
//  PaymentEventType.swift
//  Hyperswitch
//
//  Created by Harshit Srivastava on 21/04/26.
//

import Foundation

public enum PaymentEventType: String, CaseIterable, Sendable {
    case cardDetailsChange = "cardDetailsChange"
    case paymentMethodChange = "paymentMethodChange"
    case formStatusChange = "formStatusChange"
    case billingDetailsChange = "billingDetailsChange"
    case cvcStatusChange = "cvcStatusChange"
}

public struct PaymentEvent {
    public let eventName: String
    public let payload: [String: Any]

    public var data: PaymentEventData? {
        PaymentEventData.from(type: eventName, payload: payload)
    }

    public init(eventName: String, payload: [String: Any]) {
        self.eventName = eventName
        self.payload = payload
    }
}
