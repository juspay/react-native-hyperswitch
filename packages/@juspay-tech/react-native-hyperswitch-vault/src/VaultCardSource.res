@genType.import(("./merchantTypes", "MerchantSession"))
type vaultSession

external sessionToJson: vaultSession => JSON.t = "%identity"

@genType
type cardSourceType = [#vault | #direct]

@genType
type paymentCardSource = {
  type_: cardSourceType,

  session?: vaultSession,

  confirmTokenMode?: VaultConfirmBody.confirmTokenMode,
}

type resolved =
  | VaultSource({session: JSON.t, confirmTokenMode: VaultConfirmBody.confirmTokenMode})
  | DirectSource

type rejection =

  | MissingVaultSession

  | ContradictorySource

external asNullable: paymentCardSource => Nullable.t<paymentCardSource> = "%identity"

@get_index external unsafeField: (paymentCardSource, string) => option<unknown> = ""

let resolve = (source: paymentCardSource): result<resolved, rejection> =>
  switch source->asNullable->Nullable.toOption {
  | None => Error(MissingVaultSession)
  | Some(source) =>
    switch source.type_ {
    | #direct =>
      let carriesVaultSettings =
        source->unsafeField("session")->Option.isSome ||
          source->unsafeField("confirmTokenMode")->Option.isSome
      carriesVaultSettings ? Error(ContradictorySource) : Ok(DirectSource)
    | #vault =>
      switch source.session {
      | None => Error(MissingVaultSession)
      | Some(session) =>
        let json = session->sessionToJson
        switch json->JSON.Decode.object {
        | None => Error(MissingVaultSession)
        | Some(_) =>
          Ok(
            VaultSource({
              session: json,
              confirmTokenMode: source.confirmTokenMode->Option.getOr(#payment_token),
            }),
          )
        }
      }
    }
  }

let describe = (rejection: rejection) =>
  switch rejection {
  | MissingVaultSession => #invalid_session
  | ContradictorySource => #unsupported_configuration
  }
