import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Send message to native
  sendMessageToNative(message: string): void;

  // Apple Pay methods
  launchApplePay(requestObj: string, callback: (result: Object) => void): void;
  // Google Pay method
  launchGPay(requestObj: string, callback: (result: Object) => void): void;

  // Exit methods
  exitPaymentsheet(rootTag: number, result: string, reset: boolean): void;
  exitPaymentMethodManagement(
    rootTag: number,
    result: string,
    reset: boolean
  ): void;
  exitWidget(result: string, widgetType: string): void;
  exitCardForm(result: string): void;
  exitWidgetPaymentsheet(rootTag: number, result: string, reset: boolean): void;

  // Widget methods
  launchWidgetPaymentSheet(
    requestObj: string,
    callback: (result: Object) => void
  ): void;
  updateWidgetHeight(height: number): void;
  onAddPaymentMethod(data: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('HyperModules') as Spec;
