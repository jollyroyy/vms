import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateAvatarFile,
  avatarPath,
  uploadAvatar,
  removeAvatar,
  MAX_AVATAR_BYTES,
} from '../../../src/lib/avatarUpload';

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('../../../src/supabaseClient', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: any[]) => mockUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
        remove: (...args: any[]) => mockRemove(...args),
      }),
    },
    from: () => ({
      update: (data: any) => {
        mockUpdate(data);
        return { eq: (...args: any[]) => mockEq(...args) };
      },
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/avatars/user-1/avatar' } });
  mockEq.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ error: null });
});

describe('validateAvatarFile', () => {
  it('returns null for a valid image', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1024 })).toBeNull();
  });

  it('returns an error string for a non-image type', () => {
    expect(validateAvatarFile({ type: 'text/plain', size: 1024 })).toEqual(
      expect.stringContaining('image file'),
    );
  });

  it('returns an error string for a file over MAX_AVATAR_BYTES', () => {
    expect(validateAvatarFile({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 })).toEqual(
      expect.stringContaining('2 MB'),
    );
  });
});

describe('avatarPath', () => {
  it('is `${userId}/avatar` with no extension', () => {
    expect(avatarPath('user-1')).toBe('user-1/avatar');
  });
});

describe('uploadAvatar', () => {
  it('rejects an invalid file without calling storage upload', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });
    const result = await uploadAvatar('user-1', file as any);
    expect('error' in result).toBe(true);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('on success writes the public URL to profiles.avatar_url and returns { url } with a cache-busting suffix', async () => {
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    const result = await uploadAvatar('user-1', file as any);
    expect('url' in result).toBe(true);
    const url = (result as { url: string | null }).url as string;
    expect(url).toMatch(/^https:\/\/cdn\.example\.com\/avatars\/user-1\/avatar\?t=\d+$/);
    expect(mockUpdate).toHaveBeenCalledWith({ avatar_url: url });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('returns a configuration-specific error message when storage reports a missing bucket', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Bucket not found' } });
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    const result = await uploadAvatar('user-1', file as any);
    expect(result).toEqual({ error: expect.stringContaining('migration 053') });
  });
});

describe('removeAvatar', () => {
  it('sets avatar_url to null and calls storage.remove with the avatar path', async () => {
    const result = await removeAvatar('user-1');
    expect(result).toEqual({ url: null });
    expect(mockUpdate).toHaveBeenCalledWith({ avatar_url: null });
    expect(mockRemove).toHaveBeenCalledWith(['user-1/avatar']);
  });
});
