//
//  HyperswitchNetcetera3ds.swift
//  HyperswitchNetcetera3ds
//
//  Created by Harshit Srivastava on 17/07/24.
//

import Foundation
import UIKit
import ThreeDS_SDK

@objc public class HyperswitchNetcetera3dsImpl: NSObject {
    private let challengeStatusReceiver: HyperswitchChallengeManager = HyperswitchChallengeManager()
    
    private let threeDS2Service: ThreeDS2Service = ThreeDS2ServiceSDK()
    private var configParams: ConfigParameters?
    private var challengeParams: ChallengeParameters?
    private var transaction: Transaction?
    private var progressView: ProgressDialog?
    
    private var vc: UIViewController?
    private var hsSDKEnvironment: String?
    
    @objc
    public func initialiseNetceteraSDK(_ apiKey: String,
                                       hsSDKEnvironment: String,
                                       callback: @escaping ([String: Any]) -> Void) {
        var initStatus: [String:Any] = [:];
        
        do {
            let configBuilder = ConfigurationBuilder()
            
            try configBuilder.api(key: apiKey)
            
            if (hsSDKEnvironment == "SANDBOX" || hsSDKEnvironment == "INTEG") {
                let acquiringRootCertificates = ["nca_demo_root.crt"]
                
                let visa = Scheme.visa()
                visa.rootCertificateValues = acquiringRootCertificates
                try configBuilder.add(visa)
                
                let mastercard = Scheme.mastercard()
                mastercard.rootCertificateValues = acquiringRootCertificates
                try configBuilder.add(mastercard)
                
                let amex = Scheme.amex()
                amex.rootCertificateValues = acquiringRootCertificates
                try configBuilder.add(amex)
                
                let diners = Scheme.diners()
                diners.rootCertificateValues = acquiringRootCertificates
                try configBuilder.add(diners)
                
                let jcb = Scheme.jcb()
                diners.rootCertificateValues = acquiringRootCertificates
                try configBuilder.add(jcb)
                
                let union = Scheme.union()
                union.rootCertificateValues = acquiringRootCertificates
                try configBuilder.add(union)
            }
            
            self.configParams = configBuilder.configParameters();
            
            DispatchQueue.global().async {
                guard let configParams = self.configParams else {
                    initStatus["status"] = "failure";
                    initStatus["message"] = "netcetera sdk initialization failed";
                    callback(initStatus)
                    return
                }
                
                self.threeDS2Service.initialize(configParams,
                                                locale: "en",
                                                uiCustomizationMap: [:],
                                                success: {
                    initStatus["status"] = "success"
                    initStatus["message"] = "netcetera sdk initialization successful"
                    callback(initStatus)
                },
                                                failure: { error in
                    if (error.localizedDescription == "The SDK is already initialized") {
                        initStatus["status"] = "success";
                        initStatus["message"] = "netcetera sdk initialization successful";
                        callback(initStatus)
                    }
                    else{
                        initStatus["status"] = "failure";
                        initStatus["message"] = "netcetera sdk initialization failed";
                        callback(initStatus)
                    }
                })
            }
        } catch let error as NSError {
            var errMap: [String:Any] = [:];
            errMap["status"] = "failure";
            errMap["message"] = "Initialization failed:" + error.localizedDescription;
            callback(errMap)
            return
        }
    }
    
    @objc
    public func generateAReqParams(_ messageVersion: String,
                                   directoryServerId: String,
                                   from viewController: UIViewController?,
                                   callback: @escaping ([String: Any], [String: String]?) -> Void) {
        DispatchQueue.main.async {
            do {
                //MARK: dont send nil here try [:]
                let transaction = try self.threeDS2Service.createTransaction(directoryServerId: directoryServerId, messageVersion: messageVersion)
                self.transaction = transaction
                
                self.vc = viewController
                self.progressView = try self.transaction?.getProgressView()
                
                let authenticationParameters = try transaction.getAuthenticationRequestParameters()
                var authReqMap: [String: String] = [:]
                authReqMap["deviceData"] = authenticationParameters.getDeviceData()
                authReqMap["messageVersion"] = authenticationParameters.getMessageVersion()
                authReqMap["sdkTransId"] = authenticationParameters.getSDKTransactionId()
                authReqMap["sdkAppId"] = authenticationParameters.getSDKAppID()
                authReqMap["sdkEphemeralKey"] = authenticationParameters.getSDKEphemeralPublicKey()
                authReqMap["sdkReferenceNo"] = authenticationParameters.getSDKReferenceNumber()
                
                var statusMap: [String: Any] = [:]
                statusMap["status"] = "success"
                statusMap["message"] = "AReq Params generation successful"
                callback(statusMap, authReqMap)
            } catch let error as NSError {
                //MARK: don't send nil here try [:]
                var statusMap: [String: Any] = [:]
                statusMap["status"] = "error"
                statusMap["message"] = "AReq Params generation failure. Error: \(error)"
                callback(statusMap, nil)
            }
        }
    }
    @objc
    public func recieveChallengeParamsFromRN(_ acsSignedContent: String,
                                             acsRefNumber: String,
                                             acsTransactionId: String,
                                             threeDSRequestorAppURL: String?,
                                             threeDSServerTransId: String,
                                             callback: @escaping ([String: Any]) -> Void) {
        let challengeParameters = ChallengeParameters(
            threeDSServerTransactionID: threeDSServerTransId,
            acsTransactionID: acsTransactionId,
            acsRefNumber: acsRefNumber,
            acsSignedContent: acsSignedContent);

        if let url = threeDSRequestorAppURL {
            challengeParameters.setThreeDSRequestorAppURL(threeDSRequestorAppURL: url)
        }
        
        self.challengeParams = challengeParameters
        var statusMap: [String:Any] = [:]
        statusMap["status"] = "success"
        statusMap["message"] = "challenge params receive successful"
        callback(statusMap)
    }
    
    @objc
    public func generateChallenge(_ callback: @escaping ([String: Any]) -> Void) {
        challengeStatusReceiver.setPostHSChallengeCallback(callback)
        
        DispatchQueue.global().async {
            do {
                guard let challengeParams = self.challengeParams,
                      let transaction = self.transaction,
                      let vc = self.vc
                else {
                    var map: [String: String] = [:]
                    map["status"] = "error"
                    map["message"] = "doChallenge call unsuccessful"
                    callback(map)
                    return
                }
                
                try transaction.doChallenge(
                    challengeParameters: challengeParams,
                    challengeStatusReceiver: self.challengeStatusReceiver,
                    timeOut: 5,
                    inViewController: vc
                )
            } catch let err as NSError {
                var map: [String: String] = [:]
                map["status"] = "error"
                map["message"] = err.localizedDescription
                callback(map)
            }
        }
    }
}