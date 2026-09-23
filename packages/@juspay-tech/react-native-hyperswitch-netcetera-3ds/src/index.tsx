import NativeHyperswitchNetcetera3ds from './NativeHyperswitchNetcetera3ds';

// TurboModuleRegistry.get resolves the TurboModule on the new architecture
// and falls back to the legacy NativeModules entry on the old architecture,
// so this single code path supports both.
const isAvailable = NativeHyperswitchNetcetera3ds != null;

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
  return NativeHyperswitchNetcetera3ds?.initialiseNetceteraSDK(
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
  return NativeHyperswitchNetcetera3ds?.generateAReqParams(
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
  return NativeHyperswitchNetcetera3ds?.recieveChallengeParamsFromRN(
    acsSignedContent,
    acsRefNumber,
    acsTransactionId,
    threeDSRequestorAppURL ?? null,
    threeDSServerTransId,
    callback
  );
}

function generateChallenge(callback: (status: statusType) => void) {
  return NativeHyperswitchNetcetera3ds?.generateChallenge(callback);
}

export {
  isAvailable,
  initialiseNetceteraSDK,
  generateAReqParams,
  recieveChallengeParamsFromRN,
  generateChallenge,
};
