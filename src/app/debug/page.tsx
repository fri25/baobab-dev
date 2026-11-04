import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { createDebugSession } from "./actions";

export const metadata = { title: "Pair-Debugging · Baobab Dev" };

export default async function DebugHome() {
  const { supabase, user } = await requireSession("/debug");
  const { data: sessions } = await supabase
    .from("debug_sessions")
    .select("id, title, share_code, status, bytes_sent, created_at")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Pair-Debugging fantôme</h1>
      <p className="mt-1 text-muted">
        Déboguer à plusieurs façon Google Docs, en texte pur : diffs, curseurs, sortie du terminal et messages. Jamais de
        vidéo, moins de 5 Ko/s, même en 2G/3G instable.
      </p>

      <form action={createDebugSession} className="mt-6 flex flex-wrap gap-2">
        <input
          name="title"
          placeholder="Ex. Webhook FedaPay qui renvoie 419"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2"
        />
        <button className="rounded-full bg-primary px-5 py-2 font-medium text-primary-ink">Lancer une session</button>
      </form>
      <p className="mt-2 text-xs text-muted">
        Tu partages ensuite le lien. Les fichiers partagés sont ceux que tu colles ; les secrets (.env, clés) sont masqués
        avant l&apos;envoi.
      </p>

      <h2 className="mt-10 font-semibold">Mes sessions</h2>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
        {sessions?.length ? (
          sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <Link href={`/debug/${s.share_code}`} className="hover:text-primary">
                {s.title}
              </Link>
              <span className="text-xs text-muted">
                {s.status === "live" ? "en cours" : "terminée"} · {(s.bytes_sent / 1024).toFixed(1)} Ko · {timeAgo(s.created_at)}
              </span>
            </li>
          ))
        ) : (
          <li className="px-4 py-6 text-center text-muted">Aucune session.</li>
        )}
      </ul>
    </main>
  );
}
