// GCC - brand asset generator.
//
// The brand is generated from one geometric source of truth so every SVG and
// raster asset stays consistent. Run with:
//   node scripts/generate-brand.mjs
//
// Requires sharp (already present as a Next.js dependency).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const brandDir = path.join(root, "public", "brand");
const publicDir = path.join(root, "public");

const palettes = {
  // Light artwork for dark surfaces.
  dark: {
    orbit: "#56B8FF",
    bar: "#FFFFFF",
    node: "#F5C443",
    inner: "#FFFFFF",
    innerOpacity: "0.22",
    text: "#FFFFFF",
    muted: "#93B0DA",
    background: "#050F1F",
  },
  // Dark artwork for light surfaces.
  light: {
    orbit: "#157BE8",
    bar: "#0A1B33",
    node: "#E0A82E",
    inner: "#0A1B33",
    innerOpacity: "0.18",
    text: "#0A1B33",
    muted: "#37669F",
    background: "#FFFFFF",
  },
};

// The mark: a circuit orbit drawn as a G, with a pitch crossbar and a gold
// champion node. No trophy, no star, no shield, no borrowed football marks.
function symbol(palette) {
  return `
    <circle cx="32" cy="32" r="10" fill="none" stroke="${palette.inner}" stroke-opacity="${palette.innerOpacity}" stroke-width="1.6"/>
    <path d="M49.2 20A21 21 0 1 0 49.2 44" fill="none" stroke="${palette.orbit}" stroke-width="6.5" stroke-linecap="square"/>
    <path d="M49.2 32V44" fill="none" stroke="${palette.orbit}" stroke-width="6.5" stroke-linecap="square"/>
    <path d="M32 32H49.2" fill="none" stroke="${palette.bar}" stroke-width="6.5" stroke-linecap="square"/>
    <circle cx="49.2" cy="32" r="4" fill="${palette.node}"/>
  `;
}

function wordmark(palette) {
  return `
    <g transform="translate(90 4)" fill="none" stroke="${palette.bar}" stroke-width="7" stroke-linecap="square">
      <path d="M32.5 12.4A15 15 0 1 0 36 22H24"/>
      <path d="M75.3 13.4A15 15 0 1 0 75.3 30.6"/>
      <path d="M130.3 13.4A15 15 0 1 0 130.3 30.6"/>
    </g>
  `;
}

function svgDocument({ viewBox, label, children }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}">
  <title>${label}</title>
${children}
</svg>
`;
}

function symbolSvg(palette, label) {
  return svgDocument({
    viewBox: "0 0 64 64",
    label,
    children: symbol(palette),
  });
}

function horizontalSvg(palette, label) {
  return svgDocument({
    viewBox: "0 0 350 80",
    label,
    children: `
  <g transform="translate(6 8)">${symbol(palette)}</g>
  ${wordmark(palette)}
  <text x="92" y="71" font-family="Arial, Helvetica, sans-serif" font-size="10.5" letter-spacing="3.4" fill="${palette.muted}">GLOBAL CHAMPIONS CIRCUIT</text>
`,
  });
}

function compactSvg(palette, label) {
  return svgDocument({
    viewBox: "0 0 235 80",
    label,
    children: `
  <g transform="translate(6 8)">${symbol(palette)}</g>
  ${wordmark(palette)}
`,
  });
}

function faviconSvg() {
  const palette = palettes.dark;
  return svgDocument({
    viewBox: "0 0 64 64",
    label: "GCC",
    children: `
  <rect width="64" height="64" rx="14" fill="${palette.background}"/>
  <g transform="translate(4 4) scale(0.875)">${symbol(palette)}</g>
  <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="#56B8FF" stroke-opacity="0.28"/>
`,
  });
}

function maskableSvg() {
  const palette = palettes.dark;
  return svgDocument({
    viewBox: "0 0 512 512",
    label: "GCC",
    children: `
  <rect width="512" height="512" fill="${palette.background}"/>
  <g transform="translate(128 128) scale(4)">${symbol(palette)}</g>
