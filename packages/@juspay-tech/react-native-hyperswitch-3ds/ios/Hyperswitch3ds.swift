//
//  Hyperswitch3ds.swift
//  
//
//  Created by Shivam Nan on 12/11/25.
//

import HyperswitchAuthentication

@objc(Hyperswitch3ds)
class Hyperswitch3ds: NSObject {
    private var authSession: AuthenticationSession?
    private var threeDSSession: ThreeDSSession?
    private var authConfiguration: AuthenticationConfiguration?
    private var transaction: Transaction?
    private var challengeParameters: ChallengeParameters?
    private let vc = RCTPresentedViewController()
    private let challengeStatusReceiver = Hyperswitch3dsChallengeManager()
    
    @objc
    func initializeThreeDS(
        _ configuration: NSDictionary,
        _ hsSDKEnvironment: String,
        _ callback: @escaping RCTResponseSenderBlock) {
            
            guard let _publishableKey = configuration["publishableKey"] as? String else {
                let initStatus: [String:Any] = [
                    "status": "failure",
                    "message": "sdk initialization failed: Publishable key missing"
                ]
                callback([initStatus])
                return
            }
            
            self.authSession = AuthenticationSession(
                publishableKey: _publishableKey
            )
            
            let _provider: ThreeDSProviderType? = switch configuration["provider"] as? String {
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
                    .production
            }
            
            self.authConfiguration = AuthenticationConfiguration(
                apiKey: _apiKey,
                preferredProvider: _provider,
                environment: _env
            )
            
            let clientSecret = configuration["authIntentClientSecret"] as? String ?? "client_secret_placeholder"
            
            Task {
                do {
                    self.threeDSSession = try await authSession?.initThreeDSSession(
                        authIntentClientSecret: clientSecret,
                        configuration: self.authConfiguration
                    )
                    
                    await MainActor.run {
                        let initStatus: [String:Any] = [
                            "status": "success",
                            "message": "sdk initialization successful"
                        ]
                        callback([initStatus])
                    }
                } catch {
                    await MainActor.run {
                        let initStatus: [String:Any] = [
                            "status": "failure",
                            "message": "sdk initialization failed: \(error.localizedDescription)"
                        ]
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
        Task {
            do {
                guard let threeDSSession = threeDSSession else {
                    await MainActor.run {
                        let response: [String: Any] = [
                            "status": "error",
                            "message": "ThreeDS session not initialized"
                        ]
                        callback([response])
                    }
                    return
                }
                
                let _transaction = try await threeDSSession.createTransaction(
                    messageVersion: messageVersion,
                    directoryServerId: directoryServerId,
                    cardNetwork: cardBrand
                )
                self.transaction = _transaction
                
                let _aReqParams = try await _transaction.getAuthenticationRequestParameters()
                
                await MainActor.run {
                    let authReqMap: [String: String] = [
                        "deviceData": _aReqParams.deviceData ?? "",
                        "messageVersion": _aReqParams.messageVersion ?? "",
                        "sdkTransId": _aReqParams.sdkTransactionID ?? "",
                        "sdkAppId": _aReqParams.sdkAppID ?? "",
                        "sdkEphemeralKey": _aReqParams.sdkEphemeralPublicKey ?? "",
                        "sdkReferenceNo": _aReqParams.sdkReferenceNumber ?? "",
                        "sdkEncryptedData": _aReqParams.sdkEncryptedData ?? ""
                    ]
                    
                    let response: [String: Any] = [
                        "status": "success",
                        "message": "AReq Params generation successful"
                    ]
                    callback([response, authReqMap])
                }
            } catch {
                await MainActor.run {
                    let response: [String: Any] = [
                        "status": "error",
                        "message": "AReq Params generation failure. Error: \(error.localizedDescription)"
                    ]
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
        
        let response: [String: Any] = [
            "status": "success",
            "message": "challenge params receive successful"
        ]
        callback([response])
    }
    
    @objc
    func generateChallenge(
        _ callback: @escaping RCTResponseSenderBlock
    ) {
        self.challengeStatusReceiver.setPostHSChallengeCallback(callback)
        
        DispatchQueue.global().async {
            guard let challengeParams = self.challengeParameters,
                  let transaction = self.transaction,
                  let vc = self.vc
            else {
                let map: [String: String] = [
                    "status": "error",
                    "message": "doChallenge call unsuccessful - missing parameters or transaction"
                ]
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
            } catch {
                let map: [String: String] = [
                    "status": "error",
                    "message": "Failed to start challenge: \(error.localizedDescription)"
                ]
                callback([map])
            }
        }
    }
}
