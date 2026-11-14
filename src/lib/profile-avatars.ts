export const PROFILE_AVATARS_BUCKET = "profile-avatars";
export const MAX_PROFILE_AVATAR_SIZE = 3 * 1024 * 1024;

export const PROFILE_AVATAR_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function isValidProfileAvatar(file: Blob, contentType: string) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (contentType === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export function ownProfileAvatarPath(url: string | null, userId: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base || !url) return null;

  const prefix = `${base}/storage/v1/object/public/${PROFILE_AVATARS_BUCKET}/${userId}/`;
  if (!url.startsWith(prefix)) return null;

  const filename = url.slice(prefix.length);
  return /^[\w-]+\.(?:jpg|png|webp)$/.test(filename) ? `${userId}/${filename}` : null;
}
