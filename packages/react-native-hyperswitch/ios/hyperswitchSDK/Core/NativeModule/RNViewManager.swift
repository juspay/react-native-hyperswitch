//
//  RNViewManager.swift
//  Hyperswitch
//
//  Created by Shivam Shashank on 09/11/22.
//

//import Foundation
//import React
//
//internal class RNViewManager: NSObject {
//
//  internal var responseHandler: RNResponseHandler?
//  internal var rootView: RCTRootView?
//
//  internal lazy var bridge: RCTBridge = {
//    RCTBridge.init(delegate: self, launchOptions: nil)
//  }()
//
//
//  internal static let sharedInstance = RNViewManager()
//
//  internal func viewForModule(_ moduleName: String, initialProperties: [String : Any]?) -> RCTRootView {
//    let rootView: RCTRootView = RCTRootView(
//      bridge: self.bridge,
//      moduleName: moduleName,
//      initialProperties: initialProperties)
//    self.rootView = rootView
//    return rootView
//  }
//}
//
//extension RNViewManager: RCTBridgeDelegate {
//  func sourceURL(for bridge: RCTBridge) -> URL? {
//    switch getInfoPlist("HyperswitchSource") {
//    case "LocalHosted":
//      return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
//    case "LocalBundle":
//      return Bundle.main.url(forResource: "hyperswitch", withExtension: "bundle")
//    default:
//      return OTAServices.shared.getBundleURL()
//    }
//  }
//}


// TODO: #if RCT_NEW_ARCH_ENABLED
import Foundation
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

internal class RNFabricManager: RCTDefaultReactNativeFactoryDelegate {
    
    internal var responseHandler: RNResponseHandler?
    internal var rootView: UIView?
    
    private var reactNativeFactory: RCTReactNativeFactory? = nil
    
    internal static let sharedInstance = RNFabricManager()
    
    internal func startReactNative() {
        self.dependencyProvider = RCTAppDependencyProvider()
        self.reactNativeFactory = RCTReactNativeFactory(delegate: self)
    }
    
    internal func viewForModule(_ moduleName: String, initialProperties: [String : Any]?) -> UIView? {
        let rootView = reactNativeFactory?.rootViewFactory.view(
            withModuleName: moduleName,
            initialProperties: initialProperties
        )
        self.rootView = rootView
        return rootView
    }
    
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        return bundleURL()
    }
    
    public override func bundleURL() -> URL? {
        switch getInfoPlist("HyperswitchSource") {
        case "LocalHosted":
            return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        case "LocalBundle":
            return Bundle.main.url(forResource: "hyperswitch", withExtension: "bundle")
        default:
            return OTAServices.shared.getBundleURL()
        }
    }
}
