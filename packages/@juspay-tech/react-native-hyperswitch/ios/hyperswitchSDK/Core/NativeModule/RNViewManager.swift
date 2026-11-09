//
//  RNViewManager.swift
//  Hyperswitch
//
//  Hosts the SDK's embedded React Native runtime that renders the payment sheet

import Foundation
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

internal protocol ReactHostManager: AnyObject {
    var hyperModule: HyperModuleImpl { get }
    var responseHandler: RNResponseHandler? { get set }
    var rootView: UIView? { get }
}

extension UIView {
    internal func nearestAncestor(where predicate: (UIView) -> Bool) -> UIView? {
        var current: UIView? = self
        while let view = current {
            if predicate(view) {
                return view
            }
            current = view.superview
        }
        return nil
    }

    internal func nearestAncestor<T>(ofType type: T.Type) -> T? {
        return nearestAncestor(where: { $0 is T }) as? T
    }
}

internal class RNFactoryDelegate: RCTDefaultReactNativeFactoryDelegate {

    internal weak var manager: ReactHostManager?

    public override func bridgelessEnabled() -> Bool {
        return true
    }

    @objc(getModuleInstanceFromClass:)
    internal func getModuleInstanceFromClass(_ moduleClass: AnyClass) -> AnyObject? {
        guard let manager = manager else { return nil }
        // The ObjC++ HyperModule class carries the HyperModuleShim protocol.
        if moduleClass is HyperModuleShim.Type || String(describing: moduleClass) == "HyperModule",
           let shim = (moduleClass as? NSObject.Type)?.init() as? HyperModuleShim {
            manager.hyperModule.attach(to: shim)
            return shim as AnyObject
        }
        return nil
    }
}

internal class RNViewManagerDelegate: RNFactoryDelegate {

    override func sourceURL(for bridge: RCTBridge) -> URL? {
        return bundleURL()
    }

    public override func bundleURL() -> URL? {
        return HyperBundleResolver.bundleURL(for: RNViewManager.self)
    }
}

internal class RNViewManager: NSObject, ReactHostManager {
    let hyperModule = HyperModuleImpl.shared
    var responseHandler: RNResponseHandler?
    internal var rootView: UIView?

    private let delegate: RNViewManagerDelegate

    internal static let sharedInstance = RNViewManager()

    private override init() {
        self.delegate = RNViewManagerDelegate()
        super.init()
        self.delegate.dependencyProvider = RCTAppDependencyProvider()
        self.delegate.manager = self
    }

    private lazy var factory: RCTReactNativeFactory = RCTReactNativeFactory(delegate: self.delegate)

    private func createSurfaceView(_ moduleName: String, initialProperties: [String: Any]?) -> UIView {
        let makeView = {
            self.factory.rootViewFactory.view(
                withModuleName: moduleName,
                initialProperties: initialProperties
            )
        }
        if Thread.isMainThread {
            return makeView()
        }
        return DispatchQueue.main.sync(execute: makeView)
    }

    internal func viewForModule(_ moduleName: String, initialProperties: [String: Any]?) -> UIView {
        let view = createSurfaceView(moduleName, initialProperties: initialProperties)
        self.rootView = view
        return view
    }

    internal func widgetViewForModule(_ moduleName: String, initialProperties: [String: Any]?) -> UIView {
        return createSurfaceView(moduleName, initialProperties: initialProperties)
    }
}
