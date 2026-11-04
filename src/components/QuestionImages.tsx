// Images d'une question ou d'une réponse : chargées à la demande.
// En mode « données réduites », un lien remplace l'image.
export function QuestionImages({ images, label = "la question" }: { images: string[]; label?: string }) {
  if (!images.length) return null;
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {images.map((url, i) => (
        <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Image ${i + 1} jointe à ${label}`}
            loading="lazy"
            className="aspect-square w-full rounded-lg border border-border object-cover hover:opacity-90"
          />
          <span className="lite-only rounded-lg border border-dashed border-border px-3 py-2 text-sm text-primary">
            Afficher l&apos;image {i + 1}
          </span>
        </a>
      ))}
    </div>
  );
}
