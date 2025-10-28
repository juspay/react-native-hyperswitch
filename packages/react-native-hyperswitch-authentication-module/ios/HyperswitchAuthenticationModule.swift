import HyperswitchAuthentication

@objc(HyperswitchAuthenticationModule)
class HyperswitchAuthenticationModule: NSObject {
  private var authSession: AuthenticationSession?
  private var authConfiguration: AuthenticationConfiguration?
  private var transaction: Transaction?
  private var challengeParameters: ChallengeParameters?
  private let vc = RCTPresentedViewController()
  private let challengeStatusReceiver = HyperswitchChallengeManager()
  
  @objc
  func initializeThreeDS(
    _ configuration: NSDictionary,
    _ hsSDKEnvironment: String,
    _ callback: @escaping RCTResponseSenderBlock) {
      var initStatus: [String:Any] = [:];
      
      guard let _publishableKey = configuration["publishableKey"] as? String else {
        initStatus["status"] = "failure";
        initStatus["message"] = "sdk initialization failed: Publishable key missing";
        callback([initStatus]);
        return
      }
      
      self.authSession = AuthenticationSession(
        publishableKey: _publishableKey
      )
      
      let _provider: ProviderType? = switch configuration["provider"] as? String {
      case "cardinal":
          .cardinal
      case "netcetera":
          .netcetera
      case "trident":
          .trident
      default:
        nil
      }
      
      let _apiKey: String? = switch _provider {
      case .cardinal:
        configuration["jwtToken"] as? String
      case .netcetera:
        configuration["netceteraSdkApiKey"] as? String
      default:
        nil
      }
      
      let _env: EnvironmentType = switch hsSDKEnvironment.uppercased() {
      case "SANDBOX", "INTEG":
          .sandbox
      case "PROD":
          .production
      default:
          .sandbox
      }
      
      self.authConfiguration = AuthenticationConfiguration(
        apiKey: _apiKey,
        preferredProvider: _provider,
        environment: _env
      )
      
      let clientSecret = configuration["authIntentClientSecret"] as? String ?? "auth_intent_placeholder"
      
      Task {
        do {
          try await authSession?.initThreeDsSession(
            authIntentClientSecret: clientSecret,
            configuration: self.authConfiguration
          )
          
          await MainActor.run {
            initStatus["status"] = "success"
            initStatus["message"] = "sdk initialization successful"
            callback([initStatus])
          }
        } catch {
          await MainActor.run {
            initStatus["status"] = "failure"
            initStatus["message"] = "sdk initialization failed: \(error.localizedDescription)"
            callback([initStatus])
          }
        }
      }
    }
  
  @objc
  func generateAReqParams(
    _ messageVersion: String,
    _ directoryServerId: String?,
    _ cardBrand: String?,
    _ callback: @escaping RCTResponseSenderBlock
  ) {
    var response: [String: Any] = [:]
    
    Task {
      do {
        guard let authSession = self.authSession else {
          await MainActor.run {
            response["status"] = "error"
            response["message"] = "Authentication session not initialized"
            callback([response])
          }
          return
        }
        
        let _transaction = try await authSession.createTransaction(
          messageVersion: messageVersion,
          directoryServerId: directoryServerId,
          cardNetwork: cardBrand
        )
        self.transaction = _transaction
        
        let _aReqParams = try await _transaction.getAuthenticationRequestParameters()
        
        await MainActor.run {
          var authReqMap: [String: String] = [:]
          authReqMap["deviceData"] = _aReqParams.deviceData ?? ""
          authReqMap["messageVersion"] = _aReqParams.messageVersion ?? ""
          authReqMap["sdkTransId"] = _aReqParams.sdkTransactionID ?? ""
          authReqMap["sdkAppId"] = _aReqParams.sdkAppID ?? ""
          authReqMap["sdkEphemeralKey"] = _aReqParams.sdkEphemeralPublicKey ?? ""
          authReqMap["sdkReferenceNo"] = _aReqParams.sdkReferenceNumber ?? ""
          authReqMap["sdkEncryptedData"] = _aReqParams.sdkEncryptedData ?? ""
          
          response["status"] = "success"
          response["message"] = "AReq Params generation successful"
          callback([response, authReqMap])
        }
      } catch {
        await MainActor.run {
          response["status"] = "error"
          response["message"] = "AReq Params generation failure. Error: \(error.localizedDescription)"
          callback([response])
        }
      }
    }
  }
  
  @objc
  func recieveChallengeParamsFromRN(
    _ acsSignedContent: String,
    _ acsRefNumber: String,
    _ acsTransactionId: String,
    _ threeDSRequestorAppURL: String?,
    _ threeDSServerTransId: String,
    _ callback: @escaping RCTResponseSenderBlock
  ) {
    let _challengeParameters = ChallengeParameters(
      threeDSServerTransactionID: threeDSServerTransId,
      acsTransactionID: acsTransactionId,
      acsRefNumber: acsRefNumber,
      acsSignedContent: acsSignedContent,
      threeDSRequestorAppURL: threeDSRequestorAppURL
    )
    self.challengeParameters = _challengeParameters
    
    var response: [String: Any] = [:]
    response["status"] = "success"
    response["message"] = "challenge params receive successful"
    callback([response])
  }
  
  @objc
  func generateChallenge(
    _ callback: @escaping RCTResponseSenderBlock
  ) {
    DispatchQueue.main.async {
      guard let challengeParams = self.challengeParameters,
            let transaction = self.transaction,
            let vc = self.vc
      else {
        var map: [String: String] = [:]
        map["status"] = "error"
        map["message"] = "doChallenge call unsuccessful - missing parameters or transaction"
        callback([map])
        return
      }
      
      do {
        try transaction.doChallenge(
          viewController: vc,
          challengeParameters: challengeParams,
          challengeStatusReceiver: self.challengeStatusReceiver,
          timeOut: 5
        )
        
        // Initial success response - actual challenge result comes via challengeStatusReceiver
        var map: [String: String] = [:]
        map["status"] = "success"
        map["message"] = "Challenge flow initiated"
        callback([map])
      } catch {
        var map: [String: String] = [:]
        map["status"] = "error"
        map["message"] = "Failed to start challenge: \(error.localizedDescription)"
        callback([map])
      }
    }
  }
}
