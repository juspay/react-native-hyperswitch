//
//  HyperBundleResolver.swift
//  Hyperswitch
//
//  Shared React Native version-aware bundle selection used by both the
//  embedded payment-sheet runtime (RNViewManager) and the headless runtime
//  (RNHeadlessManager).
//
//  Version selection:
//    - RN 0.76 - 0.81: hyperswitch.bundle
//    - RN 0.82+:       hyperswitch-rn82plus.bundle
//    - RN 1.x+:        hyperswitch-rn82plus.bundle (latest)
//    - Fallback / OTA: hyperswitch.bundle (legacy) / OTAServices bundle
//

import Foundation
import React

enum HyperBundleResolver {

    /// Returns the URL of the appropriate embedded JS bundle.
    ///
    /// - Parameter bundleClass: A class that lives in the same `Bundle` as the
    ///   resource bundles (used purely for `Bundle(for:)` lookup).
    static func bundleURL(for bundleClass: AnyClass) -> URL? {
        let legacyURL = Bundle(for: bundleClass).url(forResource: "hyperswitch", withExtension: "bundle")

        // #if canImport(HyperOTA)
        //     // return OTAServices.shared.getBundleURL()
        // #else
            // Detect merchant app's React Native version.
            guard let rnVersion = RCTGetReactNativeVersion() else {
                return legacyURL
            }

            let majorVersion = (rnVersion["major"] as? Int) ?? 0
            let minorVersion = (rnVersion["minor"] as? Int) ?? 0

            let bundleName: String
            if majorVersion == 0 {
                // RN 0.x versions
                if minorVersion >= 82 {
                    bundleName = "hyperswitch-rn82plus"
                } else {
                    // RN 0.76 - 0.81 and legacy < 0.76
                    bundleName = "hyperswitch"
                }
            } else {
                // Future RN 1.x+ versions — use the latest bundle.
                bundleName = "hyperswitch-rn82plus"
            }

            return Bundle(for: bundleClass).url(forResource: bundleName, withExtension: "bundle") ?? legacyURL
        // #endif
    }
}