`,
  });
}

function ogSvg() {
  const palette = palettes.dark;
  return svgDocument({
    viewBox: "0 0 1200 630",
    label: "Global Champions Circuit - One Platform. Endless Competition.",
    children: `
  <defs>
    <radialGradient id="glow" cx="82%" cy="18%" r="70%">
      <stop offset="0%" stop-color="#2E9BFF" stop-opacity="0.28"/>
      <stop offset="55%" stop-color="#2E9BFF" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#2E9BFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#132B4B" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0A1B33" stop-opacity="0.2"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#FFFFFF" stroke-opacity="0.035" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="#050F1F"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <g opacity="0.5">
    <circle cx="1030" cy="250" r="250" fill="none" stroke="#56B8FF" stroke-opacity="0.16" stroke-width="1.5"/>
    <circle cx="1030" cy="250" r="180" fill="none" stroke="#56B8FF" stroke-opacity="0.12" stroke-width="1.5"/>
    <circle cx="1030" cy="250" r="110" fill="none" stroke="#56B8FF" stroke-opacity="0.1" stroke-width="1.5"/>
    <circle cx="1030" cy="70" r="6" fill="#F5C443"/>
    <circle cx="1210" cy="250" r="5" fill="#56B8FF"/>
    <circle cx="1030" cy="430" r="5" fill="#56B8FF"/>
    <circle cx="850" cy="250" r="5" fill="#56B8FF"/>
  </g>

  <g transform="translate(80 96) scale(1.55)">${symbol(palette)}</g>
  <g transform="translate(230 116) scale(1.9)">${wordmark(palette)}</g>

  <text x="82" y="330" font-family="Arial, Helvetica, sans-serif" font-size="20" letter-spacing="5.5" fill="#8FD2FF">INDEPENDENT FOOTBALL GAMING COMPETITION</text>
  <text x="80" y="430" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="700" fill="#FFFFFF">One Platform.</text>
  <text x="80" y="500" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="700" fill="#FFFFFF">Endless Competition.</text>
  <text x="82" y="556" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#93B0DA">Leagues, draws, fixtures, verified results and permanent records.</text>

  <rect x="80" y="590" width="1040" height="1" fill="#FFFFFF" fill-opacity="0.1"/>
  <text x="82" y="616" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="3" fill="#64748B">GLOBAL CHAMPIONS CIRCUIT</text>
  <text x="1118" y="616" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="3" fill="#64748B">36 TEAMS  /  8 MATCHDAYS  /  4 POTS</text>
`,
  });
}

async function renderPng(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png()
    .toFile(path.join(publicDir, file));
}

async function main() {
  await mkdir(brandDir, { recursive: true });

  const files = {
    "gcc-symbol-light.svg": symbolSvg(palettes.dark, "GCC symbol"),
    "gcc-symbol-dark.svg": symbolSvg(palettes.light, "GCC symbol"),
    "gcc-logo-horizontal-light.svg": horizontalSvg(palettes.dark, "Global Champions Circuit"),
    "gcc-logo-horizontal-dark.svg": horizontalSvg(palettes.light, "Global Champions Circuit"),
    "gcc-logo-compact-light.svg": compactSvg(palettes.dark, "Global Champions Circuit"),
    "gcc-logo-compact-dark.svg": compactSvg(palettes.light, "Global Champions Circuit"),
    "og-image.svg": ogSvg(),
  };

  await Promise.all(
    Object.entries(files).map(([name, content]) =>
      writeFile(path.join(brandDir, name), content, "utf8"),
    ),
  );

  await writeFile(path.join(publicDir, "favicon.svg"), faviconSvg(), "utf8");

  const favicon = faviconSvg();
  await renderPng(favicon, 16, "favicon-16.png");
  await renderPng(favicon, 32, "favicon-32.png");
  await renderPng(favicon, 48, "favicon-48.png");
  await renderPng(favicon, 180, "apple-touch-icon.png");
  await renderPng(favicon, 192, "icon-192.png");
  await renderPng(favicon, 512, "icon-512.png");
  await renderPng(maskableSvg(), 512, "icon-maskable-512.png");

  await sharp(Buffer.from(ogSvg()), { density: 144 })
    .resize(1200, 630)
    .png()
    .toFile(path.join(publicDir, "og-image.png"));

  const manifest = {
    name: "Global Champions Circuit",
    short_name: "GCC",
    description:
      "Independent tournament infrastructure for football gaming communities: leagues, draws, fixtures, verified results and permanent records.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#050F1F",
    theme_color: "#050F1F",
    categories: ["sports", "games", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  await writeFile(
    path.join(publicDir, "manifest.webmanifest"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log("Brand assets written to public/brand and public/.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
