import { NativeModules } from 'react-native';

const HyperswitchTrident3ds = NativeModules.HyperswitchTrident3ds || null;
const isAvailable =
  HyperswitchTrident3ds && HyperswitchTrident3ds.initialiseSDK;

function initialiseSDK(
  apiKey: string,
  hsSDKEnvironment: string,
  callback: (status: statusType) => void
) {
  return HyperswitchTrident3ds.initialiseSDK(
    apiKey,
    hsSDKEnvironment,
    callback
  );
}

function generateAReqParams(
  messageVersion: string,
  directoryServerId: string,
  cardNetwork: string,
  callback: (aReqParams: AReqParams, status: statusType) => void
) {
  return HyperswitchTrident3ds.generateAReqParams(
    messageVersion,
    directoryServerId,
    cardNetwork,
    callback
  );
}

function receiveChallengeParamsFromRN(
  acsSignedContent: String,
  acsRefNumber: String,
  acsTransactionId: String,
  threeDSServerTransId: String,
  callback: (status: statusType) => void,
  threeDSRequestorAppURL?: String
) {
  return HyperswitchTrident3ds.receiveChallengeParamsFromRN(
    acsSignedContent,
    acsRefNumber,
    acsTransactionId,
    threeDSRequestorAppURL,
    threeDSServerTransId,
    callback
  );
}

function generateChallenge(callback: (status: statusType) => void) {
  return HyperswitchTrident3ds.generateChallenge(callback);
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
  initialiseSDK,
  generateAReqParams,
  receiveChallengeParamsFromRN,
  generateChallenge,
};
