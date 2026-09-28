import NativeHyperswitchNetcetera3ds from './NativeHyperswitchNetcetera3ds';

// TurboModuleRegistry.get returns null when the native module is not linked
// into the host app, which lets consumers treat this package as optional.
const isAvailable = NativeHyperswitchNetcetera3ds != null;

// Calls must not silently no-op when the module is missing: the callback would
// never fire and a caller awaiting it would hang. Check isAvailable first.
function nativeModule() {
  if (NativeHyperswitchNetcetera3ds == null) {
    throw new Error(
      "The package '@juspay-tech/react-native-hyperswitch-netcetera-3ds' is not linked. Rebuild the app after installing it, with the React Native New Architecture enabled."
    );
  }
  return NativeHyperswitchNetcetera3ds;
}

export type statusType = {
  status: string;
  message: string;
};

export type AReqParams = {
  deviceData: string;
  messageVersion: string;
  sdkTransId: string;
  sdkAppId: string;
  sdkEphemeralKey: any;
  sdkReferenceNo: string;
};

function initialiseNetceteraSDK(
  apiKey: string,
  hsSDKEnvironment: string,
  callback: (status: statusType) => void
) {
  return nativeModule().initialiseNetceteraSDK(
    apiKey,
    hsSDKEnvironment,
    callback
  );
}

function generateAReqParams(
  messageVersion: string,
  directoryServerId: string,
  callback: (status: statusType, aReqParams: AReqParams) => void
) {
  return nativeModule().generateAReqParams(
    messageVersion,
    directoryServerId,
    callback
  );
}

function recieveChallengeParamsFromRN(
  acsSignedContent: string,
  acsRefNumber: string,
  acsTransactionId: string,
  threeDSServerTransId: string,
  callback: (status: statusType) => void,
  threeDSRequestorAppURL?: string
) {
  return nativeModule().recieveChallengeParamsFromRN(
    acsSignedContent,
    acsRefNumber,
    acsTransactionId,
    threeDSRequestorAppURL ?? null,
    threeDSServerTransId,
    callback
  );
}

function generateChallenge(callback: (status: statusType) => void) {
  return nativeModule().generateChallenge(callback);
}

export {
  isAvailable,
  initialiseNetceteraSDK,
  generateAReqParams,
  recieveChallengeParamsFromRN,
  generateChallenge,
};
