import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

const BUCKET = 'photos';

export type PhotoKind = 'pets' | 'events' | 'reviews' | 'avatars';

/** MIME type for a file extension (defaults to JPEG). */
export function contentTypeFor(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'heic' || e === 'heif') return 'image/heic';
  return 'image/jpeg';
}

/** Object path namespaced by uploader: `<uid>/<kind>/<ts>.<ext>` (RLS keys on the first folder). */
export function photoPath(uid: string, kind: PhotoKind, ext: string, ts: number): string {
  return `${uid}/${kind}/${ts}.${ext}`;
}

function extFromUri(uri: string): string {
  const raw = uri.split('?')[0].split('.').pop() ?? 'jpg';
  return /^[a-z0-9]+$/i.test(raw) ? raw.toLowerCase() : 'jpg';
}

/** Upload a local image URI to the public photos bucket; returns its public URL. */
export async function uploadPublicImage(kind: PhotoKind, uri: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const ext = extFromUri(uri);
  const path = photoPath(user.id, kind, ext, Date.now());
  const bytes = await fetch(uri).then((r) => r.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: contentTypeFor(ext), upsert: false });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Prompt the photo library and return the chosen image URI (null if denied/cancelled). */
export async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0].uri;
}
