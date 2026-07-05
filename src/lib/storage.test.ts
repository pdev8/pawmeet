import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: { auth: { getUser: vi.fn() }, storage: { from: vi.fn() } },
}));

import { supabase } from './supabase';
import { contentTypeFor, photoPath, uploadPublicImage } from './storage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = supabase.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storage = supabase.storage as any;

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUser.mockResolvedValue({ data: { user: { id: 'me' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('contentTypeFor', () => {
  it('maps extensions to MIME types, defaulting to JPEG', () => {
    expect(contentTypeFor('png')).toBe('image/png');
    expect(contentTypeFor('PNG')).toBe('image/png');
    expect(contentTypeFor('webp')).toBe('image/webp');
    expect(contentTypeFor('heic')).toBe('image/heic');
    expect(contentTypeFor('jpg')).toBe('image/jpeg');
    expect(contentTypeFor('gif')).toBe('image/jpeg');
  });
});

describe('photoPath', () => {
  it('namespaces by uploader: <uid>/<kind>/<ts>.<ext>', () => {
    expect(photoPath('me', 'pets', 'jpg', 123)).toBe('me/pets/123.jpg');
  });
});

describe('uploadPublicImage', () => {
  it('uploads under the user’s folder and returns the public URL', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://cdn/photos/me/pets/x.jpg' } }));
    storage.from.mockReturnValue({ upload, getPublicUrl });

    const url = await uploadPublicImage('pets', 'file:///tmp/photo.jpg');

    expect(storage.from).toHaveBeenCalledWith('photos');
    const [path, , opts] = upload.mock.calls[0];
    expect(path).toMatch(/^me\/pets\/\d+\.jpg$/);
    expect(opts).toMatchObject({ contentType: 'image/jpeg', upsert: false });
    expect(url).toBe('https://cdn/photos/me/pets/x.jpg');
  });

  it('derives PNG content type from the uri extension', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    storage.from.mockReturnValue({ upload, getPublicUrl: () => ({ data: { publicUrl: 'u' } }) });
    await uploadPublicImage('avatars', 'file:///tmp/pic.png?token=1');
    expect(upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/png' });
  });

  it('throws when signed out', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(uploadPublicImage('pets', 'file:///x.jpg')).rejects.toThrow('Not signed in');
  });

  it('propagates an upload error', async () => {
    storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: 'nope' } }),
      getPublicUrl: vi.fn(),
    });
    await expect(uploadPublicImage('pets', 'file:///x.jpg')).rejects.toBeTruthy();
  });
});
