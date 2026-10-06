import { describe, it, expect } from '@jest/globals';

import { SDK_VERSION } from '../version';

const { version } = require('../../../package.json') as { version: string };

describe('SDK_VERSION', () => {
  it('matches package.json, so every log line reports the release it came from', () => {
    expect(SDK_VERSION).toBe(version);
  });
});
