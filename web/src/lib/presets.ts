import { PresetLogo } from "@/types";

export const PRESET_LOGOS: PresetLogo[] = [
  {
    id: "vw_r_performance",
    name: "Volkswagen R Performance",
    subtitle: "Golf R, Scirocco R, Passat R36",
    brand: "rline",
    svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#0b1b36"/>
          <stop offset="70%" stop-color="#040914"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <linearGradient id="chromeR" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="35%" stop-color="#cbd5e1"/>
          <stop offset="50%" stop-color="#64748b"/>
          <stop offset="65%" stop-color="#e2e8f0"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>
        <linearGradient id="blueAccent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1d4ed8"/>
          <stop offset="50%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#1e40af"/>
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#bgGlow)"/>
      <g opacity="0.15">
        <line x1="100" y1="240" x2="700" y2="240" stroke="#38bdf8" stroke-width="1"/>
        <line x1="400" y1="80" x2="400" y2="400" stroke="#38bdf8" stroke-width="1"/>
      </g>
      <!-- Horizontal racing stripe -->
      <path d="M 120 280 L 680 280" stroke="url(#blueAccent)" stroke-width="3" stroke-linecap="round"/>
      <!-- Modern R Logo -->
      <g transform="translate(340, 140) scale(1.3)">
        <path d="M 0 0 L 32 0 C 60 0 75 14 75 35 C 75 52 64 63 46 67 L 78 110 L 46 110 L 22 74 L 18 74 L 18 110 L 0 110 Z M 18 18 L 18 56 L 32 56 C 46 56 54 48 54 36 C 54 25 46 18 32 18 Z" fill="url(#chromeR)"/>
        <!-- R dynamic tail accent -->
        <path d="M 68 85 L 95 110 L 82 110 L 58 87 Z" fill="#38bdf8"/>
      </g>
      <text x="400" y="325" font-family="'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="18" fill="#ffffff" letter-spacing="12" text-anchor="middle">PERFORMANCE</text>
      <text x="400" y="348" font-family="'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="11" fill="#60a5fa" letter-spacing="4" text-anchor="middle">R-LINE MOTORSPORT</text>
    </svg>`
  },
  {
    id: "vw_gti_club",
    name: "Golf GTI Clubsport",
    subtitle: "GTI Honeycomb & Red Line",
    brand: "gti",
    svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
      <defs>
        <radialGradient id="gtiGlow" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stop-color="#1f0909"/>
          <stop offset="65%" stop-color="#0a0303"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <pattern id="hex" width="30" height="52" patternUnits="userSpaceOnUse" patternTransform="scale(0.8)">
          <path d="M 15 0 L 30 8.66 L 30 26 L 15 34.66 L 0 26 L 0 8.66 Z M 0 43.33 L 15 52 L 30 43.33" stroke="#2a1212" stroke-width="1.2" fill="none" opacity="0.4"/>
        </pattern>
        <linearGradient id="redStripe" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#991b1b"/>
          <stop offset="50%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#991b1b"/>
        </linearGradient>
        <linearGradient id="gtiChrome" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="50%" stop-color="#d1d5db"/>
          <stop offset="100%" stop-color="#6b7280"/>
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#gtiGlow)"/>
      <rect width="800" height="480" fill="url(#hex)"/>
      <!-- Signature GTI Red Line -->
      <rect x="0" y="240" width="800" height="6" fill="url(#redStripe)"/>
      <rect x="150" y="238" width="500" height="2" fill="#fca5a5" opacity="0.6"/>
      <!-- GTI Typography -->
      <g transform="translate(230, 130)">
        <!-- G -->
        <path d="M 75 25 C 70 12 55 5 38 5 C 16 5 0 22 0 45 C 0 68 16 85 40 85 C 62 85 75 72 75 52 L 40 52 L 40 40 L 89 40 C 90 75 68 98 38 98 C 10 98 -14 74 -14 45 C -14 16 10 -8 40 -8 C 65 -8 85 4 90 20 Z" fill="url(#gtiChrome)"/>
        <!-- T -->
        <path d="M 100 5 L 170 5 L 170 20 L 143 20 L 143 85 L 127 85 L 127 20 L 100 20 Z" fill="url(#gtiChrome)"/>
        <!-- I with Red Accent -->
        <rect x="185" y="5" width="18" height="80" fill="#ef4444"/>
        <rect x="185" y="5" width="4" height="80" fill="#fca5a5"/>
      </g>
      <text x="400" y="315" font-family="'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="14" text-anchor="middle">SINCE 1976</text>
      <text x="400" y="340" font-family="'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="11" fill="#ef4444" letter-spacing="5" text-anchor="middle">GRAN TURISMO INJECTION</text>
    </svg>`
  },
  {
    id: "vw_oem_emblem",
    name: "Volkswagen OEM Emblem",
    subtitle: "Classic Chrome Roundel on Dark Cobalt",
    brand: "vw",
    svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
      <defs>
        <radialGradient id="oemGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="#0a1a33"/>
          <stop offset="60%" stop-color="#040a17"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <linearGradient id="ringChrome" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="25%" stop-color="#cbd5e1"/>
          <stop offset="50%" stop-color="#475569"/>
          <stop offset="75%" stop-color="#94a3b8"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#oemGlow)"/>
      <g transform="translate(400, 220)">
        <!-- Outer chrome ring -->
        <circle r="120" fill="none" stroke="url(#ringChrome)" stroke-width="14"/>
        <circle r="102" fill="none" stroke="#0f172a" stroke-width="3"/>
        <!-- Inner V -->
        <path d="M -55 -60 L -18 35 L 0 -15 L 18 35 L 55 -60 L 32 -60 L 10 -5 L 0 -30 L -10 -5 L -32 -60 Z" fill="url(#ringChrome)"/>
        <!-- Inner W -->
        <path d="M -75 -15 L -35 80 L -15 80 L -3 -15 L 3 -15 L 15 80 L 35 80 L 75 -15 L 55 -15 L 26 55 L 12 -15 L -12 -15 L -26 55 L -55 -15 Z" fill="url(#ringChrome)"/>
      </g>
      <text x="400" y="390" font-family="'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="14" fill="#cbd5e1" letter-spacing="10" text-anchor="middle">VOLKSWAGEN</text>
      <text x="400" y="410" font-family="'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="10" fill="#64748b" letter-spacing="4" text-anchor="middle">DAS AUTO</text>
    </svg>`
  },
  {
    id: "skoda_vrs_rally",
    name: "Škoda vRS Motorsport",
    subtitle: "Octavia RS, Fabia RS, Kodiaq RS",
    brand: "skoda",
    svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
      <defs>
        <radialGradient id="skodaGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#062414"/>
          <stop offset="70%" stop-color="#020d07"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <linearGradient id="vrsGreen" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#22c55e"/>
          <stop offset="100%" stop-color="#15803d"/>
        </linearGradient>
        <linearGradient id="vrsRed" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#b91c1c"/>
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#skodaGlow)"/>
      <!-- Slanted rally bars -->
      <g transform="translate(400, 200) skewX(-20)">
        <!-- Green V -->
        <rect x="-180" y="-50" width="35" height="100" fill="url(#vrsGreen)" rx="4"/>
        <!-- Red Accent bar -->
        <rect x="-135" y="-50" width="18" height="100" fill="url(#vrsRed)" rx="4"/>
        <!-- RS Chrome letters -->
        <text x="-90" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="95" fill="#f8fafc" letter-spacing="2">RS</text>
      </g>
      <text x="400" y="330" font-family="'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="16" fill="#22c55e" letter-spacing="8" text-anchor="middle">ŠKODA MOTORSPORT</text>
      <text x="400" y="355" font-family="'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="11" fill="#94a3b8" letter-spacing="4" text-anchor="middle">COLUMBUS NAVIGATION</text>
    </svg>`
  },
  {
    id: "seat_cupra_tribal",
    name: "SEAT Cupra Tribal",
    subtitle: "Leon Cupra, Ibiza Cupra, Formentor",
    brand: "seat",
    svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
      <defs>
        <radialGradient id="cupraGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="#1f140a"/>
          <stop offset="65%" stop-color="#0a0703"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <linearGradient id="copperMetal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="35%" stop-color="#d97706"/>
          <stop offset="65%" stop-color="#b45309"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#cupraGlow)"/>
      <!-- Tribal Cupra Badge -->
      <g transform="translate(400, 210) scale(1.1)">
        <path d="M 0 -80 L 45 -20 L 70 -50 L 55 10 L 0 70 L -55 10 L -70 -50 L -45 -20 Z" fill="none" stroke="url(#copperMetal)" stroke-width="12" stroke-linejoin="round"/>
        <path d="M 0 -50 L 25 -10 L 0 45 L -25 -10 Z" fill="url(#copperMetal)"/>
      </g>
      <text x="400" y="340" font-family="'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="#f59e0b" letter-spacing="14" text-anchor="middle">CUPRA</text>
      <text x="400" y="365" font-family="'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="11" fill="#92400e" letter-spacing="6" text-anchor="middle">SEAT MEDIA SYSTEM</text>
    </svg>`
  },
  {
    id: "wolfsburg_edition",
    name: "Wolfsburg Edition Crest",
    subtitle: "Heritage Wolfsburg Castle & Wolf",
    brand: "vw",
    svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
      <defs>
        <radialGradient id="wbGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#171e2e"/>
          <stop offset="65%" stop-color="#080c14"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <linearGradient id="goldPlate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="40%" stop-color="#eab308"/>
          <stop offset="70%" stop-color="#ca8a04"/>
          <stop offset="100%" stop-color="#854d0e"/>
        </linearGradient>
      </defs>
      <rect width="800" height="480" fill="url(#wbGlow)"/>
      <g transform="translate(400, 210) scale(1.1)">
        <!-- Shield -->
        <path d="M -60 -70 L 60 -70 L 60 10 C 60 60 0 85 0 85 C 0 85 -60 60 -60 10 Z" fill="#0f172a" stroke="url(#goldPlate)" stroke-width="5"/>
        <!-- Castle battlement -->
        <path d="M -40 -50 L -40 -30 L -25 -30 L -25 -40 L -10 -40 L -10 -30 L 10 -30 L 10 -40 L 25 -40 L 25 -30 L 40 -30 L 40 -50 Z" fill="url(#goldPlate)"/>
        <!-- River lines -->
        <path d="M -40 30 Q 0 45 40 30" stroke="url(#goldPlate)" stroke-width="3" fill="none"/>
        <path d="M -30 45 Q 0 60 30 45" stroke="url(#goldPlate)" stroke-width="2" fill="none"/>
      </g>
      <text x="400" y="340" font-family="'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="16" fill="url(#goldPlate)" letter-spacing="10" text-anchor="middle">WOLFSBURG</text>
      <text x="400" y="362" font-family="'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="11" fill="#cbd5e1" letter-spacing="6" text-anchor="middle">SPECIAL EDITION</text>
    </svg>`
  }
];

