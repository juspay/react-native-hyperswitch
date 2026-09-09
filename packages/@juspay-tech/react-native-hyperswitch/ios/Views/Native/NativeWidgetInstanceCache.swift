//
//  NativeWidgetInstanceCache.swift
//  Hyperswitch
//
//  sdkAuthorization-keyed store for live widget instances (PaymentWidget /
//  CVCWidget). Widgets are kept alive here instead of being destroyed when
//  the sdkAuthorization is re-created or the hosting view unmounts, so the
//  same widget is reused rather than a full reload. updateIntent re-keys the
//  entry to the new authorization; deinitWidget(sdkAuthorization:) destroys
//  it explicitly.
//

import Foundation
import UIKit

/// Strong store of live widget instances keyed by their bound config key
/// ("widgetType:publishableKey:profileId:sdkAuthorization").
///
/// Entries survive the hosting NativePaymentWidgetView's lifecycle until
/// `removeAll(matchingSdkAuthorization:)` (deinitWidget) or eviction.
/// Thread-safe; all heavy work (view detachment) is marshalled to main.
final class NativeWidgetInstanceCache {

    struct Entry {
        /// Full config key the widget was created/bound with.
        let configKey: String
        /// The sdkAuthorization this entry is filed under (deinitWidget id).
        let sdkAuthorization: String
        /// The live widget view (PaymentWidget / CVCWidget).
        let widget: UIView
        /// The outer view currently hosting the widget, if attached.
        weak var host: NativePaymentWidgetView?

        func withHost(_ host: NativePaymentWidgetView?) -> Entry {
            Entry(configKey: configKey, sdkAuthorization: sdkAuthorization,
                  widget: widget, host: host)
        }
    }

    static let shared = NativeWidgetInstanceCache()

    /// Safety valve: without a cap, cycling many sdk authorizations without
    /// calling deinitWidget would grow memory unbounded (each entry hosts an
    /// embedded RN surface). Eviction is insertion-ordered (oldest first).
    private let maxEntries = 10

    private var entries: [String: Entry] = [:]
    private let lock = NSLock()

    private init() {}

    func entry(forKey configKey: String) -> Entry? {
        lock.lock()
        defer { lock.unlock() }
        return entries[configKey]
    }

    func store(_ entry: Entry) {
        lock.lock()
        entries[entry.configKey] = entry
        let overflowCount = entries.count - maxEntries
        let evicted: [Entry]
        if overflowCount > 0 {
            // Dictionary preserves insertion order; drop the oldest keys.
            let victims = Array(entries.keys.prefix(overflowCount))
            evicted = victims.compactMap { entries.removeValue(forKey: $0) }
        } else {
            evicted = []
        }
        lock.unlock()
        if !evicted.isEmpty {
            Self.destroy(evicted)
        }
    }

    /// Moves the entry filed under `fromKey` to `toKey`, recording the new
    /// sdkAuthorization. Called after a successful updateIntent so the widget
    /// stays associated with the (re-created) sdkAuthorization.
    func rekey(fromKey oldKey: String, toKey newKey: String, sdkAuthorization: String) {
        lock.lock()
        defer { lock.unlock() }
        guard oldKey != newKey, let entry = entries.removeValue(forKey: oldKey) else { return }
        entries[newKey] = Entry(configKey: newKey, sdkAuthorization: sdkAuthorization,
                                widget: entry.widget, host: entry.host)
    }

    @discardableResult
    func removeValue(forKey configKey: String) -> Entry? {
        lock.lock()
        defer { lock.unlock() }
        return entries.removeValue(forKey: configKey)
    }

    func markDetached(forKey configKey: String) {
        lock.lock()
        defer { lock.unlock() }
        guard let entry = entries[configKey] else { return }
        entries[configKey] = entry.withHost(nil)
    }

    func markHosted(forKey configKey: String, host: NativePaymentWidgetView) {
        lock.lock()
        defer { lock.unlock() }
        guard let entry = entries[configKey] else { return }
        entries[configKey] = entry.withHost(host)
    }

    /// Removes and returns every entry filed under the given sdkAuthorization
    /// (any widget type — PaymentElement, CVC, Apple/Google Pay button).
    @discardableResult
    func removeAll(matchingSdkAuthorization sdkAuthorization: String) -> [Entry] {
        lock.lock()
        let matches = entries.values.filter { $0.sdkAuthorization == sdkAuthorization }
        for entry in matches {
            entries.removeValue(forKey: entry.configKey)
        }
        lock.unlock()
        return matches
    }

    /// Tears removed entries down on the main thread: the hosting view drops
    /// its references (resolving pending callbacks) and the widget leaves the
    /// hierarchy so ARC can release the embedded RN surface.
    static func destroy(_ removed: [Entry]) {
        guard !removed.isEmpty else { return }
        let work = {
            for entry in removed {
                entry.host?.hostedWidgetWasDestroyed(entry.widget)
                entry.widget.removeFromSuperview()
            }
        }
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }
}
