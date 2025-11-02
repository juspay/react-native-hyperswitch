import Foundation
import Trident

@objc(HyperswitchTrident3ds)
class HyperswitchTrident3ds: NSObject {
  private lazy var tridentSdk = {
    TridentSDK()
  }()
  private let challengeParameters = ChallengeParameters()
  private var transaction: Transaction? = nil
  private var vc: UIViewController?
  private let doChallengeTimeOut: Int = 5
  
  @objc
  func initialiseSDK(_ apiKey: String,
                            _ hsSDKEnvironment: String,
                            _ callback: @escaping RCTResponseSenderBlock) {
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
  func generateAReqParams(_ messageVersion: String,
                          _ directoryServerId: String,
                          _ cardNetwork: String,
                          _ callback: @escaping RCTResponseSenderBlock) {
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
  func receiveChallengeParamsFromRN(_ acsSignedContent: String,
                                    _ acsRefNumber: String,
                                    _ acsTransactionId: String,
                                    _ threeDSRequestorAppURL: String?,
                                    _ threeDSServerTransId: String,
                                    _ callback: @escaping RCTResponseSenderBlock) {
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
  func generateChallenge(_ callback: @escaping RCTResponseSenderBlock) {
    DispatchQueue.main.async {
      do {
        guard let viewController = RCTPresentedViewController() else {
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
