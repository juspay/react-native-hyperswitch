let host = (environment: VaultConfirm.vaultEnvironment) =>
  switch environment {
  | #PROD => "https://checkout.hyperswitch.io"
  | #SANDBOX => "https://beta.hyperswitch.io"
  | #INTEG => "https://dev.hyperswitch.io"
  }

let iconUrl = (~baseUrl: string, ~name: string) =>
  `${baseUrl}/assets/v2/images/${name}.svg`
