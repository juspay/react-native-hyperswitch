import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-hyperswitch-authentication-module' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const HyperswitchAuthenticationModule = NativeModules.HyperswitchAuthenticationModule
  ? NativeModules.HyperswitchAuthenticationModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );


const isAvailable = HyperswitchAuthenticationModule && HyperswitchAuthenticationModule.initializeThreeDS ? true : false;

export enum threeDSProvider {
  netcetera = 'netcetera',
  trident = 'trident',
  cardinal = 'cardinal',
};

type Configuration = {
  publishableKey: string;
  provider: threeDSProvider;
  jwtToken?: string;
  netceteraSdkApiKey?: string;
}

function initializeThreeDS(
  configuration: Configuration,
  hsSDKEnvironment: string,
  callback: (status: statusType) => void
) {
  return HyperswitchAuthenticationModule.initializeThreeDS(
    configuration,
    hsSDKEnvironment,
    callback
  );
}

function generateAReqParams(
  messageVersion: string,
  callback: (aReqParams: AReqParams, status: statusType) => void,
  directoryServerId?: string,
  cardBrand?: string,
) {
  return HyperswitchAuthenticationModule.generateAReqParams(
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
  return HyperswitchAuthenticationModule.recieveChallengeParamsFromRN(
    acsSignedContent,
    acsRefNumber,
    acsTransactionId,
    threeDSRequestorAppURL,
    threeDSServerTransId,
    callback
  );
}

function generateChallenge(callback: (status: statusType) => void) {
  return HyperswitchAuthenticationModule.generateChallenge(callback);
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
