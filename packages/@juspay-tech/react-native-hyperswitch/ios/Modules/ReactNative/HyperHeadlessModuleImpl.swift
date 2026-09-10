//
//  HyperHeadlessModuleImpl.swift
//  Hyperswitch
//
//  Swift implementation for HyperHeadless TurboModule
//  Handles headless payment session operations
//
//  Created by Kuntimaddi Manideep on 02/08/26.
//

import Foundation
import React

@objc(HyperHeadlessModuleImpl)
public class HyperHeadlessModuleImpl: NSObject {
    
    @objc public static let shared = HyperHeadlessModuleImpl()
    
    private override init() {
        super.init()
    }
    
    @objc public func getPaymentSession(
        rootTag: NSNumber,
        defaultPaymentMethod: NSDictionary,
        lastUsedPaymentMethod: NSDictionary,
        allPaymentMethods: NSArray,
        callback: @escaping RCTResponseSenderBlock
    ) {
        PaymentSession.getPaymentSession(
            getPaymentMethodData: defaultPaymentMethod,
            getPaymentMethodData2: lastUsedPaymentMethod,
            getPaymentMethodDataArray: allPaymentMethods,
            callback: callback
        )
    }
    
    @objc public func getWalletSession(
        rootTag: NSNumber,
        wallets: NSArray,
        callback: @escaping RCTResponseSenderBlock
    ) {
        PaymentSession.getWalletSession(
            wallets: wallets,
            callback: callback
        )
    }
    
    @objc public func exitHeadless(
        rootTag: NSNumber,
        status: String
    ) {
        PaymentSession.exitHeadless(rnMessage: status)
    }
}
