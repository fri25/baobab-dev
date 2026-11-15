import { getT } from "@/lib/i18n/server";
const TECH_STACK = [
  { name: "Python", category: "lang" },
  { name: "TypeScript", category: "lang" },
  { name: "Flutter", category: "mobile" },
  { name: "Laravel", category: "backend" },
  { name: "React", category: "frontend" },
  { name: "Tailwind CSS", category: "frontend" },
  { name: "Supabase", category: "database" },
  { name: "PostgreSQL", category: "database" },
  { name: "Go", category: "backend" },
  { name: "Mobile Money", category: "payment" },
  { name: "Wave API", category: "payment" },
  { name: "Docker", category: "devops" },
  { name: "PHP", category: "backend" },
  { name: "USSD / SMS", category: "telecom" },
  { name: "Node.js", category: "backend" },
  { name: "Rust", category: "lang" },
  { name: "pgvector", category: "ai" },
];

export async function TechMarquee() {
  const t = await getT();
  return (
    <section
      aria-labelledby="tech-marquee-title"
      className="relative my-4 w-full max-w-full overflow-hidden border-y border-border/70 bg-surface/30 py-4 backdrop-blur-xs"
    >
      <h2 id="tech-marquee-title" className="sr-only">
        {t("Technologies et piles logicielles de la communauté")}
      </h2>

      {/* Masques de fondu latéraux */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-32"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-32"
      />

      <div className="animate-marquee">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center gap-6 pr-6"
          >
            {TECH_STACK.map((tech) => (
              <li
                key={tech.name}
                className="group flex items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-3.5 py-1.5 text-xs font-medium text-muted shadow-2xs transition hover:border-primary/50 hover:bg-surface hover:text-foreground sm:text-sm"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-primary/70 transition group-hover:scale-125 group-hover:bg-primary"
                />
                <span className="font-mono">{tech.name}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
