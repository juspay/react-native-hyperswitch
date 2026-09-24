//
//  Environment.swift
//  hyperswitch
//
//  Created by Kuntimaddi Manideep on 24/01/25.
//

import Foundation

enum SDKEnvironment {
    case PROD, SANDBOX

    // Bare hosts; the API path is appended separately (mirrors GlobalHooks.res).
    private static let prodHost = "https://live.hyperswitch.io"
    private static let sandboxHost = "https://app.hyperswitch.io"
    private static let integHost = "https://integ.hyperswitch.io"
    private static let backendPath = "/api"
    private static let logsPath = "/api/logs/sdk"

    static func getEnvironment(_ publishableKey: String) -> SDKEnvironment {
        return publishableKey.contains("_snd_") ? .SANDBOX : .PROD
    }

    static func baseURL(for publishableKey: String) -> String {
        return host(for: publishableKey) + backendPath
    }

    /// Resolves the logging endpoint with the same precedence as GlobalHooks.res:
    ///   1. `overrideEndpoints.customLoggingEndpoint`, used exactly as given
    ///   2. `commonEndpoint` (a bare host) + `/api/logs/sdk`
    ///   3. the explicit `environment`'s host (PROD, SANDBOX or INTEG) + `/api/logs/sdk`
    ///   4. the host implied by the publishable key + `/api/logs/sdk`
    static func loggingURL(
        for publishableKey: String,
        environment: HyperswitchEnvironment? = nil,
        customEndpoints: CustomEndpointConfiguration? = nil
    ) -> String {
        switch customEndpoints {
        case .overrideEndpoints(let config)?:
            if let url = config.customLoggingEndpoint?.trimmingCharacters(in: .whitespaces), !url.isEmpty {
                return url
            }
        case .commonEndpoint(let common)?:
            let host = common.trimmingCharacters(in: .whitespaces)
            if !host.isEmpty {
                return host.trimmingTrailingSlashes() + logsPath
            }
        case nil:
            break
        }
        return host(for: publishableKey, environment: environment) + logsPath
    }

    private static func host(for publishableKey: String, environment: HyperswitchEnvironment? = nil) -> String {
        switch environment {
        case .production?: return prodHost
        case .sandbox?: return sandboxHost
        case .integ?: return integHost
        case nil: return getEnvironment(publishableKey) == .PROD ? prodHost : sandboxHost
        }
    }
}

private extension String {
    func trimmingTrailingSlashes() -> String {
        var result = self
        while result.hasSuffix("/") { result.removeLast() }
        return result
    }
}
