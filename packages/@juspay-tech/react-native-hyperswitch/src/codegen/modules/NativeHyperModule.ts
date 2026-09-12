import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';

/**
 * Codegen spec for the HyperModule TurboModule.
 *
 * Naming convention: Native<ModuleName>.ts  — required by the RN codegen.
 * All number params map to Double on Android (Kotlin) and NSNumber on iOS.
 * All Object params map to ReadableMap; Array<Object> maps to ReadableArray.
 */

/** Payload for the `confirm` event (card confirm / wallet confirm). */
export type PaymentResultEvent = {
  paymentMethodData?: string;
  clientSecret?: string;
  paymentMethodType?: string;
  publishableKey?: string;
  error?: string;
  confirm?: boolean;
};

/** Payload for the `triggerWidgetAction` event emitted by HyperFragment. */
export type WidgetActionEvent = {
  actionType?: string;
  rootTag?: number;
  sdkAuthorization?: string;
  paymentToken?: string;
  billing?: string;
};

/** Payload for `updateIntentInit` / `updateIntentComplete` events. */
export type UpdateIntentEvent = {
  rootTag?: number;
  sdkAuthorization?: string;
};

export interface Spec extends TurboModule {
  // --- EventEmitter (required for NativeEventEmitter support) ---
  addListener(eventName: string): void;
  removeListeners(count: number): void;

  // --- Generic message passing ---
  sendMessageToNative(message: string): void;

  // --- Google Pay (Android) ---
  launchGPay(
    requestObj: string,
    callback: (result: Object) => void
  ): void;

  // --- Apple Pay (iOS; stubs on Android) ---
  launchApplePay(
    requestObj: string,
    callback: (result: Object) => void
  ): void;
  startApplePay(
    requestObj: string,
    callback: (result: Object) => void
  ): void;
  presentApplePay(
    requestObj: string,
    callback: (result: Object) => void
  ): void;

  // --- Payment sheet ---
  exitPaymentsheet(rootTag: number, result: string, reset: boolean): void;
  exitPaymentMethodManagement(
    rootTag: number,
    result: string,
    reset: boolean
  ): void;

  // --- Widget ---
  exitWidget(result: string, widgetType: string): void;
  exitCardForm(result: string): void;
  launchWidgetPaymentSheet(
    requestObj: string,
    callback: (result: Object) => void
  ): void;
  exitWidgetPaymentsheet(rootTag: number, result: string, reset: boolean): void;
  updateWidgetHeight(height: number): void;
  notifyWidgetPaymentResult(rootTag: number, result: string): void;

  // --- Payment method management ---
  onAddPaymentMethod(data: string): void;

  // --- Payment events ---
  emitPaymentEvent(
    rootTag: number,
    eventType: string,
    payload: Object
  ): void;
  onUpdateIntentEvent(rootTag: number, type: string, result: string): void;
  onPaymentConfirmButtonClick(
    rootTag: number,
    payload: string,
    callback: (shouldProceed: boolean) => void
  ): void;

  // --- 3DS / DDC iframe bridge ---
  openIframeBridge(
    url: string,
    timeoutMs: number,
    callback: (result: string) => void
  ): void;

  // --- Typed codegen EventEmitters (Native -> JS) ---
  // These flow through the TurboModule's async event emitter plumbing,
  // not RCTDeviceEventEmitter, so they work in bridgeless mode.
  readonly confirm: EventEmitter<PaymentResultEvent>;
  readonly widget: EventEmitter<PaymentResultEvent>;
  readonly confirmEC: EventEmitter<PaymentResultEvent>;
  readonly triggerWidgetAction: EventEmitter<WidgetActionEvent>;
  readonly updateIntentInit: EventEmitter<UpdateIntentEvent>;
  readonly updateIntentComplete: EventEmitter<UpdateIntentEvent>;
}

export default TurboModuleRegistry.get<Spec>('HyperModule');
