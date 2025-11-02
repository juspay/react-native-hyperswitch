//
//  TridentChallengeManager.swift
//  HyperswitchTrident3ds
//
//  Created by Shivam Nan on 26/05/25.
//

import Foundation
import Trident

class TridentChallengeStatusReceiver : ChallengeStatusReceiver {
  let transactionRef: Transaction
  let postChallengeCallback: RCTResponseSenderBlock
  var response: [String: Any] = [:]
  
  init(transactionRef: Transaction, completion: @escaping RCTResponseSenderBlock) {
    self.transactionRef = transactionRef
    self.postChallengeCallback = completion
  }
  
  func completed(_ completionEvent: CompletionEvent) {
    // Handle completion event
    response["status"] = "success"
    response["message"] = "challenge completed successfully"
    postChallengeCallback([response])
    transactionRef.close()
  }
  
  func cancelled() {
    // Handle cancellation
    response["status"] = "error"
    response["message"] = "challenge cancelled by user"
    postChallengeCallback([response])
    transactionRef.close()
  }
  
  func timedout() {
    // Handle timeout
    response["status"] = "error"
    response["message"] = "challenge timeout"
    postChallengeCallback([response])
    transactionRef.close()
  }
  
  func protocolError(_ protocolErrorEvent: ProtocolErrorEvent) {
    // Handle protocol error
    response["status"] = "error"
    response["message"] = "Protocol error: \(protocolErrorEvent)"
    postChallengeCallback([response])
    transactionRef.close()
  }
  
  func runtimeError(_ runtimeErrorEvent: RuntimeErrorEvent) {
    // Handle runtime error
    var message: String = "";
    message.append("Description: \(runtimeErrorEvent.getErrorMessage())\n")
    
    if let errorCode = runtimeErrorEvent.getErrorCode() {
      message.append("Error code: \(errorCode)\n")
    }
    
    response["status"] = "error"
    response["message"] = message
    postChallengeCallback([response])
    transactionRef.close()
  }
}
