import NativeHyperswitchSamsungPay from './NativeHyperswitchSamsungPay';

export type statusType = {
  status: String;
  message: String;
};

// TurboModuleRegistry.get returns null when the native module is not linked
// into the host app (or on iOS), which lets consumers treat this package as
// optional.
export const isAvailable = NativeHyperswitchSamsungPay != null;

// Calls must not silently no-op when the module is missing: the callback would
// never fire and a caller awaiting it would hang. Check isAvailable first.
function nativeModule() {
  if (NativeHyperswitchSamsungPay == null) {
    throw new Error(
      "The package '@juspay-tech/react-native-hyperswitch-samsung-pay' is not linked (it is Android only). Rebuild the app after installing it, with the React Native New Architecture enabled."
    );
  }
  return NativeHyperswitchSamsungPay;
}

export function checkSamsungPayValidity(
  requestObj: string,
  callback: (status: statusType) => void
) {
  return nativeModule().checkSamsungPayValidity(requestObj, callback);
}

export function activateSamsungPay(callback: (status: statusType) => void) {
  return nativeModule().activateSamsungPay(callback);
}

export function presentSamsungPayPaymentSheet(
  callback: (status: statusType, details?: Object) => void
) {
  return nativeModule().presentSamsungPayPaymentSheet(callback);
}
