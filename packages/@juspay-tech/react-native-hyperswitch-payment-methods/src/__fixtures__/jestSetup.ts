import { afterEach } from '@jest/globals';

import { sendQueuedLogs, setLogTransport } from '../logging/logger';

/* Unit tests never send the SDK's logs anywhere: the logging tests install their own transport.
   What a test leaves queued is dropped after it, so no send is left scheduled. */
setLogTransport(() => {});
afterEach(() => sendQueuedLogs());
