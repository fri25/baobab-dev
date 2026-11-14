const TECH_STACK = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "PHP",
  "C++",
  "Java",
  "SQL",
  "React",
  "Node.js",
  "Docker",
  "Git",
  "PostgreSQL",
  "Tailwind CSS",
  "GraphQL",
];

export function TechMarquee() {
  return (
    <section
      aria-labelledby="tech-marquee-title"
      className="relative my-2 overflow-hidden border-y border-border/70 bg-background py-4"
    >
      <h2 id="tech-marquee-title" className="sr-only">
        Langages et technologies de la communauté
      </h2>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent sm:w-24"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent sm:w-24"
      />
      <div className="animate-marquee">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center gap-12 pr-12"
          >
            {TECH_STACK.map((tech) => (
              <li
                key={tech}
                className="flex items-center gap-2 whitespace-nowrap font-mono text-xs tracking-wider text-muted uppercase transition-colors hover:text-primary sm:text-sm"
              >
                <span aria-hidden="true" className="text-primary">
                  #
                </span>
                {tech}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
