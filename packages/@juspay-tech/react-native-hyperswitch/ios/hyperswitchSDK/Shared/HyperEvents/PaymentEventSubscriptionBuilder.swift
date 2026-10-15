import Foundation

internal struct PaymentEventListener {
    let onPaymentEvent: (PaymentEvent) -> Void
}
