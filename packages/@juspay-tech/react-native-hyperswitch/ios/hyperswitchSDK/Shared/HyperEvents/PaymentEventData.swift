//
//  PaymentEventData.swift
//  Hyperswitch
//
//  Created by Harshit Srivastava on 21/04/26.
//

import Foundation

public enum PaymentEventData {

    case cardDetailsChange(CardDetailsChange)
    case paymentMethodChange(PaymentMethodChange)
    case formStatusChange(FormStatusChange)
    case billingDetailsChange(BillingDetailsChange)
    case cvcStatusChange(CvcStatusChange)

    public struct CardDetailsChange: Sendable {
        public let bin: String?
        public let extendedBin: String?
        public let last4: String?
        public let brand: String?
        public let expiryMonth: String?
        public let expiryYear: String?
        public let formattedExpiry: String?
        public let isCardNumberComplete: Bool
        public let isCvcComplete: Bool
        public let isExpiryComplete: Bool
        public let isCardNumberValid: Bool
        public let isExpiryValid: Bool

        static func from(_ map: [String: Any]) -> CardDetailsChange {
            CardDetailsChange(
                bin: map["bin"] as? String,
                extendedBin: map["extendedBin"] as? String,
                last4: map["last4"] as? String,
                brand: map["brand"] as? String,
                expiryMonth: map["expiryMonth"] as? String,
                expiryYear: map["expiryYear"] as? String,
                formattedExpiry: map["formattedExpiry"] as? String,
                isCardNumberComplete: map["isCardNumberComplete"] as? Bool ?? false,
                isCvcComplete: map["isCvcComplete"] as? Bool ?? false,
                isExpiryComplete: map["isExpiryComplete"] as? Bool ?? false,
                isCardNumberValid: map["isCardNumberValid"] as? Bool ?? false,
                isExpiryValid: map["isExpiryValid"] as? Bool ?? false
            )
        }
    }

    public struct PaymentMethodChange: Sendable {
        public let paymentMethod: String
        public let paymentMethodType: String
        public let isSavedPaymentMethod: Bool
        public let isOneClickWallet: Bool

        static func from(_ map: [String: Any]) -> PaymentMethodChange {
            PaymentMethodChange(
                paymentMethod: map["paymentMethod"] as? String ?? "",
                paymentMethodType: map["paymentMethodType"] as? String ?? "",
                isSavedPaymentMethod: map["isSavedPaymentMethod"] as? Bool ?? false,
                isOneClickWallet: map["isOneClickWallet"] as? Bool ?? false
            )
        }
    }

    public enum FormStatusValue: String, Sendable {
        case empty = "EMPTY"
        case filling = "FILLING"
        case complete = "COMPLETE"
    }

    public struct FormStatusChange: Sendable {
        public let status: FormStatusValue?

        static func from(_ map: [String: Any]) -> FormStatusChange {
            FormStatusChange(status: (map["status"] as? String).flatMap(FormStatusValue.init(rawValue:)))
        }
    }

    public struct BillingDetailsChange: Sendable {
        public let country: String
        public let state: String
        public let postalCode: String

        static func from(_ map: [String: Any]) -> BillingDetailsChange {
            BillingDetailsChange(
                country: map["country"] as? String ?? "",
                state: map["state"] as? String ?? "",
                postalCode: map["postalCode"] as? String ?? ""
            )
        }
    }

    public struct CvcStatusChange: Sendable {
        public let isCvcEmpty: Bool
        public let isCvcComplete: Bool

        static func from(_ map: [String: Any]) -> CvcStatusChange {
            let source = (map["cvcStatus"] as? [String: Any]) ?? map
            return CvcStatusChange(
                isCvcEmpty: source["isCvcEmpty"] as? Bool ?? true,
                isCvcComplete: source["isCvcComplete"] as? Bool ?? false
            )
        }
    }

    public static func from(type: String, payload: [String: Any]) -> PaymentEventData? {
        switch type {
        case PaymentEventType.cardDetailsChange.rawValue:
            return .cardDetailsChange(.from(payload))
        case PaymentEventType.paymentMethodChange.rawValue:
            return .paymentMethodChange(.from(payload))
        case PaymentEventType.formStatusChange.rawValue:
            return .formStatusChange(.from(payload))
        case PaymentEventType.billingDetailsChange.rawValue:
            return .billingDetailsChange(.from(payload))
        case PaymentEventType.cvcStatusChange.rawValue:
            return .cvcStatusChange(.from(payload))
        default:
            return nil
        }
    }
}
