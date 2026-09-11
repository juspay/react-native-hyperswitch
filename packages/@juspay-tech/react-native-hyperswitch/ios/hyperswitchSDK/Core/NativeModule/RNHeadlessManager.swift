//
//  RNHeadlessManager.swift
//  Hyperswitch
//
//  Hosts the SDK's headless React Native runtime (the "HyperHeadless" module)
//  that drives headless payment sessions without any visible UI.
//

import Foundation
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

internal class RNHeadlessManagerDelegate: RNFactoryDelegate {

    override func sourceURL(for bridge: RCTBridge) -> URL? {
        return bundleURL()
    }

    public override func bundleURL() -> URL? {
        return HyperBundleResolver.bundleURL(for: RNHeadlessManager.self)
    }
}

internal class RNHeadlessManager: RCTDefaultReactNativeFactoryDelegate {

    internal var responseHandler: RNResponseHandler?
    internal var rootView: UIView?

    private var factory: RCTReactNativeFactory?

    internal let hyperModule = HyperModuleImpl()

    internal static let sharedInstance = RNHeadlessManager()

    private let delegate = RNHeadlessManagerDelegate()

    // MARK: - Factory lifecycle

    private func factoryOrCreate() -> RCTReactNativeFactory {
        if let existing = factory {
            return existing
        }
        delegate.dependencyProvider = RCTAppDependencyProvider()
        let created = RCTReactNativeFactory(delegate: delegate)
        factory = created
        return created
    }

    // MARK: - View creation
    internal func viewForModule(_ moduleName: String, initialProperties: [String: Any]?) -> UIView {
        teardownRunningSurface()

        let makeView = {
            self.factoryOrCreate().rootViewFactory.view(
                withModuleName: moduleName,
                initialProperties: initialProperties
            )
        }
        let view: UIView
        if Thread.isMainThread {
            view = makeView()
        } else {
            view = DispatchQueue.main.sync(execute: makeView)
        }
        self.rootView = view
        return view
    }

    internal func reinvalidateBridge() {
        teardownRunningSurface()
    }

    /// Stops any surface left over from a previous headless flow.
    ///
    /// Dropping `rootView` alone is not enough on the new architecture: the
    /// surface stays in `Status::Running`, and the next `viewForModule`
    /// re-points a live surface, which trips the `SurfaceHandler::setUIManager`
    /// assertion. Stopping the surface retires it properly.
    ///
    /// The factory is deliberately kept. Releasing it tears down the whole
    /// React instance, and the headless flows share this manager — so a flow
    /// starting up would free the runtime another flow is still executing in,
    /// crashing its JS thread with EXC_BAD_ACCESS.
    internal func teardownRunningSurface() {
        guard rootView != nil else {
            return
        }

        let drop = {
            if let hosting = self.rootView as? RCTSurfaceHostingView {
                hosting.surface.stop()
            }
            self.rootView?.removeFromSuperview()
            self.rootView = nil
        }

        if Thread.isMainThread {
            drop()
        } else {
            DispatchQueue.main.sync(execute: drop)
        }
    }

    // MARK: - RCTTurboModuleManagerDelegate

    @objc public func getModuleInstanceFromClass(_ moduleClass: AnyClass) -> AnyObject? {
        if String(describing: moduleClass) == "HyperModule",
           let shim = (moduleClass as? NSObject.Type)?.init() as? HyperModuleShim {
            hyperModule.attach(to: shim)
            return shim as AnyObject
        }
        return nil
    }

    public override func bridgelessEnabled() -> Bool {
        return true
    }

    override func sourceURL(for bridge: RCTBridge) -> URL? {
        return bundleURL()
    }

    public override func bundleURL() -> URL? {
        return HyperBundleResolver.bundleURL(for: RNHeadlessManager.self)
    }
}
