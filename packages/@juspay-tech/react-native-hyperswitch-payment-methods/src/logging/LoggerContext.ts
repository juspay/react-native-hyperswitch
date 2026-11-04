import { createContext } from 'react';
import type { Logger } from './logger';

/* The session's logger, for the card forms inside it. Kept apart from SessionContext, whose type
   is public. */
export const LoggerContext = createContext<Logger | null>(null);
