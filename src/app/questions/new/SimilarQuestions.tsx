"use client";

import { useT } from "@/lib/i18n/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { similarQuestions } from "../actions";

type Similar = Awaited<ReturnType<typeof similarQuestions>>;

// Avant publication, le Griot suggère les questions existantes (§5.3)
export function TitleWithSuggestions() {
  const t = useT();
  const [title, setTitle] = useState("");
  const [similar, setSimilar] = useState<Similar>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      similarQuestions(title).then(setSimilar);
    }, 500);
    return () => clearTimeout(timer);
  }, [title]);

  return (
    <div>
      <label className="block text-sm font-medium" htmlFor="title">
        {t("Titre")}
      </label>
      <input
        id="title"
        name="title"
        required
        minLength={10}
        maxLength={200}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("Ex. Comment vérifier la signature d'un webhook FedaPay dans Laravel ?")}
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2"
      />
      {similar.length > 0 && (
        <div className="mt-2 rounded-lg border border-leaf/40 bg-leaf/5 p-3 text-sm">
          <p className="font-medium text-leaf">{t("Le Griot a trouvé des questions proches :")}</p>
          <ul className="mt-1 space-y-1">
            {similar.map((s) => (
              <li key={s.id}>
                <Link href={`/questions/${s.id}`} target="_blank" className="hover:text-primary">
                  {s.title}
                </Link>{" "}
                <span className="text-xs text-muted">
                  {s.has_accepted ? t("· réponse validée") : `· ${s.answers_count} réponse(s)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
