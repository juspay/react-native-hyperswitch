// Copied from shared/logger/src by scripts/sync-logger.mjs. Do not edit: change shared/logger and run `yarn sync:logger` in the vault package.
@module("./CrashBoundary.mjs") @react.component
external make: (~onCrash: LoggerTypes.jsonValue => unit, ~children: React.element) => React.element =
  "CrashBoundary"
