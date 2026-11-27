# FORGE PH website: build contract

Cinematic scroll site for **FORGE PH 2027, The International Cross-Industry Startup Forum** (presented by ICCPI,
Italian Chamber of Commerce in the Philippines). Piaggio Group sponsorship is kept off the site until Piaggio confirms
(prepared in docs/main-sponsor-blocks.html).
27 January 2027, 10:00 AM to 6:00 PM, WhiteSpace, Makati, Philippines.

**Multi-page (2027 update).** Pages are folders with an `index.html` (listed in `PAGES` in `vite.config.js`):
home (`/`: hero, why, journey, startup, join), `/programme/`, `/how-forge-works/`, `/workshop-fd90/`,
`/international-forge/`, `/partners/`, `/register/conference|booth|workshop/`. Each page includes the same
splash, chrome and footer partials plus its own sections. Partials: `<!--@include id-->` or
`<!--@include dir/name-->` (nested includes work). The GL stage only loads acts for sections present on the page.
Registration: `shared/registration.js` (schema, used by browser and server), `api/register.js` (Vercel function),
setup in `docs/registration-setup.md`. The section map below describes the original 2026 one-page build; the
problem, audience and ask sections were removed in the 2027 update.

Stack: Vite 8, vanilla ES modules (plain JS, no TS, no framework), three 0.186, gsap 3.15 (+ScrollTrigger), lenis.
Run: `npm run dev` / `npm run build`. Source material (READ IT, it is the content): `_source/*.txt`
(`DOC-20260913-WA0005-3.txt` = pitch deck, `FORGE_PH_Programme_Public_Facing_v6-2-2.txt` = public programme,
`pitch.txt` = pptx text). Brand reference images: `_source/img/` (poster_img0.png is the key visual,
DOC-2026_*.png the dark deck, FORGE_PH_*.png the cream programme).

## Brand
- Palette (CSS vars in `src/styles/tokens.css`, never hardcode other colours): ink `#080B0E`, navy `#101925`/`#11253A`,
  ember `#E85B22` (the ONE accent), ember-hot/glow for light emission, cream `#F5F0E8` (light "paper" sections),
  fog/mute greys. ICCPI tricolour (green/red/blue) only for the logo context.
- Type: display serif = Georgia stack (`--font-serif`, `.h-display`, italic `<em>` in ember for emphasis, as the deck
  does: "A 90-day investment *compound*."). Sans = Archivo variable with width axis (`--font-sans`); heavy expanded
  uppercase (`.h-block`) for the FORGE wordmark feel of the poster; wide-tracked small caps labels (`.label`).
- Visual motif: molten forged-metal ribbon with ember sparks + glowing network nodes/lines (poster). Dark, cinematic,
  premium, editorial. Alternate a few cream "paper" sections (programme doc look) for rhythm.
- Images available: `/img/poster-900.webp`, `/img/poster-1600.webp`, `/img/ribbon-1280.webp`, `/img/iccpi-logo.webp|png`.
- Link preview (share) image: `/img/og-forge-ph-2027.jpg`, 1200x630, a baseline JPEG under 300 KB. Every page's `og:image` and `twitter:image`, and the Event JSON-LD on the home page, point at it (`ribbon-1280.webp` is no longer the share image). It shows the date, time and venue, so replace it when those change, and give the new file a new name so shared links do not keep showing the cached old card. `npm test` checks that each page's tags match the file.

## Search (SEO)
- Every indexable page: unique `<title>` (65 characters or fewer) and meta description (70 to 160), canonical and `og:url` on
  `https://www.forgeph.org` with a trailing slash, `og:site_name`, and the square icons (`/favicon.ico`,
  `/img/favicon-192.png`, `/img/apple-touch-icon.png`: FORGE above its orange PH on black, rebuilt with
  `node scripts/build-favicons.mjs`).
- The home page JSON-LD describes the site (`WebSite`), ICCPI (`Organization`) and the forum (`Event`). Every other
  indexable page has a `BreadcrumbList`.
- A new page goes in `PAGES` (`vite.config.js`), `public/sitemap.xml`, the redirects in `vercel.json` and the path list
  in `tests/seo.test.mjs`. `npm test` checks all of the above.

## Copy rules (user's hard design preferences)
- NO hyphens or dashes before text and no decorative leading lines before labels. Write `THESIS`, `01`, never
  `01 —`, `—— WHO WE ARE`, `- item`.
- Avoid em/en dashes in UI copy. The source uses many: rewrite with a period, comma or colon.
  ("D+0 · Outcome" is fine. Times like 09:00 fine. Compound words like "cross-border", "90-day" are fine.)
- Keep the source's meaning and facts exactly. Do not invent stats, names, sponsors, prices or speakers.
- Preserve the legal/trust boundaries: FORGE does not guarantee investment, no endorsement, etc.

## Architecture (OOP, one folder per section, no shared-file edits)
Each section owns `src/sections/<id>/` and ONLY touches files inside it:
- `<id>.html`  partial injected at build time into `index.html` via `<!--@include <id>-->` (already present).
  Root element: `<section class="sec sec--<id>" id="<id>" data-section="<id>" aria-labelledby="...">`.
  Semantic, accessible, real text in HTML (SEO + LCP). No inline `<script>`.
- `<id>.css`   auto-imported (glob). Scope EVERY selector under `.sec--<id>` (or the root class you own).
  Mobile first; must look great 320px to 2560px wide, portrait and landscape. No horizontal overflow.
