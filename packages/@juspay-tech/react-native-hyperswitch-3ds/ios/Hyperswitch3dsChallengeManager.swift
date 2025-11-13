//
//  Hyperswitch3dsChallengeManager.swift
//  
//
//  Created by Shivam Nan on 12/11/25.
//

import Foundation
import HyperswitchAuthentication

class Hyperswitch3dsChallengeManager: ChallengeStatusReceiver {
    var postChallengeCallback: RCTResponseSenderBlock?
    
    func setPostHSChallengeCallback(_ callback: @escaping RCTResponseSenderBlock) {
        self.postChallengeCallback = callback
    }
    
    func completed(_ completionEvent: CompletionEvent) {
        // Handle successful or unsuccessful completion of challenge flow
        let map: [String: Any] = [
            "status" : "success",
            "message" : "challenge completed successfully"
        ]
        postChallengeCallback?([map]);
    }
    
    func cancelled() {
        // Handle challenge canceled by the user
        let map: [String: Any] = [
            "status": "error",
            "message": "challenge cancelled by user"
        ]
        postChallengeCallback?([map]);
    }
    
    func timedout() {
        // Handle challenge timeout
        let map: [String: Any] = [
            "status": "error",
            "message": "challenge timeout"
        ]
        postChallengeCallback?([map]);
    }
    
    func protocolError(_ protocolErrorEvent: ProtocolErrorEvent) {
        // Handle protocol error that has been sent by the ACS
        let errorMessage = protocolErrorEvent.getErrorMessage()
        let map: [String: Any] = [
            "status": "error",
            "message": errorMessage
        ]
        postChallengeCallback?([map]);
    }
    
    func runtimeError(_ runtimeErrorEvent: RuntimeErrorEvent) {
        // Handle error that has occurred in the SDK at runtime
        var message: String = "";
        message.append("Description: \(runtimeErrorEvent.getErrorMessage())\n")
        
        if let errorCode = runtimeErrorEvent.getErrorCode() {
            message.append("Error code: \(errorCode)\n")
        }
        
        let map: [String: Any] = [
            "status": "error",
            "message": message
        ]
        postChallengeCallback?([map]);
    }
}

