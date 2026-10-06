@module("./CrashBoundary.mjs") @react.component
external make: (~onCrash: LoggerTypes.jsonValue => unit, ~children: React.element) => React.element =
  "CrashBoundary"
