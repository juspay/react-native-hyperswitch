
import Foundation
import UIKit
import HyperswitchScanCard

@objc public class HyperswitchScancardImpl: NSObject {

    @objc public func launchScanCard(from viewController: UIViewController,
                                     callback: @escaping ([String: Any]) -> Void) {
        var message: [String: Any] = [:]
        var response: [String: Any] = [:]
        let cardScanSheet = CardScanSheet()
        cardScanSheet.present(from: viewController) { result in

            switch result {
            case .completed(let card as ScannedCard?):
                message["pan"] = card?.pan
                message["expiryMonth"] = card?.expiryMonth
                message["expiryYear"] = card?.expiryYear
                response["status"] = "Succeeded"
                response["data"] = message
            case .canceled:
                response["status"] = "Cancelled"
            case .failed:
                response["status"] = "Failed"
            }
            callback(response)
        }
    }
}
