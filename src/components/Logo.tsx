export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M4 11c0-3 3-5 6-4 1-3 4-4 6-3 2-1 5 0 6 3 3-1 6 1 6 4s-3 4-5 3c-1 2-4 2-5 1v2l-1 1h-2l-1-1v-2c-1 1-4 1-5-1-2 1-5 0-5-3z"
        fill="var(--leaf)"
      />
      <path d="M13 15h6l1 13H12z" fill="var(--primary)" />
      <path d="M8 28h16" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
