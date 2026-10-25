// Original line illustrations for each catalogue item (drawn in SVG, no external images).
const S = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ART: Record<string, React.ReactNode> = {
  // Handheld radio
  "RAD-01": (<g {...S}><rect x="38" y="30" width="44" height="70" rx="8" /><line x1="50" y1="30" x2="50" y2="10" /><rect x="46" y="40" width="28" height="18" rx="3" /><circle cx="50" cy="72" r="3" /><circle cx="60" cy="72" r="3" /><circle cx="70" cy="72" r="3" /><circle cx="50" cy="84" r="3" /><circle cx="60" cy="84" r="3" /><circle cx="70" cy="84" r="3" /></g>),
  // Vehicle radio set
  "RAD-02": (<g {...S}><rect x="18" y="42" width="84" height="44" rx="6" /><rect x="26" y="50" width="34" height="14" rx="2" /><circle cx="80" cy="64" r="10" /><line x1="26" y1="74" x2="60" y2="74" /><line x1="94" y1="42" x2="104" y2="14" /></g>),
  // Satellite terminal
  "SAT-01": (<g {...S}><path d="M30 70 A34 34 0 0 1 78 22 Z" /><line x1="54" y1="46" x2="72" y2="28" /><circle cx="74" cy="26" r="4" /><line x1="46" y1="64" x2="40" y2="96" /><line x1="40" y1="96" x2="80" y2="96" /><line x1="60" y1="96" x2="56" y2="70" /></g>),
  // First-aid kit
  "MED-01": (<g {...S}><rect x="22" y="38" width="76" height="54" rx="8" /><path d="M46 38 V30 h28 v8" /><line x1="60" y1="52" x2="60" y2="78" /><line x1="47" y1="65" x2="73" y2="65" /></g>),
  // Tourniquet
  "MED-02": (<g {...S}><path d="M28 60 a32 22 0 1 0 64 0 a32 22 0 1 0 -64 0" /><rect x="50" y="30" width="20" height="14" rx="3" /><line x1="44" y1="37" x2="76" y2="37" /><line x1="82" y1="74" x2="100" y2="96" /></g>),
  // Stretcher
  "MED-03": (<g {...S}><line x1="12" y1="54" x2="108" y2="54" /><line x1="12" y1="70" x2="108" y2="70" /><rect x="26" y="54" width="68" height="16" rx="2" /><line x1="34" y1="70" x2="30" y2="86" /><line x1="86" y1="70" x2="90" y2="86" /></g>),
  // Plate carrier
  "ARM-01": (<g {...S}><path d="M40 20 h12 l8 12 l8 -12 h12 l10 16 v62 h-60 v-62 Z" /><rect x="40" y="58" width="40" height="24" rx="3" /><line x1="40" y1="70" x2="80" y2="70" /></g>),
  // Helmet
  "ARM-02": (<g {...S}><path d="M20 76 C20 40 40 24 60 24 C80 24 100 40 100 76 Z" /><line x1="16" y1="76" x2="104" y2="76" /><path d="M36 76 v10 h48 v-10" /><line x1="60" y1="24" x2="60" y2="40" /></g>),
  // Power bank
  "PWR-01": (<g {...S}><rect x="26" y="34" width="68" height="56" rx="8" /><path d="M46 26 h28" /><path d="M62 46 l-10 16 h12 l-8 16" /><circle cx="84" cy="80" r="3" /></g>),
  // Solar panel
  "PWR-02": (<g {...S}><path d="M20 36 h80 l-8 48 h-64 Z" /><line x1="46" y1="36" x2="42" y2="84" /><line x1="74" y1="36" x2="78" y2="84" /><line x1="16" y1="60" x2="104" y2="60" /><line x1="60" y1="84" x2="60" y2="100" /></g>),
  // Generator
  "PWR-03": (<g {...S}><rect x="20" y="40" width="80" height="48" rx="6" /><path d="M28 40 V30 h64 v10" /><circle cx="44" cy="64" r="12" /><rect x="64" y="54" width="26" height="8" rx="2" /><line x1="66" y1="74" x2="88" y2="74" /><line x1="28" y1="88" x2="28" y2="96" /><line x1="92" y1="88" x2="92" y2="96" /></g>),
  // Reconnaissance drone
  "ISR-01": (<g {...S}><rect x="48" y="52" width="24" height="16" rx="4" /><line x1="48" y1="56" x2="30" y2="40" /><line x1="72" y1="56" x2="90" y2="40" /><line x1="48" y1="64" x2="30" y2="80" /><line x1="72" y1="64" x2="90" y2="80" /><ellipse cx="30" cy="40" rx="12" ry="4" /><ellipse cx="90" cy="40" rx="12" ry="4" /><ellipse cx="30" cy="80" rx="12" ry="4" /><ellipse cx="90" cy="80" rx="12" ry="4" /></g>),
  // Thermal monocular
  "ISR-02": (<g {...S}><rect x="30" y="44" width="56" height="32" rx="10" /><path d="M86 48 l14 -6 v36 l-14 -6" /><circle cx="42" cy="60" r="6" /><line x1="24" y1="56" x2="30" y2="56" /><line x1="24" y1="64" x2="30" y2="64" /></g>),
  // Ration pack
  "SUS-01": (<g {...S}><rect x="24" y="36" width="72" height="56" rx="4" /><path d="M24 36 l10 -12 h52 l10 12" /><line x1="24" y1="56" x2="96" y2="56" /><rect x="48" y="66" width="24" height="14" rx="2" /></g>),
  // Water purification kit
  "SUS-02": (<g {...S}><path d="M60 20 C60 20 34 52 34 70 a26 26 0 0 0 52 0 C86 52 60 20 60 20 Z" /><path d="M48 72 a12 12 0 0 0 12 12" /></g>),
};

export function ProductArt({ id }: { id: string }) {
  return (
    <div className="product-img" aria-hidden="true">
      <svg viewBox="0 0 120 120" width="100%" height="100%">
        {ART[id] ?? <g {...S}><rect x="30" y="30" width="60" height="60" rx="8" /></g>}
      </svg>
    </div>
  );
}
