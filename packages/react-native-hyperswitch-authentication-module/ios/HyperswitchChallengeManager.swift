//
//  HyperswitchChallengeManager.swift
//  HyperswitchAuthModule
//
//  Created by Shivam Nan on 22/10/25.
//

import Foundation
import HyperswitchAuthentication

class HyperswitchChallengeManager: ChallengeStatusReceiver {
  var postChallengeCallback: RCTResponseSenderBlock?
  var map: [String: Any] = [:]
  
  func setPostHSChallengeCallback(_ callback: @escaping RCTResponseSenderBlock) {
    self.postChallengeCallback = callback
  }
  
  func completed(_ completionEvent: CompletionEvent) {
    // Handle successful or unsuccessful completion of challenge flow
    map["status"] = "success";
    map["message"] = "challenge completed successfully";
    postChallengeCallback?([map]);
  }
  
  func cancelled() {
    // Handle challenge canceled by the user
    map["status"] = "error";
    map["message"] = "challenge cancelled by user";
    postChallengeCallback?([map]);
  }
  
  func timedout() {
    // Handle challenge timeout
    map["status"] = "error";
    map["message"] = "challenge timeout";
    postChallengeCallback?([map]);
  }
  
  func protocolError(_ protocolErrorEvent: ProtocolErrorEvent) {
    // Handle protocol error that has been sent by the ACS
    let errorMessage = protocolErrorEvent.getErrorMessage()
    
    map["status"] = "error";
    map["message"] = errorMessage;
    postChallengeCallback?([map]);
  }
  
  func runtimeError(_ runtimeErrorEvent: RuntimeErrorEvent) {
    // Handle error that has occurred in the SDK at runtime
    var message: String = "";
    message.append("Description: \(runtimeErrorEvent.getErrorMessage())\n")
    
    if let errorCode = runtimeErrorEvent.getErrorCode() {
      message.append("Error code: \(errorCode)\n")
    }
    
    map["status"] = "error";
    map["message"] = message;
    postChallengeCallback?([map]);
  }
}
