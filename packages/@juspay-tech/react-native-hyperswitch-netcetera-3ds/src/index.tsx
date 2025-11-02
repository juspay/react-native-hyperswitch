import { NativeModules } from 'react-native';

const HyperswitchNetcetera3ds = NativeModules.HyperswitchNetcetera3ds || null;
const isAvailable = HyperswitchNetcetera3ds && HyperswitchNetcetera3ds.initialiseNetceteraSDK;

function initialiseNetceteraSDK(
  apiKey: string,
  hsSDKEnvironment: string,
  callback: (status: statusType) => void
) {
  return HyperswitchNetcetera3ds.initialiseNetceteraSDK(
    apiKey,
    hsSDKEnvironment,
    callback
  );
}

function generateAReqParams(
  messageVersion: string,
  directoryServerId: string,
  callback: (aReqParams: AReqParams, status: statusType) => void
) {
  return HyperswitchNetcetera3ds.generateAReqParams(
    messageVersion,
    directoryServerId,
    callback
  );
}

function recieveChallengeParamsFromRN(
  acsSignedContent: String,
  acsRefNumber: String,
  acsTransactionId: String,
  threeDSServerTransId: String,
  callback: (status: statusType) => void,
  threeDSRequestorAppURL?: String
) {
  return HyperswitchNetcetera3ds.recieveChallengeParamsFromRN(
    acsSignedContent,
    acsRefNumber,
    acsTransactionId,
    threeDSRequestorAppURL,
    threeDSServerTransId,
    callback
  );
}
function generateChallenge(callback: (status: statusType) => void) {
  return HyperswitchNetcetera3ds.generateChallenge(callback);
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

export {
  isAvailable,
  initialiseNetceteraSDK,
  generateAReqParams,
  recieveChallengeParamsFromRN,
  generateChallenge,
};
