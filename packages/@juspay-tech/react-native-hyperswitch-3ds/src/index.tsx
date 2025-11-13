import { NativeModules } from 'react-native';

const Hyperswitch3ds = NativeModules.Hyperswitch3ds || null
const isAvailable = Hyperswitch3ds && Hyperswitch3ds.initializeThreeDS;

export enum threeDSProvider {
  netcetera = 'netcetera',
  trident = 'trident',
  cardinal = 'cardinal',
};

type Configuration = {
  publishableKey: string;
  authIntentClientSecret?: string, 
  provider?: threeDSProvider;
  jwtToken?: string;
  netceteraSdkApiKey?: string;
}

function initializeThreeDS(
  configuration: Configuration,
  hsSDKEnvironment: string,
  callback: (status: statusType) => void
) {
  return Hyperswitch3ds.initializeThreeDS(
    configuration,
    hsSDKEnvironment,
    callback
  );
}

function generateAReqParams(
  messageVersion: string,
  callback: (status: statusType, aReqParams: AReqParams) => void,
  directoryServerId?: string,
  cardBrand?: string,
) {
  return Hyperswitch3ds.generateAReqParams(
    messageVersion,
    directoryServerId,
    cardBrand,
    callback
  );
}

function recieveChallengeParamsFromRN(
  acsSignedContent: string,
  acsRefNumber: string,
  acsTransactionId: string,
  threeDSRequestorAppURL: string | undefined,
  threeDSServerTransId: string,
  callback: (status: statusType) => void
) {
  return Hyperswitch3ds.recieveChallengeParamsFromRN(
    acsSignedContent,
    acsRefNumber,
    acsTransactionId,
    threeDSRequestorAppURL,
    threeDSServerTransId,
    callback
  );
}

function generateChallenge(callback: (status: statusType) => void) {
  return Hyperswitch3ds.generateChallenge(callback);
}

export type statusType = {
  status: string;
  message: string;
};

export type AReqParams = {
  deviceData?: string;
  messageVersion?: string;
  sdkTransId?: string;
  sdkAppId?: string;
  sdkEphemeralKey?: any;
  sdkReferenceNo?: string;
  cardinalEncryptedData?: string;
};

export {
  isAvailable,
  initializeThreeDS,
  generateAReqParams,
  recieveChallengeParamsFromRN,
  generateChallenge,
};
