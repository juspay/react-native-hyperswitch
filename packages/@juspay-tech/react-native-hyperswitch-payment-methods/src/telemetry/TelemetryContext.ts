import { createContext } from 'react';
import type { Telemetry } from './telemetry';

/* Provided by <HyperPaymentMethodSession>. A <CardForm> outside one logs nothing itself. */
export const TelemetryContext = createContext<Telemetry | null>(null);
