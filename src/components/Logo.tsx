// Logo Baobab Dev : couronne en arcs (verte) avec le symbole </>, tronc en accolades { } (couleur du texte).
// Les mêmes tracés servent au favicon (public/icon.svg) et à l'icône d'application (public/icon-maskable.svg).
export const LOGO_CROWN = [
  "M4 24 H60", // base de la couronne
  "M14 24 C14 11.5 22 4 32 4 C42 4 50 11.5 50 24", // dôme central
  "M4 24 A8 8 0 0 1 20 24", // lobe gauche
  "M44 24 A8 8 0 0 1 60 24", // lobe droit
  "M6 17 A8.5 8.5 0 0 1 19.5 9.8", // lobe arrière gauche
  "M58 17 A8.5 8.5 0 0 0 44.5 9.8", // lobe arrière droit
  "M14 24 A5.5 5.5 0 0 1 25 24", // arc intérieur gauche
  "M39 24 A5.5 5.5 0 0 1 50 24", // arc intérieur droit
];
export const LOGO_CODE = ["M27.5 10.5 L25 13 L27.5 15.5", "M36.5 10.5 L39 13 L36.5 15.5", "M33.2 9 L30.8 17"];
export const LOGO_TRUNK = [
  "M10 24 C10 29 13 31 17 31 C20 31 22 32 23.5 33.5", // branche gauche
  "M54 24 C54 29 51 31 47 31 C44 31 42.2 32 41 33.2", // branche droite
  "M27 24 C27 27.5 29.5 28.7 32 29.8 C34.5 28.7 37 27.5 37 24", // fourche centrale
  "M32 29.8 C27 32 24 35 24 40 V44 C24 46 22.8 47 20.5 47.5 C22.8 48 24 49 24 51 V58", // tronc gauche {
  "M38.5 36.5 C40 37.2 40.5 38.5 40.5 40 V44 C40.5 46 41.7 47 44 47.5 C41.7 48 40.5 49 40.5 51 V58", // tronc droit }
  "M17 58 H47", // socle
];

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="var(--brand)" strokeWidth="2.6">
        {LOGO_CROWN.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke="var(--brand)" strokeWidth="2.2">
        {LOGO_CODE.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke="currentColor" strokeWidth="2.6">
        {LOGO_TRUNK.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
