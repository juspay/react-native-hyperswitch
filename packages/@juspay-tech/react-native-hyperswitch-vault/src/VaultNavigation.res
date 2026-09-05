@genType
type nextActionType = [
  | #three_ds_invoke
  | #third_party_sdk_session_token
  | #display_bank_transfer_information
  | #invoke_ddc
  | #redirect_to_url
]

@genType
type safeThreeDs = {
  authenticationUrl: string,
  authorizeUrl: string,
  messageVersion: string,
  directoryServerId: string,
  pollId: string,
  delayInSecs: int,
  frequency: int,
}

@genType
type safeDdc = {
  iframeUrl: string,
  timeoutMs: int,
}

@genType
type safeSessionToken = {
  walletName: string,
  openBankingSessionToken: string,
}

@genType
type safeNextAction = {
  type_: nextActionType,
  redirectUrl?: string,
  threeDs?: safeThreeDs,
  ddc?: safeDdc,
  sessionToken?: safeSessionToken,
}