export function generateCustomBadgeSvg(text: string, subtitle: string, accentColor: string): string {
  const safeText = (text || "RNS 510").toUpperCase();
  const safeSub = (subtitle || "CUSTOM BOOTLOGO").toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
    <defs>
      <radialGradient id="customGlow" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="#111827"/>
        <stop offset="70%" stop-color="#05070c"/>
        <stop offset="100%" stop-color="#000000"/>
      </radialGradient>
      <linearGradient id="customAccent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#111827"/>
        <stop offset="50%" stop-color="${accentColor}"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
    </defs>
    <rect width="800" height="480" fill="url(#customGlow)"/>
    <g opacity="0.3">
      <circle cx="400" cy="240" r="170" fill="none" stroke="${accentColor}" stroke-width="1" stroke-dasharray="8 6"/>
      <circle cx="400" cy="240" r="140" fill="none" stroke="#334155" stroke-width="1"/>
    </g>
    <!-- Accent Line -->
    <rect x="150" y="275" width="500" height="3" fill="url(#customAccent)"/>
    <!-- Main Text -->
    <text x="400" y="245" font-family="'Segoe UI', Montserrat, sans-serif" font-weight="900" font-size="44" fill="#ffffff" letter-spacing="8" text-anchor="middle">${safeText}</text>
    <!-- Subtitle -->
    <text x="400" y="315" font-family="'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="14" fill="${accentColor}" letter-spacing="6" text-anchor="middle">${safeSub}</text>
    <!-- Tiny copyright / tag -->
    <text x="400" y="340" font-family="'Segoe UI', Roboto, sans-serif" font-weight="500" font-size="10" fill="#64748b" letter-spacing="3" text-anchor="middle">VOLKSWAGEN NAVIGATION SYSTEM</text>
  </svg>`;
}
