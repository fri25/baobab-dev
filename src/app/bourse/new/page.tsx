import { requireSession } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { createBounty } from "../actions";

export const metadata = { title: "Créer un ticket · Micro-Bourse" };

const input = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2";

export default async function NewBountyPage({ searchParams }: { searchParams: Promise<{ error?: string; question?: string; issue?: string; titre?: string }> }) {
  const { supabase, user } = await requireSession("/bourse/new");
  const { error, question: questionId, issue, titre } = await searchParams;
  // Une issue GitHub peut devenir un ticket (§7.2)
  const issueRepo = issue?.match(/^https:\/\/github\.com\/[^/]+\/[^/]+/)?.[0];

  const [{ data: wallet }, { data: question }] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", user.id).single(),
    questionId
      ? supabase.from("questions").select("id, title, body").eq("id", questionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const deadline = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Créer un ticket</h1>
      <p className="mt-1 text-muted">
        La prime est bloquée en séquestre dès la création et visible de tous. Solde disponible :{" "}
        <strong>{fcfa(wallet?.balance ?? 0)}</strong>
      </p>
      {error && <p className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{error}</p>}

      <form action={createBounty} className="mt-6 space-y-4">
        {question && <input type="hidden" name="question_id" value={question.id} />}
        <label className="block text-sm font-medium">
          Titre
          <input name="title" required defaultValue={question?.title ?? titre} className={input} />
        </label>
        <label className="block text-sm font-medium">
          Description du bug ou de la fonctionnalité
          <textarea name="description" required rows={4} defaultValue={question?.body ?? (issue ? `Issue : ${issue}` : undefined)} className={input} />
        </label>
        <label className="block text-sm font-medium">
          Dépôt GitHub
          <input name="repo_url" type="url" required defaultValue={issueRepo} placeholder="https://github.com/moi/mon-projet" className={input} />
        </label>
        <label className="block text-sm font-medium">
          Critères d&apos;acceptation
          <textarea
            name="acceptance_criteria"
            required
            rows={3}
            placeholder="Le test tests/PaymentTest.php passe : un paiement FedaPay approuvé met la commande à « payée »."
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Chemin des tests d&apos;acceptation (verrouillés : une PR ne peut pas les modifier)
          <input name="tests_path" placeholder="tests/Feature/PaymentTest.php" className={`${input} font-mono text-sm`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Prime (FCFA, minimum 2 000)
            <input name="amount" type="number" min={2000} step={500} required defaultValue={25000} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Date limite
            <input name="deadline" type="date" required defaultValue={deadline} className={input} />
          </label>
        </div>
        <p className="text-xs text-muted">
          10 % de commission à la libération. Ticket expiré : remboursement des contributeurs au prorata.
        </p>
        <button className="rounded-full bg-primary px-6 py-2.5 font-medium text-primary-ink">Bloquer la prime et publier</button>
      </form>
    </main>
  );
}
