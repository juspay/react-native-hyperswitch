import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  isAvailable(): Promise<boolean>;
  getBundlePath(): Promise<string>;
  initialize(baseUrl: string, sdkVersion: string): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('HyperswitchAirborne');
