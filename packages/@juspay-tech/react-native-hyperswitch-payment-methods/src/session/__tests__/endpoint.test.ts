import { describe, it, expect } from '@jest/globals';

import { validateEndpoint } from '../endpoint';

describe('validateEndpoint', () => {
  it('accepts https, and http only to a loopback host outside PROD', () => {
    expect(validateEndpoint('https://eu.hyperswitch.io/api', 'PROD')).toBe(
      'https://eu.hyperswitch.io/api'
    );
    expect(
      validateEndpoint('http://proxy.merchant.test/api', 'PROD')
    ).toBeUndefined();
    expect(
      validateEndpoint('http://proxy.merchant.test/api', 'SANDBOX')
    ).toBeUndefined();
    expect(
      validateEndpoint('http://localhost:8080/api', 'PROD')
    ).toBeUndefined();
    expect(validateEndpoint('http://localhost:8080/api', 'SANDBOX')).toBe(
      'http://localhost:8080/api'
    );
    expect(validateEndpoint('http://10.0.2.2:8080/api', 'INTEG')).toBe(
      'http://10.0.2.2:8080/api'
    );
    expect(
      validateEndpoint('ftp://vault.merchant.test', 'SANDBOX')
    ).toBeUndefined();
  });

  it('refuses credentials, a query, a hash, or anything that is not a URL', () => {
    for (const url of [
      'https://user:pass@vault.merchant.test/api',
      'https://user@vault.merchant.test/api',
      'https://vault.merchant.test/api?key=1',
      'https://vault.merchant.test/api#key',
      'https://vault.merchant.test\\@evil.test/api',
      'vault.merchant.test/api',
      'https://',
      '   ',
    ]) {
      expect(validateEndpoint(url, 'PROD')).toBeUndefined();
    }
  });

  it('normalises the scheme, host and trailing slashes', () => {
    expect(
      validateEndpoint(' HTTPS://Vault.Merchant.Test:8443/Api/ ', 'PROD')
    ).toBe('https://vault.merchant.test:8443/Api');
  });

  it('trims trailing slashes in linear time, however many there are', () => {
    expect(
      validateEndpoint(
        'https://vault.merchant.test/api' + '/'.repeat(50000),
        'PROD'
      )
    ).toBe('https://vault.merchant.test/api');
    const inner = 'https://vault.merchant.test/' + '/'.repeat(50000) + 'api';
    expect(validateEndpoint(inner, 'PROD')).toBe(inner);
  });
});
