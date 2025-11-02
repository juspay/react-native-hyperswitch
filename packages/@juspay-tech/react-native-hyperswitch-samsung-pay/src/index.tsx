export type statusType = {
  status: String;
  message: String;
};

type cardBrandType = {
  cardBrands: Array<String>;
};

import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-hyperswitch-samsung-pay' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo managed workflow\n';

const HyperswitchSamsungPay = NativeModules.HyperswitchSamsungPay
  ? NativeModules.HyperswitchSamsungPay
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export function samsungPayInit(
  serviceId: string,
  requestObject: string,
  callback: (status: statusType) => void
) {
  return HyperswitchSamsungPay.samsungPayInit(
    serviceId,
    requestObject,
    callback
  );
}

export function checkSamsungPayValidity(
  requestObj: string,
  callback: (status: statusType) => void
): Promise<boolean> {
  return HyperswitchSamsungPay.checkSamsungPayValidity(requestObj, callback);
}

export function activateSamsungPay(callback: (status: statusType) => void) {
  return HyperswitchSamsungPay.activateSamsungPay(callback);
}

export function requestCardInfo(
  callback: (status: statusType, cardBrands: cardBrandType) => void
) {
  return HyperswitchSamsungPay.requestCardInfo(callback);
}

export function presentSamsungPayPaymentSheet(
  callback: (status: statusType) => void
) {
  return HyperswitchSamsungPay.presentSamsungPayPaymentSheet(callback);
}

export const isAvailable = Boolean(
  HyperswitchSamsungPay && HyperswitchSamsungPay.checkSamsungPayValidity
);
