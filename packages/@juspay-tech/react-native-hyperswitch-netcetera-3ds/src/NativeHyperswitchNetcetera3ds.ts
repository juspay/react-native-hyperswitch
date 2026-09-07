import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export type NetceteraStatus = {
  status: string;
  message: string;
};

export type NetceteraAReqParams = {
  deviceData: string;
  messageVersion: string;
  sdkTransId: string;
  sdkAppId: string;
  sdkEphemeralKey: string;
  sdkReferenceNo: string;
};

export interface Spec extends TurboModule {
  initialiseNetceteraSDK(
    apiKey: string,
    hsSDKEnvironment: string,
    callback: (status: NetceteraStatus) => void
  ): void;
  // Native invokes the callback with (status, aReqParams) in that order.
  generateAReqParams(
    messageVersion: string,
    directoryServerId: string,
    callback: (status: NetceteraStatus, aReqParams: NetceteraAReqParams) => void
  ): void;
  // Parameter order matches the native method (threeDSRequestorAppURL comes
  // before threeDSServerTransId); the public JS wrapper reorders.
  recieveChallengeParamsFromRN(
    acsSignedContent: string,
    acsRefNumber: string,
    acsTransactionId: string,
    threeDSRequestorAppURL: string | null,
    threeDSServerTransId: string,
    callback: (status: NetceteraStatus) => void
  ): void;
  generateChallenge(callback: (status: NetceteraStatus) => void): void;
}

export default TurboModuleRegistry.get<Spec>('HyperswitchNetcetera3ds');
