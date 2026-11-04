export const QUESTION_IMAGES_BUCKET = "question-images";
export const MAX_QUESTION_IMAGES = 4;

export const publicImagePrefix = () =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${QUESTION_IMAGES_BUCKET}/`;

// N'accepte que des images déposées par l'utilisateur dans son propre dossier
export function validImageUrls(raw: FormDataEntryValue[], userId: string) {
  const prefix = `${publicImagePrefix()}${userId}/`;
  return raw
    .map(String)
    .filter((url) => url.startsWith(prefix) && /^[\w-]+\.(webp|jpe?g|png|gif)$/.test(url.slice(prefix.length)))
    .slice(0, MAX_QUESTION_IMAGES);
}
