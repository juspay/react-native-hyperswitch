type scanCardData = {
  pan: string,
  expiryMonth: string,
  expiryYear: string,
}

type scanCardReturnType = {
  status: string,
  data: scanCardData,
}

type outcome =
  | Succeeded(scanCardData)
  | Failed
  | Cancelled
  | NoResult

type module_ = {
  launchScanCard: (scanCardReturnType => unit) => unit,
  isAvailable: bool,
}

@val external require: string => module_ = "require"

let (launchScanCardMod, isAvailable) = switch try {
  Some(require("@juspay-tech/react-native-hyperswitch-scancard"))
} catch {
| _ => None
} {
| Some(mod) => (mod.launchScanCard, mod.isAvailable)
| None => (_ => (), false)
}

let readOutcome = (result: scanCardReturnType): outcome =>
  switch result.status {
  | "Succeeded" =>
    Succeeded({
      pan: result.data.pan,
      expiryMonth: result.data.expiryMonth,
      expiryYear: result.data.expiryYear,
    })
  | "Cancelled" => Cancelled
  | "Failed" => Failed
  | _ => NoResult
  }

let launch = (callback: outcome => unit) =>
  try {
    launchScanCardMod(result => callback(result->readOutcome))
  } catch {
  | _ => callback(Failed)
  }

let expiryDisplay = (data: scanCardData) => {
  let month = data.expiryMonth->String.trim
  let year = data.expiryYear->String.trim
  let shortYear = {
    let length = year->String.length
    length > 2 ? year->String.sliceToEnd(~start=length - 2) : year
  }
  month->String.length === 0 && shortYear->String.length === 0
    ? ""
    : `${month} / ${shortYear}`
}
