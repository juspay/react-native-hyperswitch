import Foundation

public struct WalletSessionHandler {
    public let isWalletEligible: (_ wallet: String) -> Bool
    public let getEligibleWallets: () -> [String]
    public let launchWallet: (_ wallet: String, _ resultHandler: @escaping (PaymentResult) -> Void) -> Void

    public init(
        isWalletEligible: @escaping (_ wallet: String) -> Bool,
        getEligibleWallets: @escaping () -> [String],
        launchWallet: @escaping (_ wallet: String, _ resultHandler: @escaping (PaymentResult) -> Void) -> Void
    ) {
        self.isWalletEligible = isWalletEligible
        self.getEligibleWallets = getEligibleWallets
        self.launchWallet = launchWallet
    }
}
