# HM Planning Poker — Design System

## Register & theme
Product register: the design serves the tool. **Light-first** — the physical scene is a
team member glancing at estimates during a daytime planning call in a normally-lit room;
light reads as calm and neutral there. Dark and Auto are offered for late sessions and
personal preference.

## Colour (OKLCH; tokens in `apps/client/src/globals.css`)
- **Primary / brand**: Human Made red — `oklch(0.55 0.19 25)` (light), `oklch(0.62 0.19 25)`
  (dark). Carries CTAs, selected cards, the logo mark. Restrained strategy: red as the one
  accent, everything else tinted neutral.
- **Neutrals**: tinted slightly warm, never pure `#000`/`#fff`.
- **Per-voter colours**: a fixed palette (`COLOURS` in `@hmpp/shared`), assigned
  deterministically per session so a person keeps their colour. Used on their card and
  their name. Must stay legible in both themes.
- **Vote status**: unanimous = green, problem = red/amber, otherwise neutral.

## Typography
- Geist Variable (`@fontsource-variable/geist`).
- Strong scale contrast (≥1.25). Numbers on cards are large and confident.
- Results metrics share one consistent scale and baseline; no single value oversized.

## Cards (the signature element)
- Vote cards are **playing-card shaped** (aspect 5:7), generously sized, centred.
- A participant's revealed vote shows on a matching card; pre-reveal shows a face-down /
  "voted" state. Card faces carry the value boldly; consider corner pips for character.

## Layout
- Centred, focused single column — there is no dashboard chrome. The deck and the table of
  voters are the stage.
- Vary spacing for rhythm; avoid uniform padding and gratuitous containers.

## Motion
- Ease-out (quart/expo), no bounce. Confetti on unanimous reveal; honour
  `prefers-reduced-motion`.

## Components
React + Vite, Tailwind v4, shadcn/ui on Base UI primitives, sonner toasts, lucide icons.
Theme control is an icon dropdown (Sun/Moon/Monitor). HM logo assets in
`apps/client/public/` (`hm-mark-*.svg`, `hm-wordmark-*.svg`, `favicon.png`).