- `<Name>Section.js` default export `class extends BaseSection` (`src/core/BaseSection.js`) with `static id = '<id>'`.
  Auto-discovered (glob). Put scroll animations in `init()` inside `this.gsap(() => {...})`; DOM events via
  `this.listen()`; per-frame work (2D canvas, physics) in `update(dt, t)` which runs only while visible.
  Split helpers into extra classes/files in the same folder (e.g. `NodeGraph.js`) rather than one huge file.
  Keep files < 400 lines, functions small.
- `<Name>Act.js` OPTIONAL default export `class extends GLAct` (`src/gl/GLAct.js`): the section's three.js layer,
  rendered by the single shared `Stage` (one canvas `#gl`, fixed, behind content). Auto-discovered, lazy loaded
  when the section is within one viewport. Read `src/gl/GLAct.js` and `src/gl/Stage.js` for the contract.
  Multiply your opacity by `state.visibility`. Drive animation by `state.progress` (scroll) and `state.pointer`.
  Align 3D with a DOM box via `this.stage.rectToWorld(el.getBoundingClientRect(), z)`.
  Import three as `import { ... } from 'three'` (named imports only, tree-shaken). Addons from `three/addons/...`
  only if truly needed. Write custom ShaderMaterials for wow (glow via additive blending, no postprocessing pass).

Core (read only, do not edit): `src/core/App.js`, `Scroll.js`, `Device.js`, `BaseSection.js`, `src/gl/*`,
`src/styles/*`, `index.html`, `vite.config.js`. If you truly need a core change, describe it in your final report.

**Never import `three` from a `*Section.js` file or its helpers**: sections are in the initial bundle, three is a
lazy 130 KB chunk loaded only by Act files.

To check your work compiles without clobbering other agents: `npx vite build --outDir .build/<your-group> --emptyOutDir`
(never build into `dist/`). Do not start long-running dev servers on port 5173; if you need one use a unique port.

Shared globals from core: `app.device.tier` ('low'|'mid'|'high'), `app.device.reducedMotion`, `app.scroll.to(el)`,
`app.on('ready', fn)` (splash finished), `app.stage` (may be null: no WebGL / low tier, so every section must look
complete WITHOUT its GL act; provide a CSS/SVG fallback visual). `html.no-gl`, `html.tier-low`, `html.reduced-motion`
classes are set for CSS fallbacks.

Section backgrounds: transparent where the GL act should show through; cream "paper" sections use an opaque
`background: var(--cream)` with ink text (and then usually no GL act).

## Performance budget (PageSpeed Insights target 90+ mobile)
- No layout thrash in scroll handlers. Animate transform/opacity only. `will-change` sparingly.
- GL: keep draw calls low (merge, instancing, Points). Particle counts scale with `this.detail` (0.35/0.6/1).
  Dispose everything via `this.track()`. No textures larger than 1024. No per-frame allocations.
- 2D canvases: cap DPR at 2, pause when not visible (update() already only runs when visible).
- Respect `prefers-reduced-motion`: show final states, no scrub/pin jank, no auto motion.
- Pinning: use ScrollTrigger `pin` sparingly (max 1 to 2 per section), with `anticipatePin: 1`, and disable
  horizontal pin-scroll under 768px width (stack vertically instead) via `ScrollTrigger.matchMedia` / `gsap.matchMedia`.
- Images: `loading="lazy" decoding="async"` with width/height set, except the hero.

## Section map (ids in order) and source content
| id | content source |
|----|----------------|
| splash | `src/sections/splash/Splash.js` (NOT a BaseSection) default export class with `constructor(app)` and `async play(glPromise)`; resolves when the splash is gone. Markup in `splash.html` (root `.splash`, hidden when `html.no-js`). |
| chrome | header/nav, full-screen menu, scroll progress, section indicator, custom cursor (fine pointers only), ambient GL (`AmbientAct.js`, `static global = true`) |
| hero | Poster: ICCPI presents, FORGE PH, The Cross-Industry Startup Forum, People / Smart Capital / Capabilities / Real Outcomes, Manila Thu Oct 29 2026 9:00 AM, Dusit Thani Manila Makati, "Your startup. A day before Overground." |
| problem | Deck p3: gap between opportunity and investability, 4 problem cards, problem in one line |
| audience | Programme p3: who FORGE is for, 6 roles; participants not locked into one role |
| process | Deck p6 How FORGE works: Recruit, Profile, Qualify, Configure, De-risk, Convert. Deck p5 architecture FORGE PH / FORGE DAY / FORGE NEXT + product hypothesis |
| programme | Programme p5 morning agenda (09:00..11:25) + p8 afternoon Adaptive Startup Workshop: Form, Test, Reconfigure, Next step |
| ask | Deck p11 the ask (what FORGE needs now, partner types) + Programme p14 Public Promise + final CTA (date/venue). CTA links: `mailto:gnclub.contactus@gmail.com` |
| footer | footer: ICCPI logo, event facts, nav, legal line "FORGE does not guarantee investment..." |

Every section needs: (1) a distinctive scroll-driven entrance animation (not the same fade-up everywhere),
(2) ONE signature interactive element the visitor can play with (hover, drag, click, pointer-reactive),
(3) a background that reacts to scroll (GL act or CSS/canvas), (4) full responsiveness and a no-GL fallback.
