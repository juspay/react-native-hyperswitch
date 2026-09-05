type t =
  | IntentAuthorization(string)
  | LegacyApiKey({publishableKey: string, clientSecret: string})

let nonBlank = (value: string): option<string> => {
  let trimmed = value->String.trim
  trimmed->String.length > 0 ? Some(trimmed) : None
}

let resolve = (
  ~sdkAuthorization: option<string>,
  ~publishableKey: option<string>,
  ~clientSecret: option<string>,
): option<t> =>
  switch sdkAuthorization->Option.flatMap(nonBlank) {
  | Some(token) => Some(IntentAuthorization(token))
  | None =>
    switch (publishableKey->Option.flatMap(nonBlank), clientSecret->Option.flatMap(nonBlank)) {
    | (Some(publishableKey), Some(clientSecret)) =>
      Some(LegacyApiKey({publishableKey, clientSecret}))
    | _ => None
    }
  }

let intent = (token: string): t => IntentAuthorization(token)
let legacy = (~publishableKey: string, ~clientSecret: string): t =>
  LegacyApiKey({publishableKey, clientSecret})

let authHeader = (credential: t): (string, string) =>
  switch credential {
  | IntentAuthorization(token) => ("Authorization", token)
  | LegacyApiKey({publishableKey}) => ("api-key", publishableKey)
  }

let clientSecretForBody = (credential: t): option<string> =>
  switch credential {
  | IntentAuthorization(_) => None
  | LegacyApiKey({clientSecret}) => Some(clientSecret)
  }
