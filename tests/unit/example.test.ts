import { describe, expect, it } from 'vitest';
import { getErrorMessage, serializeError } from '../../lib/errors';

describe('getErrorMessage', () => {
  it('prefers API error text when available', () => {
    const error = {
      response: {
        data: {
          error: 'Invite token has expired'
        }
      }
    };

    expect(getErrorMessage(error, 'Fallback message')).toBe('Invite token has expired');
  });

  it('falls back through details, message, and the default text', () => {
    expect(
      getErrorMessage(
        {
          response: {
            data: {
              details: 'Upload exceeded the 10MB limit'
            }
          }
        },
        'Fallback message'
      )
    ).toBe('Upload exceeded the 10MB limit');

    expect(getErrorMessage({ message: 'Unexpected network issue' }, 'Fallback message')).toBe(
      'Unexpected network issue'
    );

    expect(getErrorMessage(null, 'Fallback message')).toBe('Fallback message');
  });

  it('returns string errors unchanged', () => {
    expect(getErrorMessage('Scanner unavailable', 'Fallback message')).toBe('Scanner unavailable');
  });
});

describe('serializeError', () => {
  it('serializes Error instances with their metadata', () => {
    const error = new Error('Could not save photo');
    error.name = 'UploadError';

    expect(serializeError(error)).toMatchObject({
      name: 'UploadError',
      message: 'Could not save photo'
    });
  });

  it('preserves plain objects and converts primitives to strings', () => {
    expect(
      serializeError({
        code: 'INVITE_INVALID',
        message: 'Invitation no longer exists'
      })
    ).toEqual({
      code: 'INVITE_INVALID',
      message: 'Invitation no longer exists'
    });

    expect(serializeError(404)).toEqual({
      message: '404'
    });
  });
});
