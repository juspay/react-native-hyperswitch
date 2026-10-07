// Normalised here too, as vaultBaseUrl is: the compiled switch sends whatever matches no case to
// its last branch, so an unrecognised value must become PROD before it gets there.
let host = (environment: VaultConfirm.vaultEnvironment) =>
  switch environment->VaultConfirm.normalizeEnvironment {
  | #PROD => "https://checkout.hyperswitch.io"
  | #PROD_EU => "https://eu.hyperswitch.io/sdk"
  | #SANDBOX => "https://beta.hyperswitch.io"
  | #INTEG => "https://dev.hyperswitch.io"
  }

let iconUrl = (~baseUrl: string, ~name: string) =>
  `${baseUrl}/assets/v2/images/${name}.svg`
