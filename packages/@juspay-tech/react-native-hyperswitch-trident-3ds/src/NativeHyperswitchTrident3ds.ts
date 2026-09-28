import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type TridentStatus = {
  status: string;
  message: string;
};

export type TridentAReqParams = {
  deviceData: string;
  messageVersion: string;
  sdkTransId: string;
  sdkAppId: string;
  sdkEphemeralKey: string;
  sdkReferenceNo: string;
};

export interface Spec extends TurboModule {
  initialiseSDK(
    apiKey: string,
    hsSDKEnvironment: string,
    callback: (status: TridentStatus) => void
  ): void;
  // Native invokes the callback with (status, aReqParams) in that order.
  generateAReqParams(
    messageVersion: string,
    directoryServerId: string,
    cardNetwork: string,
    callback: (status: TridentStatus, aReqParams: TridentAReqParams) => void
  ): void;
  // Parameter order matches the native method (threeDSRequestorAppURL comes
  // before threeDSServerTransId); the public JS wrapper reorders.
  receiveChallengeParamsFromRN(
    acsSignedContent: string,
    acsRefNumber: string,
    acsTransactionId: string,
    threeDSRequestorAppURL: string | null,
    threeDSServerTransId: string,
    callback: (status: TridentStatus) => void
  ): void;
  generateChallenge(callback: (status: TridentStatus) => void): void;
}

export default TurboModuleRegistry.get<Spec>('HyperswitchTrident3ds');
