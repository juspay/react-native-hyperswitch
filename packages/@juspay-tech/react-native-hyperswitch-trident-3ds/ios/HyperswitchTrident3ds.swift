import Foundation
import UIKit
import Trident

@objc public class HyperswitchTrident3dsImpl: NSObject {
  private lazy var tridentSdk = {
    TridentSDK()
  }()
  private let challengeParameters = ChallengeParameters()
  private var transaction: Transaction? = nil
  private var vc: UIViewController?
  private let doChallengeTimeOut: Int = 5
  
  @objc
  public func initialiseSDK(_ apiKey: String,
                            hsSDKEnvironment: String,
                            callback: @escaping ([Any]) -> Void) {
    do {
      try tridentSdk.initialize(configParameters: ConfigParameters(), locale: nil, uiCustomization: UICustomization(), certificateDelegate: nil)
    } catch let error as NSError {
      var errResponse: [String:Any] = [:];
      errResponse["status"] = "failure";
      errResponse["message"] = "Initialization failed:" + error.localizedDescription;
      callback([errResponse]);
      return
    }
    
    var initResponse: [String:Any] = [:]
    initResponse["status"] = "success"
    initResponse["message"] = "trident sdk initialization successful."
    callback([initResponse])
    return
  }
  
  @objc
  public func generateAReqParams(_ messageVersion: String,
                                 directoryServerId: String,
                                 cardNetwork: String,
                                 callback: @escaping ([Any]) -> Void) {
    do {
      let _directoryServerId = try tridentSdk.getDirectoryServerId(cardNetwork: cardNetwork.uppercased(with: .autoupdatingCurrent))
      let transaction = try tridentSdk.createTransaction(
        directoryServerId: _directoryServerId,
        messageVersion: messageVersion
      )
      self.transaction = transaction
      let aReqParams = try transaction.getAuthenticationRequestParameters()
      
      var authParams: [String: String] = [:]
      authParams["deviceData"] = aReqParams.deviceData
      authParams["messageVersion"] = aReqParams.messageVersion
      authParams["sdkTransId"] = aReqParams.sdkTransactionID
      authParams["sdkAppId"] = aReqParams.sdkAppID
      authParams["sdkEphemeralKey"] = aReqParams.sdkEphemeralPublicKey
      authParams["sdkReferenceNo"] = aReqParams.sdkReferenceNumber
      
      var response: [String: Any] = [:]
      response["status"] = "success"
      response["message"] = "AReq params generation successful."
      callback([response, authParams])
    } catch let error as NSError {
      var errResponse: [String: Any] = [:]
      errResponse["status"] = "error"
      errResponse["message"] = "AReq Params generation failure. Error: \(error)"
      callback([errResponse])
    }
  }
  
  @objc
  public func receiveChallengeParamsFromRN(_ acsSignedContent: String,
                                           acsRefNumber: String,
                                           acsTransactionId: String,
                                           threeDSRequestorAppURL: String?,
                                           threeDSServerTransId: String,
                                           callback: @escaping ([Any]) -> Void) {
    self.challengeParameters.acsSignedContent = acsSignedContent
    self.challengeParameters.acsRefNumber = acsRefNumber
    self.challengeParameters.acsTransactionID = acsTransactionId
    self.challengeParameters.threeDSServerTransactionID = threeDSServerTransId
    if let url = threeDSRequestorAppURL {
      self.challengeParameters.threeDSRequestorAppURL = url
    }
    
    var response: [String:Any] = [:]
    response["status"] = "success"
    response["message"] = "challenge params recieved successfully."
    callback([response])
  }
  
  @objc
  public func generateChallenge(from viewController: UIViewController?,
                                callback: @escaping ([Any]) -> Void) {
    DispatchQueue.main.async {
      do {
        guard let viewController = viewController else {
          var errResponse: [String: String] = [:]
          errResponse["status"] = "error"
          errResponse["message"] = "doChallenge call unsuccessful, viewController not found."
          callback([errResponse])
          return
        }
        
        guard let transaction = self.transaction else {
          var errResponse: [String: String] = [:]
          errResponse["status"] = "error"
          errResponse["message"] = "doChallenge call unsuccessful, transaction not found."
          callback([errResponse])
          return
        }
        let challengeStatusReceiver = TridentChallengeStatusReceiver.init(transactionRef: transaction, completion: callback)
        
        try transaction.doChallenge(
          viewController: viewController,
          challengeParameters: self.challengeParameters,
          challengeStatusReceiver: challengeStatusReceiver,
          timeOut: self.doChallengeTimeOut
        )
      } catch let error as NSError {
        var errResponse: [String: String] = [:]
        errResponse["status"] = "error"
        errResponse["message"] = error.localizedDescription
        callback([errResponse])
      }
    }
  }
}
