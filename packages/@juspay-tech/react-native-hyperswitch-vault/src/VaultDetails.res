@genType
type vaultData = {
  sdkAuthorization?: string,

  vaultId?: string,
  environment?: string,
}

@genType
type vaultDetails = {
  vaultType?: string,
  vaultData?: vaultData,
}
