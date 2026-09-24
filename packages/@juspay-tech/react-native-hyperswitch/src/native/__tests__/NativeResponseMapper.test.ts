import { mapNativeResponseToPaymentResult } from '../NativeResponseMapper';

describe('mapNativeResponseToPaymentResult', () => {
  it('surfaces the text Android writes under `error`', () => {
    const raw = JSON.stringify({
      status: 'failed',
      error: 'Google Pay was declined',
      type: 'java.lang.Throwable',
    });
    expect(mapNativeResponseToPaymentResult(raw)).toEqual({
      status: 'failed',
      type: 'java.lang.Throwable',
      message: 'Google Pay was declined',
    });
  });

  it('prefers `message`, then `error`, then `code`', () => {
    const map = (o: object) =>
      mapNativeResponseToPaymentResult(JSON.stringify({ status: 'failed', ...o }))
        .message;
    expect(map({ message: 'm', error: 'e', code: 'c' })).toBe('m');
    expect(map({ message: '', error: 'e', code: 'c' })).toBe('e');
    expect(map({ error: '', code: 'c' })).toBe('c');
  });

  it('never returns an empty message for a failure', () => {
    const result = mapNativeResponseToPaymentResult(
      JSON.stringify({ status: 'failed', type: 'java.lang.Throwable' })
    );
    expect(result.status).toBe('failed');
    expect(result.message).not.toBe('');
  });

  it('keeps completed and canceled results unchanged', () => {
    expect(
      mapNativeResponseToPaymentResult(JSON.stringify({ status: 'completed' }))
    ).toEqual({ status: 'completed', type: 'completed', message: '' });
    expect(
      mapNativeResponseToPaymentResult(JSON.stringify({ status: 'cancelled' }))
    ).toMatchObject({ status: 'canceled', message: '' });
  });

  it('falls back to the raw string when the payload is not JSON', () => {
    expect(mapNativeResponseToPaymentResult('boom')).toMatchObject({
      status: 'failed',
      message: 'boom',
    });
  });
});
