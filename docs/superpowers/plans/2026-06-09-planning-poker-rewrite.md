# HM Planning Poker Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean-room rebuild of HM Planning Poker at feature parity — React (Vite SPA) + Express 5 + Socket.io 4, TypeScript end-to-end, durable SQLite room state on a persistent volume — replacing the EOL AngularJS app, deployable by git-push to Render or Railway.

**Architecture:** npm-workspaces monorepo with three packages: `@hmpp/shared` (pure logic + content + the typed event contract, consumed by both ends), `@hmpp/server` (Express serves the built SPA same-origin + Socket.io; pure `Room` domain orchestrated over a SQLite-backed `RoomStore` on a persistent volume), and `@hmpp/client` (React SPA, Tailwind + shadcn/ui, Light/Dark/Auto theming). One Docker image; per-provider config files. Nothing is ported from the old repo — parity is reproduced by tests; only curated content (deck values, joke name list, forbidden words) is re-keyed as data.

**Tech Stack:** TypeScript, npm workspaces, Vitest, Express 5, Socket.io 4, better-sqlite3, Zod, React 18, Vite, react-router, zustand, Tailwind (v4 preferred), shadcn/ui, sonner, Playwright (one smoke test), Docker.

**Conventions locked across all tasks:**
- Workspace scope: `@hmpp/*`. Node 20, ESM (`"type": "module"`) everywhere.
- Store: SQLite at `DATA_DIR` (default `/data`, local default `./data`), one `rooms` table keyed by `slug`; live-mode TTL `LIVE_TTL_SECONDS = 14400` (4h) via an `updated_at` column swept lazily on load. The `RoomStore` keeps async method signatures (wrapping sync better-sqlite3) so handler code is store-agnostic.
- Single server→client broadcast event: `room:update` carrying a `PublicRoom`.
- Identity: client UUID in `localStorage['hmpp:sessionId']`; the server treats `socket.data.sessionId` (set at join) as the authoritative actor for all mutations — client-sent session ids are never trusted for identity (only `voter:toggle` carries a *target* id).
- Theme choice in `localStorage['hmpp:theme']` ∈ `light|dark|auto` (default `auto`).
- Commit after every green step. No emoji in commits.

---

## File structure

```
package.json                     # root, workspaces, scripts
tsconfig.base.json               # shared compiler options
.github/workflows/ci.yml
Dockerfile
render.yaml
railway.toml
README.md

packages/shared/
  package.json                   # name @hmpp/shared, exports ./dist
  tsconfig.json
  src/index.ts                   # re-exports
  src/types.ts                   # RoomState, Connection, PublicRoom, Vote, ...
  src/decks.ts                   # DECKS + chooseCardPack  (content)
  src/names.ts                   # COLOURS, JOKE_NAMES, FORBIDDEN, generators (content+logic)
  src/vote-math.ts               # computeVoteResults
  src/events.ts                  # ClientToServerEvents / ServerToClientEvents maps
  src/schemas.ts                 # Zod payload schemas
  src/*.test.ts

apps/server/
  package.json                   # name @hmpp/server
  tsconfig.json
  src/index.ts                   # boot: ensure data dir writable (fail loud) → http → io
  src/config.ts                  # PORT, DATA_DIR, DB_PATH
  src/logger.ts                  # structured logger
  src/http.ts                    # express app: static SPA, /healthz, SPA fallback
  src/domain/room.ts             # PURE Room logic (no I/O)
  src/domain/room.test.ts
  src/store/roomStore.ts         # SQLite-backed load/save/exists/delete + TTL sweep
  src/store/roomStore.test.ts
  src/sockets.ts                 # handlers: validate → load → domain → save → broadcast
  src/sockets.test.ts

apps/client/
  package.json                   # name @hmpp/client
  index.html                     # + inline pre-hydration theme script
  vite.config.ts
  tailwind config + globals.css   # token sets (light/dark)
  src/main.tsx, src/App.tsx
  src/lib/session.ts, src/lib/socket.ts
  src/store/useRoom.ts
  src/theme/ThemeProvider.tsx, src/theme/resolveTheme.ts, src/theme/ThemeToggle.tsx
  src/pages/Lobby.tsx, src/pages/Room.tsx
  src/components/{Deck,Card,Participants,Results,History,RoomControls,NameEditor,Fireworks}.tsx
  src/components/ui/*            # shadcn-generated, owned in repo
  src/**/*.test.tsx
  e2e/smoke.spec.ts              # Playwright
```

---

## Phase 0 — Repo & tooling

### Task 1: Monorepo skeleton

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`

- [ ] **Step 1: Wipe old source, keep git + docs**

Run (on the `rewrite` branch):
```bash
git rm -rf app server Procfile Dockerfile docker-compose.yml app.json .dockerignore .editorconfig README.md package.json package-lock.json
# keep: .git, docs/, .claude/, LICENCE
```

- [ ] **Step 2: Root `package.json`**

```json
{
  "name": "hmplanningpoker",
  "private": true,
  "type": "module",
  "engines": { "node": "20.x" },
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "build": "npm run build -w @hmpp/shared && npm run build -w @hmpp/server && npm run build -w @hmpp/client",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "dev:server": "npm run dev -w @hmpp/server",
    "dev:client": "npm run dev -w @hmpp/client",
    "start": "node apps/server/dist/index.js"
  }
}
```

- [ ] **Step 3: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: `.nvmrc` = `20`, `.gitignore`**

```
node_modules
dist
*.log
.DS_Store
coverage
.playwright
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: reset to empty monorepo skeleton for rewrite"
```

---

## Phase 1 — Shared core (`@hmpp/shared`)

### Task 2: Shared package + test tooling

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`

- [ ] **Step 1: `packages/shared/package.json`**

```json
{
  "name": "@hmpp/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "unique-names-generator": "^4.7.1", "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.5.0", "vitest": "^2.0.0" }
}
```

- [ ] **Step 2: `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

- [ ] **Step 4: Install from repo root**

Run: `npm install`
Expected: workspaces linked, no errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(shared): scaffold @hmpp/shared package"
```

### Task 3: Types

**Files:**
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Write types** (no test — pure declarations)

```ts
export type Vote = string | number | null;
export type RoomMode = 'live'; // 'async' reserved for the fast-follow

export interface Connection {
  sessionId: string;
  name: string;
  color: string;
  voter: boolean;
  vote: Vote;
  socketIds: string[]; // server-internal only; never sent to clients
}

export interface HistoryEntry {
  label: string;
  cardPack: string;
  votes: Array<{ vote: Vote }>;
  timestamp: number;
}

export interface RoomState {
  slug: string;
  mode: RoomMode;
  createdAt: number;
  adminSessionId: string | null;
  cardPack: string;
  forcedReveal: boolean;
  roundLabel: string;
  history: HistoryEntry[];
  connections: Record<string, Connection>; // keyed by sessionId
}

export interface PublicConnection {
  sessionId: string;
  name: string;
  color: string;
  voter: boolean;
  hasVoted: boolean;
  vote: Vote; // null unless the room is revealed
}

export interface PublicRoom {
  slug: string;
  mode: RoomMode;
  adminSessionId: string | null;
  cardPack: string;
  forcedReveal: boolean;
  revealed: boolean;
  roundLabel: string;
  history: HistoryEntry[];
  connections: PublicConnection[];
}

export type Ack = { ok: true } | { error: string };
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(shared): room + public-view types"
```

### Task 4: Decks (content + parsing)

**Files:**
- Create: `packages/shared/src/decks.ts`, `packages/shared/src/decks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { DECKS, chooseCardPack } from './decks';

describe('chooseCardPack', () => {
  it('returns a known deck by name', () => {
    expect(chooseCardPack('135 set')).toEqual(['1', '3', '5', '8', '13', '21', '?']);
  });
  it('returns the T-Shirt deck', () => {
    expect(chooseCardPack('T-Shirt')).toEqual(['XL', 'L', 'M', 'S', 'XS', '?']);
  });
  it('splits a custom comma string into a deck', () => {
    expect(chooseCardPack('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('exposes all named decks', () => {
    expect(Object.keys(DECKS)).toContain('Fibonacci');
    expect(Object.keys(DECKS)).toContain('Fruit');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/shared`
Expected: FAIL — cannot find module './decks'.

- [ ] **Step 3: Implement** (deck values re-keyed as product content)

```ts
export const DECKS: Record<string, Array<string | number>> = {
  '135 set': ['1', '3', '5', '8', '13', '21', '?'],
  'Fibonacci': ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'],
  'Fibonacci Goat': ['1', '2', '3', '5', '8', '13', '?', '☕'],
  'Mountain Goat': ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  'Sequential': ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?'],
  'Playing Cards': ['A♠', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J♔', 'Q♔', 'K♔'],
  'T-Shirt': ['XL', 'L', 'M', 'S', 'XS', '?'],
  'Fruit': ['🍎', '🍊', '🍌', '🍉', '🍑', '🍇'],
  '1-5': [1, 2, 3, 4, 5],
  '1-10': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

export function chooseCardPack(val: string): Array<string | number> {
  if (val in DECKS) return DECKS[val];
  return val.split(',');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @hmpp/shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): decks and card-pack selection"
```

### Task 5: Vote math

**Files:**
- Create: `packages/shared/src/vote-math.ts`, `packages/shared/src/vote-math.test.ts`

- [ ] **Step 1: Write the failing tests** (these encode parity behavior)

```ts
import { describe, it, expect } from 'vitest';
import { computeVoteResults } from './vote-math';

const v = (vals: Array<string | number>) => vals.map((vote) => ({ vote }));

describe('computeVoteResults', () => {
  it('flags unanimous when all voters cast the same value', () => {
    const r = computeVoteResults(v(['5', '5', '5']), 3, false);
    expect(r.voteStatus).toBe('unanimous');
    expect(r.average).toBe(5);
    expect(r.total).toBe(15);
    expect(r.stddev).toBe(0);
    expect(r.showAverage).toBe(true);
    expect(r.placeholderCount).toBe(0);
  });

  it('is unfinished and hides average while votes are outstanding', () => {
    const r = computeVoteResults(v(['5', '8']), 3, false);
    expect(r.voteStatus).toBe('unfinished');
    expect(r.showAverage).toBe(false);
    expect(r.placeholderCount).toBe(1);
    expect(r.forceRevealDisable).toBe(false);
  });

  it('flags problem when every voter disagrees', () => {
    const r = computeVoteResults(v(['1', '5', '13']), 3, false);
    expect(r.voteStatus).toBe('problem');
  });

  it('flags problem when all-but-one disagree in a group >3', () => {
    const r = computeVoteResults(v(['1', '2', '3', '5', '5']), 5, false);
    expect(r.voteStatus).toBe('problem');
  });

  it('ignores non-numeric votes in the average but counts them for reveal', () => {
    const r = computeVoteResults(v(['5', '?', '5']), 3, false);
    expect(r.average).toBe(5);
    expect(r.validVotes).toEqual([5, 5]);
    expect(r.voteStatus).toBe('not_unanimous');
  });

  it('reveals on forced reveal even when incomplete', () => {
    const r = computeVoteResults(v(['5']), 3, true);
    expect(r.forceRevealDisable).toBe(true);
    expect(['unanimous', 'not_unanimous', 'problem']).toContain(r.voteStatus);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/shared`
Expected: FAIL — cannot find module './vote-math'.

- [ ] **Step 3: Implement**

```ts
import type { Vote } from './types';

export type VoteStatus = 'unfinished' | 'unanimous' | 'not_unanimous' | 'problem';

export interface VoteResult {
  validVotes: number[];
  average: number;
  total: number;
  stddev: number;
  placeholderCount: number;
  showAverage: boolean;
  forceRevealDisable: boolean;
  voteStatus: VoteStatus;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const avg = mean(values);
  const squareDiffs = values.map((value) => (value - avg) ** 2);
  return Math.sqrt(mean(squareDiffs));
}

export function computeVoteResults(
  votes: Array<{ vote: Vote }>,
  voterCount: number,
  forcedReveal: boolean,
): VoteResult {
  const voteCount = votes.length;

  const validVotes = votes
    .map((x) => x.vote)
    .filter((vote): vote is string | number => !Number.isNaN(parseFloat(String(vote))))
    .map((vote) => parseFloat(String(vote)));

  const placeholderCount = Math.max(0, voterCount - voteCount);
  const showAverage = placeholderCount === 0;

  let average = 0;
  let total = 0;
  let stddev = 0;
  if (validVotes.length > 0) {
    total = validVotes.reduce((a, b) => a + b, 0);
    average = Math.round(total / validVotes.length);
    stddev = standardDeviation(validVotes);
  }

  const forceRevealDisable = forcedReveal || (voteCount === voterCount && voterCount > 0);

  const allVotesCast =
    voterCount > 0 && voteCount === voterCount && votes.every((x) => x.vote !== undefined && x.vote !== null);

  let voteStatus: VoteStatus = 'unfinished';
  if (allVotesCast || forcedReveal) {
    const uniqVotes = new Set(votes.map((x) => x.vote)).size;
    if (uniqVotes === 1) voteStatus = 'unanimous';
    else if (uniqVotes === voterCount) voteStatus = 'problem';
    else if (voterCount > 3 && uniqVotes === voterCount - 1) voteStatus = 'problem';
    else voteStatus = 'not_unanimous';
  }

  return { validVotes, average, total, stddev, placeholderCount, showAverage, forceRevealDisable, voteStatus };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @hmpp/shared`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): vote math with parity-encoded thresholds"
```

### Task 6: Names (content + generators)

**Files:**
- Create: `packages/shared/src/names.ts`, `packages/shared/src/names.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { FORBIDDEN, COLOURS, generateColor, generateName, uniquifyName } from './names';

describe('names', () => {
  it('never emits a forbidden word from generateName', () => {
    for (let i = 0; i < 200; i++) {
      const parts = generateName().toLowerCase().split(' ');
      for (const p of parts) expect(FORBIDDEN).not.toContain(p);
    }
  });
  it('generateColor returns a value from the palette', () => {
    expect(COLOURS).toContain(generateColor());
  });
  it('uniquifyName returns the name unchanged when free', () => {
    expect(uniquifyName('spock', new Set())).toBe('spock');
  });
  it('uniquifyName disambiguates a taken name (longer, still contains it)', () => {
    const out = uniquifyName('spock', new Set(['spock']));
    expect(out).not.toBe('spock');
    expect(out.toLowerCase().endsWith('spock')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/shared`
Expected: FAIL — cannot find module './names'.

- [ ] **Step 3: Implement** (palette / joke list / forbidden list re-keyed as content)

```ts
import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';

export const COLOURS: string[] = [
  '#144272', '#232D3F', '#2D3250', '#30475E', '#46C2CB', '#A2678A', '#BE3144',
  'black', 'blueviolet', 'brown', 'cadetblue', 'chocolate', 'coral', 'crimson',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgreen', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkseagreen', 'darkslateblue',
  'darkslategrey', 'darkviolet', 'deeppink', 'dodgerblue', 'firebrick', 'forestgreen',
  'goldenrod', 'green', 'hotpink', 'indianred', 'indigo', 'lightsalmon', 'lightseagreen',
  'magenta', 'maroon', 'mediumblue', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumvioletred', 'midnightblue', 'navy', 'olive', 'olivedrab', 'orangered',
  'palevioletred', 'peru', 'purple', 'rebeccapurple', 'red', 'royalblue', 'saddlebrown',
  'salmon', 'steelblue', 'teal',
];

// Curated personality content — re-keyed, not imported.
export const JOKE_NAMES: string[] = [
  'ai', 'android', 'automobile', 'avenger', 'beyonce', 'bindelstick', 'blue eyes white dragon',
  'boba fett', 'bulbasaur', 'captain janeway', 'captain picard', 'card picker', 'charizard',
  'charmander', 'chocobo', 'cleon', 'commander sisko', 'deana troi', 'digimon', 'director',
  'dobby', 'droid', 'emmissary', 'engineer', 'exodia', 'frieren', 'geordi laforge', 'han solo',
  'hari seldon', 'hypersphere', 'iron man', 'jedi', 'knitter', 'lwaxana troi',
  'Lwaxana Troi, daughter of the Fifth House, holder of the Sacred Chalice of Rixx, heir to the Holy Rings of Betazed',
  'mandalorian', 'millenium puzzle', 'mojito', 'moonbase', 'nephilim', 'oddish', 'one punch man',
  'orbital', 'peppa pig', 'pikachu', 'pingu', 'plant pot', 'poet', 'Q', 'raichu', 'rhombus',
  'riker', 'scrum disciple', 'scrum master', 'servitor', 'shredder', 'shrike', 'sith', 'skywalker',
  'slime', 'snowstorm', 'spock', 'star destroyer', 'tarkin', 'television', 'tellytubby', 'tesseract',
  'trackpad', 'transporter', 'transporter clone', 'triangle', 'unicron', 'voltron', 'voter',
  'womble', 'xanadu', 'xenu', 'yugi', 'zod',
];

export const FORBIDDEN: string[] = [
  'attractive', 'available', 'christian', 'chubby', 'creepy', 'desirable', 'dirty', 'ethnic',
  'explicit', 'fat', 'filthy', 'gay', 'gorgeous', 'hard', 'hot', 'married', 'moaning', 'naughty',
  'oral', 'protestant', 'racial', 'rude', 'sexual', 'straight', 'yeasty', 'beaver', 'booby',
  'cow', 'dog', 'kite', 'rat', 'snake', 'thrush',
];

const safeAdjectives = adjectives.filter((w) => !FORBIDDEN.includes(w));
const safeNouns = animals.concat(JOKE_NAMES).filter((w) => !FORBIDDEN.includes(w));

export function generateColor(): string {
  return uniqueNamesGenerator({ dictionaries: [COLOURS], length: 1 });
}

export function generateName(): string {
  return uniqueNamesGenerator({ dictionaries: [safeAdjectives, safeNouns], separator: ' ', length: 2 });
}

export function generateSlug(): string {
  return uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: '-', length: 2 });
}

/** Pure: returns `name` if not in `taken` (case-insensitive), else prepends a safe adjective. */
export function uniquifyName(name: string, taken: Set<string>): string {
  const lower = (s: string) => s.toLowerCase();
  const isTaken = (candidate: string) => [...taken].some((t) => lower(t) === lower(candidate));
  if (!isTaken(name)) return name;
  for (let i = 0; i < 10; i++) {
    const adj = uniqueNamesGenerator({ dictionaries: [safeAdjectives], length: 1 });
    const candidate = `${adj} ${name}`;
    if (!isTaken(candidate)) return candidate;
  }
  return name;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @hmpp/shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(shared): name/colour/slug generators with curated content"
```

### Task 7: Event contract + Zod schemas

**Files:**
- Create: `packages/shared/src/schemas.ts`, `packages/shared/src/events.ts`, `packages/shared/src/index.ts` (re-exports)

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { joinSchema, voteSchema } from './schemas';

describe('schemas', () => {
  it('accepts a valid join payload', () => {
    expect(joinSchema.safeParse({ slug: 'happy-otter', sessionId: 'abc', voter: true }).success).toBe(true);
  });
  it('rejects a join with a missing sessionId', () => {
    expect(joinSchema.safeParse({ slug: 'happy-otter' }).success).toBe(false);
  });
  it('rejects an over-long slug', () => {
    expect(voteSchema.safeParse({ slug: 'x'.repeat(101), vote: '5' }).success).toBe(false);
  });
  it('accepts string or number votes', () => {
    expect(voteSchema.safeParse({ slug: 'a', vote: 5 }).success).toBe(true);
    expect(voteSchema.safeParse({ slug: 'a', vote: '5' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/shared`
Expected: FAIL — cannot find module './schemas'.

- [ ] **Step 3: Implement `schemas.ts`**

```ts
import { z } from 'zod';

const slug = z.string().min(1).max(100);

export const joinSchema = z.object({
  slug,
  sessionId: z.string().min(1).max(100),
  name: z.string().max(50).transform((s) => s.trim()).optional(),
  voter: z.boolean().optional(),
});
export const slugOnlySchema = z.object({ slug });
export const voteSchema = z.object({ slug, vote: z.union([z.string().max(100), z.number()]) });
export const cardPackSchema = z.object({ slug, cardPack: z.string().min(1).max(200) });
export const nameSchema = z.object({ slug, name: z.string().min(1).max(50).transform((s) => s.trim()) });
export const labelSchema = z.object({ slug, label: z.string().max(200).optional().default('') });
export const toggleSchema = z.object({ slug, targetSessionId: z.string().min(1).max(100), voter: z.boolean() });

export type JoinPayload = z.infer<typeof joinSchema>;
export type VotePayload = z.infer<typeof voteSchema>;
export type CardPackPayload = z.infer<typeof cardPackSchema>;
export type NamePayload = z.infer<typeof nameSchema>;
export type LabelPayload = z.infer<typeof labelSchema>;
export type TogglePayload = z.infer<typeof toggleSchema>;
```

- [ ] **Step 4: Implement `events.ts`**

```ts
import type { PublicRoom, Ack } from './types';
import type { JoinPayload, VotePayload, CardPackPayload, NamePayload, LabelPayload, TogglePayload } from './schemas';

export interface ClientToServerEvents {
  'room:create': (cb: (res: { slug: string }) => void) => void;
  'room:join': (data: JoinPayload, cb: (res: PublicRoom | { error: string }) => void) => void;
  'room:info': (data: { slug: string }, cb: (res: PublicRoom | { error: string }) => void) => void;
  'vote': (data: VotePayload, cb: (res: Ack) => void) => void;
  'unvote': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'vote:reset': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'reveal:force': (data: { slug: string }, cb: (res: Ack) => void) => void;
  'name:set': (data: NamePayload, cb: (res: Ack) => void) => void;
  'round:label': (data: LabelPayload, cb: (res: Ack) => void) => void;
  'voter:toggle': (data: TogglePayload, cb: (res: Ack) => void) => void;
  'cardpack:set': (data: CardPackPayload, cb: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:update': (room: PublicRoom) => void;
}

export interface SocketData {
  sessionId: string;
  slug: string;
}
```

- [ ] **Step 5: `index.ts` re-exports**

```ts
export * from './types';
export * from './decks';
export * from './vote-math';
export * from './names';
export * from './schemas';
export * from './events';
```

- [ ] **Step 6: Run tests + build**

Run: `npm test -w @hmpp/shared && npm run build -w @hmpp/shared`
Expected: PASS; `dist/` produced.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(shared): typed event contract and Zod schemas"
```

---

## Phase 2 — Server (`@hmpp/server`)

### Task 8: Server scaffold

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/vitest.config.ts`, `apps/server/src/config.ts`, `apps/server/src/logger.ts`

- [ ] **Step 1: `apps/server/package.json`**

```json
{
  "name": "@hmpp/server",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@hmpp/shared": "*",
    "express": "^5.2.1",
    "socket.io": "^4.8.3",
    "better-sqlite3": "^11.3.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsx": "^4.16.0",
    "vitest": "^2.0.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/express": "^5.0.0"
  }
}
```

- [ ] **Step 2: `apps/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

- [ ] **Step 4: `src/config.ts`**

```ts
import path from 'node:path';
export const PORT = Number(process.env.PORT) || 5099;
export const DATA_DIR = process.env.DATA_DIR || './data';
export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'rooms.db');
export const LIVE_TTL_SECONDS = 14400; // 4h
```

- [ ] **Step 5: `src/logger.ts`**

```ts
type Level = 'info' | 'warn' | 'error' | 'debug';
function log(level: Level, msg: string, meta?: unknown) {
  const line = { t: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](JSON.stringify(line));
}
export const logger = {
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
  debug: (m: string, meta?: unknown) => { if (process.env.NODE_ENV !== 'production') log('debug', m, meta); },
};
```

> Note: `new Date()` is fine in app code; it is only disallowed inside Workflow scripts.

- [ ] **Step 6: Install + commit**

Run: `npm install`
```bash
git add -A && git commit -m "chore(server): scaffold @hmpp/server package"
```

### Task 9: Pure Room domain

**Files:**
- Create: `apps/server/src/domain/room.ts`, `apps/server/src/domain/room.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  createRoom, enter, leave, recordVote, clearVote, resetVotes,
  forceReveal, toggleVoter, isAdmin, votingFinished, clientCount, publicView,
} from './room';

const join = (state: ReturnType<typeof createRoom>, sessionId: string, socketId: string, voter = true) =>
  enter(state, { sessionId, socketId, voter });

describe('Room domain', () => {
  it('makes the first joiner the admin', () => {
    let s = createRoom('happy-otter');
    s = join(s, 'a', 'sock-a');
    expect(s.adminSessionId).toBe('a');
    expect(isAdmin(s, 'a')).toBe(true);
    expect(clientCount(s)).toBe(1);
  });

  it('hides votes until everyone has voted, then reveals', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = recordVote(s, 'a', '5');
    expect(votingFinished(s)).toBe(false);
    expect(publicView(s).revealed).toBe(false);
    expect(publicView(s).connections.find((c) => c.sessionId === 'a')!.vote).toBeNull();
    expect(publicView(s).connections.find((c) => c.sessionId === 'a')!.hasVoted).toBe(true);
    s = recordVote(s, 'b', '5');
    expect(votingFinished(s)).toBe(true);
    expect(publicView(s).revealed).toBe(true);
    expect(publicView(s).connections.find((c) => c.sessionId === 'a')!.vote).toBe('5');
  });

  it('force reveal exposes votes immediately', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = recordVote(s, 'a', '5');
    s = forceReveal(s);
    expect(publicView(s).revealed).toBe(true);
  });

  it('reset snapshots history and clears votes + reveal', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = recordVote(s, 'a', '8'); s = forceReveal(s);
    s = resetVotes(s);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].votes).toEqual([{ vote: '8' }]);
    expect(s.forcedReveal).toBe(false);
    expect(s.connections['a'].vote).toBeNull();
  });

  it('toggling a voter to observer clears their vote', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = recordVote(s, 'a', '5');
    s = toggleVoter(s, 'a', false);
    expect(s.connections['a'].voter).toBe(false);
    expect(s.connections['a'].vote).toBeNull();
  });

  it('reassigns admin when the admin leaves', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa'); s = join(s, 'b', 'sb');
    s = leave(s, 'sa');
    expect(s.adminSessionId).toBe('b');
    expect(clientCount(s)).toBe(1);
  });

  it('keeps a session alive across multiple sockets (tabs)', () => {
    let s = createRoom('r'); s = join(s, 'a', 'sa1'); s = enter(s, { sessionId: 'a', socketId: 'sa2' });
    s = leave(s, 'sa1');
    expect(clientCount(s)).toBe(1);
    s = leave(s, 'sa2');
    expect(clientCount(s)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/server`
Expected: FAIL — cannot find module './room'.

- [ ] **Step 3: Implement `room.ts`** (pure; clones state, never mutates input)

```ts
import {
  type RoomState, type Connection, type PublicRoom, type Vote,
  computeVoteResults, generateColor, generateName, uniquifyName,
} from '@hmpp/shared';

const clone = (s: RoomState): RoomState => structuredClone(s);

export function createRoom(slug: string): RoomState {
  return {
    slug, mode: 'live', createdAt: Date.now(), adminSessionId: null,
    cardPack: '135 set', forcedReveal: false, roundLabel: '', history: [], connections: {},
  };
}

const activeConnections = (s: RoomState): Connection[] =>
  Object.values(s.connections).filter((c) => c.socketIds.length > 0);

const takenNames = (s: RoomState, excludeSessionId?: string): Set<string> =>
  new Set(activeConnections(s).filter((c) => c.sessionId !== excludeSessionId).map((c) => c.name));

export function enter(
  s: RoomState,
  opts: { sessionId: string; socketId: string; name?: string; voter?: boolean },
): RoomState {
  const next = clone(s);
  const existing = next.connections[opts.sessionId];
  if (existing) {
    if (!existing.socketIds.includes(opts.socketId)) existing.socketIds.push(opts.socketId);
    if (opts.name) existing.name = uniquifyName(opts.name, takenNames(next, opts.sessionId));
  } else {
    const proposed = opts.name || generateName();
    next.connections[opts.sessionId] = {
      sessionId: opts.sessionId,
      name: uniquifyName(proposed, takenNames(next, opts.sessionId)),
      color: generateColor(),
      voter: opts.voter !== undefined ? opts.voter : true,
      vote: null,
      socketIds: [opts.socketId],
    };
  }
  if (!next.adminSessionId) next.adminSessionId = opts.sessionId;
  return next;
}

export function leave(s: RoomState, socketId: string): RoomState {
  const next = clone(s);
  const conn = Object.values(next.connections).find((c) => c.socketIds.includes(socketId));
  if (!conn) return next;
  conn.socketIds = conn.socketIds.filter((id) => id !== socketId);
  if (conn.socketIds.length === 0) {
    delete next.connections[conn.sessionId];
    if (next.adminSessionId === conn.sessionId) {
      const nextAdmin = activeConnections(next)[0];
      next.adminSessionId = nextAdmin ? nextAdmin.sessionId : null;
    }
  }
  return next;
}

export function recordVote(s: RoomState, sessionId: string, vote: Vote): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) conn.vote = vote;
  return next;
}

export function clearVote(s: RoomState, sessionId: string): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) conn.vote = null;
  return next;
}

export function resetVotes(s: RoomState): RoomState {
  const next = clone(s);
  const cast = activeConnections(next).filter((c) => c.voter && c.vote !== null).map((c) => ({ vote: c.vote }));
  if (cast.length > 0) {
    next.history.push({
      label: next.roundLabel || `Round ${next.history.length + 1}`,
      cardPack: next.cardPack,
      votes: cast,
      timestamp: Date.now(),
    });
  }
  next.roundLabel = '';
  for (const c of Object.values(next.connections)) c.vote = null;
  next.forcedReveal = false;
  return next;
}

export function forceReveal(s: RoomState): RoomState {
  const next = clone(s);
  next.forcedReveal = true;
  return next;
}

export function toggleVoter(s: RoomState, sessionId: string, voter: boolean): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) {
    conn.voter = voter;
    if (!voter) conn.vote = null;
  }
  return next;
}

export function setName(s: RoomState, sessionId: string, name: string): RoomState {
  const next = clone(s);
  const conn = next.connections[sessionId];
  if (conn) conn.name = uniquifyName(name, takenNames(next, sessionId));
  return next;
}

export function setCardPack(s: RoomState, cardPack: string): RoomState {
  const next = clone(s); next.cardPack = cardPack; return next;
}

export function setRoundLabel(s: RoomState, label: string): RoomState {
  const next = clone(s); next.roundLabel = label; return next;
}

export function votingFinished(s: RoomState): boolean {
  if (s.forcedReveal) return true;
  const voters = activeConnections(s).filter((c) => c.voter);
  if (voters.length === 0) return false;
  return voters.every((v) => v.vote !== null && v.vote !== undefined);
}

export function clientCount(s: RoomState): number {
  return activeConnections(s).length;
}

export function isAdmin(s: RoomState, sessionId: string | undefined): boolean {
  return !!sessionId && s.adminSessionId === sessionId;
}

export function publicView(s: RoomState): PublicRoom {
  const revealed = votingFinished(s);
  return {
    slug: s.slug, mode: s.mode, adminSessionId: s.adminSessionId, cardPack: s.cardPack,
    forcedReveal: s.forcedReveal, revealed, roundLabel: s.roundLabel, history: s.history,
    connections: activeConnections(s).map((c) => ({
      sessionId: c.sessionId, name: c.name, color: c.color, voter: c.voter,
      hasVoted: c.vote !== null && c.vote !== undefined,
      vote: revealed ? c.vote : null,
    })),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @hmpp/server`
Expected: PASS (all domain tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(server): pure Room domain logic"
```

### Task 10: SQLite RoomStore

**Files:**
- Create: `apps/server/src/store/roomStore.ts`, `apps/server/src/store/roomStore.test.ts`

Durable room state in SQLite (better-sqlite3) on a persistent volume. Methods keep async
signatures (wrapping sync better-sqlite3) so the socket handler code is store-agnostic.
TTL is an `updated_at` column reaped by a lazy sweep on `load`. Tests use an in-memory DB
(`':memory:'`) — no external service.

- [ ] **Step 1: Write the failing test** (against an in-memory SQLite DB)

```ts
import { describe, it, expect } from 'vitest';
import { RoomStore } from './roomStore';
import { createRoom, recordVote, enter } from '../domain/room';

const newStore = () => new RoomStore(':memory:', 100);

describe('RoomStore', () => {
  it('returns null for an unknown room', async () => {
    expect(await newStore().load('nope')).toBeNull();
  });
  it('round-trips room state', async () => {
    const store = newStore();
    let s = createRoom('happy-otter');
    s = enter(s, { sessionId: 'a', socketId: 'sa' });
    s = recordVote(s, 'a', '5');
    await store.save(s);
    const loaded = await store.load('happy-otter');
    expect(loaded?.connections['a'].vote).toBe('5');
  });
  it('reports existence and deletes', async () => {
    const store = newStore();
    await store.save(createRoom('r'));
    expect(await store.exists('r')).toBe(true);
    await store.delete('r');
    expect(await store.exists('r')).toBe(false);
  });
  it('sweeps rooms older than the TTL on load', async () => {
    const store = new RoomStore(':memory:', 0); // ttl 0 => everything is immediately stale
    await store.save(createRoom('old'));
    // a tiny delay so updated_at < now - 0
    await new Promise((r) => setTimeout(r, 5));
    expect(await store.load('old')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/server`
Expected: FAIL — cannot find module './roomStore'.

- [ ] **Step 3: Implement `roomStore.ts`**

```ts
import Database from 'better-sqlite3';
import type { RoomState } from '@hmpp/shared';
import { LIVE_TTL_SECONDS } from '../config';

export class RoomStore {
  private db: Database.Database;

  constructor(dbPath: string, private ttlSeconds: number = LIVE_TTL_SECONDS) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS rooms (slug TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER NOT NULL)',
    );
  }

  private sweep(): void {
    const cutoff = Date.now() - this.ttlSeconds * 1000;
    this.db.prepare('DELETE FROM rooms WHERE updated_at < ?').run(cutoff);
  }

  async load(slug: string): Promise<RoomState | null> {
    this.sweep();
    const row = this.db.prepare('SELECT state FROM rooms WHERE slug = ?').get(slug) as
      | { state: string }
      | undefined;
    return row ? (JSON.parse(row.state) as RoomState) : null;
  }

  async save(state: RoomState): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO rooms (slug, state, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(slug) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at',
      )
      .run(state.slug, JSON.stringify(state), Date.now());
  }

  async exists(slug: string): Promise<boolean> {
    return !!this.db.prepare('SELECT 1 FROM rooms WHERE slug = ?').get(slug);
  }

  async delete(slug: string): Promise<void> {
    this.db.prepare('DELETE FROM rooms WHERE slug = ?').run(slug);
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @hmpp/server`
Expected: PASS (all 4).

> If better-sqlite3 fails to load a native binary in this environment, report it as
> BLOCKED with the error — do not switch libraries on your own.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(server): SQLite-backed RoomStore with TTL sweep"
```

### Task 11: Socket handlers

**Files:**
- Create: `apps/server/src/sockets.ts`, `apps/server/src/sockets.test.ts`

- [ ] **Step 1: Write the failing integration test**

Uses a real Socket.io server + client over an ephemeral port, backed by an in-memory SQLite store.

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as ioc, type Socket } from 'socket.io-client';
import { RoomStore } from './store/roomStore';
import { registerHandlers } from './sockets';
import type { PublicRoom } from '@hmpp/shared';

let httpServer: ReturnType<typeof createServer>;
let url: string;

beforeEach(async () => {
  httpServer = createServer();
  const io = new Server(httpServer);
  const store = new RoomStore(':memory:', 100);
  registerHandlers(io, store);
  await new Promise<void>((r) => httpServer.listen(0, r));
  const { port } = httpServer.address() as { port: number };
  url = `http://localhost:${port}`;
});
afterEach(() => { httpServer.close(); });

const connect = () => ioc(url, { transports: ['websocket'], forceNew: true });
const join = (s: Socket, slug: string, sessionId: string, voter = true) =>
  new Promise<PublicRoom>((res) => s.emit('room:join', { slug, sessionId, voter }, res as never));

describe('socket handlers', () => {
  it('first joiner becomes admin and gets a public room', async () => {
    const a = connect();
    const room = await join(a, 'happy-otter', 'sess-a');
    expect(room.adminSessionId).toBe('sess-a');
    a.close();
  });

  it('hides votes until all voters have voted', async () => {
    const a = connect(); const b = connect();
    await join(a, 'r', 'sa'); await join(b, 'r', 'sb');
    const afterB: PublicRoom = await new Promise((res) => {
      b.on('room:update', res);
      a.emit('vote', { slug: 'r', vote: '5' }, () => {});
    });
    expect(afterB.revealed).toBe(false);
    expect(afterB.connections.find((c) => c.sessionId === 'sa')!.vote).toBeNull();
    a.close(); b.close();
  });

  it('rejects force-reveal from a non-admin', async () => {
    const a = connect(); const b = connect();
    await join(a, 'r', 'sa'); await join(b, 'r', 'sb');
    const res: { ok: true } | { error: string } = await new Promise((resolve) =>
      b.emit('reveal:force', { slug: 'r' }, resolve as never));
    expect('error' in res).toBe(true);
    a.close(); b.close();
  });
});
```

Add `socket.io-client` to server devDependencies:
```bash
npm install -D socket.io-client -w @hmpp/server
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/server`
Expected: FAIL — cannot find module './sockets'.

- [ ] **Step 3: Implement `sockets.ts`**

```ts
import type { Server, Socket } from 'socket.io';
import {
  type ClientToServerEvents, type ServerToClientEvents, type SocketData, type Ack,
  joinSchema, slugOnlySchema, voteSchema, cardPackSchema, nameSchema, labelSchema, toggleSchema,
  generateSlug,
} from '@hmpp/shared';
import { RoomStore } from './store/roomStore';
import * as room from './domain/room';
import { logger } from './logger';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerHandlers(io: IO, store: RoomStore): void {
  const broadcast = async (slug: string) => {
    const state = await store.load(slug);
    if (state) io.to(slug).emit('room:update', room.publicView(state));
  };

  io.on('connection', (socket: IOSocket) => {
    socket.on('room:create', async (cb) => {
      let slug = generateSlug();
      for (let i = 0; i < 10 && (await store.exists(slug)); i++) slug = generateSlug();
      await store.save(room.createRoom(slug));
      cb({ slug });
    });

    socket.on('room:join', async (data, cb) => {
      const parsed = joinSchema.safeParse(data);
      if (!parsed.success) return cb({ error: 'Invalid join payload' });
      const { slug, sessionId, name, voter } = parsed.data;
      let state = (await store.load(slug)) ?? room.createRoom(slug);
      state = room.enter(state, { sessionId, socketId: socket.id, name, voter });
      await store.save(state);
      socket.data.sessionId = sessionId;
      socket.data.slug = slug;
      await socket.join(slug);
      socket.to(slug).emit('room:update', room.publicView(state));
      cb(room.publicView(state));
    });

    socket.on('room:info', async (data, cb) => {
      const parsed = slugOnlySchema.safeParse(data);
      if (!parsed.success) return cb({ error: 'Invalid payload' });
      const state = await store.load(parsed.data.slug);
      if (!state) return cb({ error: 'Sorry, this room no longer exists ...' });
      cb(room.publicView(state));
    });

    const mutate = async (
      slug: string,
      cb: (res: Ack) => void,
      apply: (state: import('@hmpp/shared').RoomState) => import('@hmpp/shared').RoomState | { error: string },
    ) => {
      const state = await store.load(slug);
      if (!state) return cb({ error: 'Sorry, this room no longer exists ...' });
      const result = apply(state);
      if ('error' in result) return cb(result);
      await store.save(result);
      await broadcast(slug);
      cb({ ok: true });
    };

    socket.on('vote', (data, cb) => {
      const p = voteSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid vote' });
      mutate(p.data.slug, cb, (s) => room.recordVote(s, socket.data.sessionId, p.data.vote));
    });

    socket.on('unvote', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) => room.clearVote(s, socket.data.sessionId));
    });

    socket.on('vote:reset', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) =>
        room.isAdmin(s, socket.data.sessionId) || room.votingFinished(s)
          ? room.resetVotes(s)
          : { error: 'Only the room admin can reset votes' });
    });

    socket.on('reveal:force', (data, cb) => {
      const p = slugOnlySchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) =>
        room.isAdmin(s, socket.data.sessionId) ? room.forceReveal(s) : { error: 'Only the room admin can force reveal' });
    });

    socket.on('name:set', (data, cb) => {
      const p = nameSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid name' });
      mutate(p.data.slug, cb, (s) => room.setName(s, socket.data.sessionId, p.data.name));
    });

    socket.on('round:label', (data, cb) => {
      const p = labelSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid label' });
      mutate(p.data.slug, cb, (s) => room.setRoundLabel(s, p.data.label));
    });

    socket.on('cardpack:set', (data, cb) => {
      const p = cardPackSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid card pack' });
      mutate(p.data.slug, cb, (s) => room.setCardPack(s, p.data.cardPack));
    });

    socket.on('voter:toggle', (data, cb) => {
      const p = toggleSchema.safeParse(data);
      if (!p.success) return cb({ error: 'Invalid payload' });
      mutate(p.data.slug, cb, (s) => {
        const isSelf = socket.data.sessionId === p.data.targetSessionId;
        if (!isSelf && !room.isAdmin(s, socket.data.sessionId)) {
          return { error: 'Only the room admin can toggle voter status' };
        }
        return room.toggleVoter(s, p.data.targetSessionId, p.data.voter);
      });
    });

    socket.on('disconnecting', async () => {
      const slug = socket.data.slug;
      if (!slug) return;
      const state = await store.load(slug);
      if (!state) return;
      const next = room.leave(state, socket.id);
      if (room.clientCount(next) === 0) await store.delete(slug);
      else { await store.save(next); io.to(slug).emit('room:update', room.publicView(next)); }
      logger.debug('socket disconnecting', { id: socket.id, slug });
    });
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -w @hmpp/server`
Expected: PASS (all 3 socket tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(server): typed, validated socket handlers over RoomStore"
```

### Task 12: HTTP app + boot (fail loud on store)

**Files:**
- Create: `apps/server/src/http.ts`, `apps/server/src/index.ts`

- [ ] **Step 1: Write the failing test for `/healthz`**

```ts
// apps/server/src/http.test.ts
import { describe, it, expect } from 'vitest';
import { createApp } from './http';

describe('http app', () => {
  it('serves /healthz', async () => {
    const app = createApp();
    // Express 5 apps are request listeners; use a light fetch via node http
    const { createServer } = await import('node:http');
    const server = createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as { port: number };
    const res = await fetch(`http://localhost:${port}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    server.close();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/server`
Expected: FAIL — cannot find module './http'.

- [ ] **Step 3: Implement `http.ts`**

```ts
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In the built image the client is copied next to the server dist as ./public
const CLIENT_DIR = process.env.CLIENT_DIR || path.join(__dirname, 'public');

export function createApp(): Express {
  const app = express();
  app.get('/healthz', (_req, res) => { res.type('text').send('ok'); });
  app.use(express.static(CLIENT_DIR, { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));
  // SPA fallback: any non-asset, non-socket route returns index.html
  app.get(/^(?!\/socket\.io).*/, (_req, res) => { res.sendFile(path.join(CLIENT_DIR, 'index.html')); });
  return app;
}
```

- [ ] **Step 4: Implement `index.ts`** (fail loud if the data dir is not writable)

```ts
import { createServer } from 'node:http';
import fs from 'node:fs';
import { Server } from 'socket.io';
import { createApp } from './http';
import { registerHandlers } from './sockets';
import { RoomStore } from './store/roomStore';
import { PORT, DATA_DIR, DB_PATH } from './config';
import { logger } from './logger';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@hmpp/shared';

function main() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
  } catch (err) {
    logger.error('Data dir not writable at boot — refusing to start', { dir: DATA_DIR, err: String(err) });
    process.exit(1);
  }

  let store: RoomStore;
  try {
    store = new RoomStore(DB_PATH);
  } catch (err) {
    logger.error('Could not open the room database — refusing to start', { db: DB_PATH, err: String(err) });
    process.exit(1);
  }

  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer);
  registerHandlers(io, store);

  httpServer.listen(PORT, () => logger.info('server listening', { port: PORT }));
}

main();
```

- [ ] **Step 5: Run tests + build**

Run: `npm test -w @hmpp/server && npm run build -w @hmpp/server`
Expected: PASS; `dist/` produced.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(server): http app, SPA fallback, boot with fail-loud store"
```

---

## Phase 3 — Client (`@hmpp/client`)

### Task 13: Vite + React + Tailwind + shadcn init

**Files:**
- Create: `apps/client/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/globals.css`, shadcn config

- [ ] **Step 1: Scaffold Vite React-TS in `apps/client`**

Run:
```bash
npm create vite@latest apps/client -- --template react-ts
```
Then set the package name in `apps/client/package.json` to `@hmpp/client` and add scripts:
```json
{
  "name": "@hmpp/client",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Add deps**

Run:
```bash
npm install socket.io-client zustand react-router-dom sonner @hmpp/shared -w @hmpp/client
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom -w @hmpp/client
```

- [ ] **Step 3: Tailwind v4 via Vite plugin**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { proxy: { '/socket.io': { target: 'http://localhost:5099', ws: true } } },
});
```

`src/globals.css` (token sets — values are placeholders to be tuned to HM brand):
```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 22% 16%;
    --card: 0 0% 98%;
    --primary: 210 70% 26%;     /* HM brand primary — tune at build time */
    --muted: 210 16% 93%;
    --border: 214 20% 85%;
    --radius: 0.5rem;
  }
  html.dark {
    --background: 222 22% 11%;
    --foreground: 210 20% 92%;
    --card: 222 20% 16%;
    --primary: 188 55% 53%;
    --muted: 222 16% 22%;
    --border: 222 16% 26%;
  }
  body { background: hsl(var(--background)); color: hsl(var(--foreground)); }
}
```

- [ ] **Step 4: Initialize shadcn/ui and add the components used by this app**

Run:
```bash
cd apps/client
npx shadcn@latest init   # choose: TypeScript, the globals.css above, CSS variables = yes
npx shadcn@latest add button card dropdown-menu dialog input toggle-group sonner
cd ../..
```
Expected: components written to `apps/client/src/components/ui/`.

- [ ] **Step 5: Verify it builds**

Run: `npm run build -w @hmpp/client`
Expected: build succeeds (placeholder App).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore(client): Vite + React + Tailwind v4 + shadcn/ui scaffold"
```

### Task 14: Theme system (Light/Dark/Auto, FOUC-safe)

**Files:**
- Create: `src/theme/resolveTheme.ts`, `src/theme/ThemeProvider.tsx`, `src/theme/ThemeToggle.tsx`, `src/theme/resolveTheme.test.ts`
- Modify: `apps/client/index.html` (inline pre-hydration script)

- [ ] **Step 1: Write the failing test for theme resolution**

```ts
// src/theme/resolveTheme.test.ts
import { describe, it, expect } from 'vitest';
import { resolveTheme } from './resolveTheme';

describe('resolveTheme', () => {
  it('returns the explicit choice when not auto', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
  });
  it('follows the OS when auto', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/client`
Expected: FAIL — cannot find module './resolveTheme'.

- [ ] **Step 3: Implement `resolveTheme.ts`**

```ts
export type ThemeChoice = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(choice: ThemeChoice, osPrefersDark: boolean): ResolvedTheme {
  if (choice === 'auto') return osPrefersDark ? 'dark' : 'light';
  return choice;
}
```

- [ ] **Step 4: Implement `ThemeProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { resolveTheme, type ThemeChoice } from './resolveTheme';

const KEY = 'hmpp:theme';
type Ctx = { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(
    () => (localStorage.getItem(KEY) as ThemeChoice) || 'auto',
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = resolveTheme(choice, mql.matches);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [choice]);

  const setChoice = (c: ThemeChoice) => { localStorage.setItem(KEY, c); setChoiceState(c); };
  return <ThemeCtx.Provider value={{ choice, setChoice }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

- [ ] **Step 5: Implement `ThemeToggle.tsx`** (three-way, shadcn ToggleGroup)

```tsx
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <ToggleGroup type="single" value={choice} onValueChange={(v) => v && setChoice(v as never)}>
      <ToggleGroupItem value="light" aria-label="Light">Light</ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark">Dark</ToggleGroupItem>
      <ToggleGroupItem value="auto" aria-label="Auto">Auto</ToggleGroupItem>
    </ToggleGroup>
  );
}
```

- [ ] **Step 6: FOUC-safe inline script in `index.html`** (in `<head>`, before the module script)

```html
<script>
  (function () {
    try {
      var c = localStorage.getItem('hmpp:theme') || 'auto';
      var dark = c === 'dark' || (c === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    } catch (e) {}
  })();
</script>
```

- [ ] **Step 7: Run tests**

Run: `npm test -w @hmpp/client`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(client): Light/Dark/Auto theme system, FOUC-safe"
```

### Task 15: Session id + typed socket + room store

**Files:**
- Create: `src/lib/session.ts`, `src/lib/session.test.ts`, `src/lib/socket.ts`, `src/store/useRoom.ts`

- [ ] **Step 1: Write the failing test for session id**

```ts
// src/lib/session.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionId } from './session';

beforeEach(() => localStorage.clear());

describe('getSessionId', () => {
  it('creates and persists a stable id', () => {
    const a = getSessionId();
    expect(a).toMatch(/[0-9a-f-]{36}/);
    expect(getSessionId()).toBe(a);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/client`
Expected: FAIL — cannot find module './session'.

- [ ] **Step 3: Implement `session.ts`**

```ts
const KEY = 'hmpp:sessionId';
export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
  return id;
}
```

- [ ] **Step 4: Implement `socket.ts`** (typed client; same-origin)

```ts
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@hmpp/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export const socket: AppSocket = io({ autoConnect: true });
```

- [ ] **Step 5: Implement `useRoom.ts`** (zustand store)

```ts
import { create } from 'zustand';
import type { PublicRoom } from '@hmpp/shared';

interface RoomStore {
  room: PublicRoom | null;
  setRoom: (room: PublicRoom) => void;
  clear: () => void;
}
export const useRoom = create<RoomStore>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  clear: () => set({ room: null }),
}));
```

- [ ] **Step 6: Run tests**

Run: `npm test -w @hmpp/client`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(client): session id, typed socket, room store"
```

### Task 16: Routing, App shell, Lobby

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`
- Create: `src/pages/Lobby.tsx`

- [ ] **Step 1: `main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { Toaster } from 'sonner';
import App from './App';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
        <Toaster richColors position="top-center" />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: `App.tsx`** (routes + header with theme toggle)

```tsx
import { Routes, Route } from 'react-router-dom';
import { ThemeToggle } from './theme/ThemeToggle';
import { Lobby } from './pages/Lobby';
import { Room } from './pages/Room';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
        <a href="/" className="font-semibold">HM Planning Poker</a>
        <ThemeToggle />
      </header>
      <main className="p-4 max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:slug" element={<Room />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: `Lobby.tsx`** (create a room → navigate)

```tsx
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { socket } from '@/lib/socket';

export function Lobby() {
  const navigate = useNavigate();
  const create = () => socket.emit('room:create', ({ slug }) => navigate(`/room/${slug}`));
  return (
    <Card className="p-8 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Start a planning session</h1>
      <p className="text-sm opacity-70">Disposable rooms. No login. Votes hidden until everyone's in.</p>
      <Button size="lg" onClick={create}>Create a room</Button>
    </Card>
  );
}
```

- [ ] **Step 4: Verify build (Room is added next; stub it)**

Create a temporary `src/pages/Room.tsx` exporting `export function Room() { return null; }` so the build passes, to be replaced in Task 17.

Run: `npm run build -w @hmpp/client`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(client): routing, app shell, lobby"
```

### Task 17: Room page — join, deck, voting

**Files:**
- Create: `src/components/Card.tsx`, `src/components/Deck.tsx`, `src/components/Participants.tsx`
- Replace: `src/pages/Room.tsx`

- [ ] **Step 1: Write a failing component test for the deck**

```tsx
// src/components/Deck.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Deck } from './Deck';

describe('Deck', () => {
  it('renders the cards of a named pack and reports a pick', () => {
    const onPick = vi.fn();
    render(<Deck cardPack="135 set" myVote={null} onPick={onPick} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(onPick).toHaveBeenCalledWith('8');
  });
});
```

Add a `src/setupTests.ts` importing `@testing-library/jest-dom` and reference it in `vitest.config.ts` (`test.environment = 'jsdom'`, `setupFiles`).

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/client`
Expected: FAIL — cannot find module './Deck'.

- [ ] **Step 3: Implement `Card.tsx`**

```tsx
import { Button } from '@/components/ui/button';

export function Card({ value, selected, disabled, onClick }: {
  value: string | number; selected: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <Button
      variant={selected ? 'default' : 'outline'}
      disabled={disabled}
      onClick={onClick}
      className="h-20 w-14 text-lg"
      aria-pressed={selected}
    >
      {value}
    </Button>
  );
}
```

- [ ] **Step 4: Implement `Deck.tsx`**

```tsx
import { chooseCardPack } from '@hmpp/shared';
import { Card } from './Card';

export function Deck({ cardPack, myVote, onPick, disabled }: {
  cardPack: string; myVote: string | number | null; onPick: (v: string) => void; disabled: boolean;
}) {
  const cards = chooseCardPack(cardPack);
  return (
    <div className="flex flex-wrap gap-2">
      {cards.map((c) => (
        <Card key={String(c)} value={c} selected={String(myVote) === String(c)} disabled={disabled} onClick={() => onPick(String(c))} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement `Participants.tsx`**

```tsx
import type { PublicConnection } from '@hmpp/shared';

export function Participants({ connections, revealed }: { connections: PublicConnection[]; revealed: boolean }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {connections.map((c) => (
        <li key={c.sessionId} className="flex flex-col items-center gap-1">
          <span
            className="h-12 w-12 rounded-md flex items-center justify-center text-white text-sm font-semibold"
            style={{ background: c.color, opacity: c.hasVoted || !c.voter ? 1 : 0.4 }}
          >
            {revealed && c.voter ? (c.vote ?? '–') : c.voter ? (c.hasVoted ? '✓' : '…') : '👁'}
          </span>
          <span className="text-xs max-w-[6rem] truncate">{c.name}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Implement `Room.tsx`** (join on mount, wire socket updates + voting)

```tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { socket } from '@/lib/socket';
import { getSessionId } from '@/lib/session';
import { useRoom } from '@/store/useRoom';
import { Deck } from '@/components/Deck';
import { Participants } from '@/components/Participants';
import { Results } from '@/components/Results';
import { RoomControls } from '@/components/RoomControls';
import { History } from '@/components/History';
import { Fireworks } from '@/components/Fireworks';

export function Room() {
  const { slug = '' } = useParams();
  const { room, setRoom } = useRoom();
  const sessionId = getSessionId();

  useEffect(() => {
    const onUpdate = (r: Parameters<typeof setRoom>[0]) => setRoom(r);
    socket.on('room:update', onUpdate);
    const doJoin = () => socket.emit('room:join', { slug, sessionId }, (res) => {
      if ('error' in res) toast.error(res.error); else setRoom(res);
    });
    if (socket.connected) doJoin();
    socket.on('connect', doJoin); // re-join on reconnect
    return () => { socket.off('room:update', onUpdate); socket.off('connect', doJoin); };
  }, [slug, sessionId, setRoom]);

  if (!room) return <p>Joining room…</p>;
  const me = room.connections.find((c) => c.sessionId === sessionId);
  const pick = (vote: string) => socket.emit('vote', { slug, vote }, (res) => { if ('error' in res) toast.error(res.error); });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Room: {room.slug}</h1>
      <Participants connections={room.connections} revealed={room.revealed} />
      {me?.voter && <Deck cardPack={room.cardPack} myVote={me?.vote ?? null} onPick={pick} disabled={room.revealed} />}
      <Results room={room} />
      <RoomControls room={room} sessionId={sessionId} />
      <History room={room} />
      <Fireworks room={room} />
    </div>
  );
}
```

- [ ] **Step 7: Run tests + build (Results/RoomControls/History/Fireworks added next; stub them to compile)**

Create minimal stubs for `Results`, `RoomControls`, `History`, `Fireworks` each returning `null`, then:
Run: `npm test -w @hmpp/client && npm run build -w @hmpp/client`
Expected: PASS + build OK.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(client): room join, deck voting, participants"
```

### Task 18: Results, history, controls, fireworks, toasts

**Files:**
- Replace stubs: `src/components/Results.tsx`, `src/components/RoomControls.tsx`, `src/components/History.tsx`, `src/components/Fireworks.tsx`, `src/components/NameEditor.tsx`

- [ ] **Step 1: Write a failing test for Results**

```tsx
// src/components/Results.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Results } from './Results';
import type { PublicRoom } from '@hmpp/shared';

const room = (over: Partial<PublicRoom>): PublicRoom => ({
  slug: 'r', mode: 'live', adminSessionId: 'a', cardPack: '135 set', forcedReveal: false,
  revealed: true, roundLabel: '', history: [],
  connections: [
    { sessionId: 'a', name: 'A', color: 'red', voter: true, hasVoted: true, vote: '5' },
    { sessionId: 'b', name: 'B', color: 'blue', voter: true, hasVoted: true, vote: '5' },
  ],
  ...over,
});

describe('Results', () => {
  it('shows the average when revealed', () => {
    render(<Results room={room({})} />);
    expect(screen.getByText(/Average/i)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
  it('renders nothing useful before reveal', () => {
    const { container } = render(<Results room={room({ revealed: false })} />);
    expect(container.textContent).not.toMatch(/Average/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -w @hmpp/client`
Expected: FAIL — Results stub renders null.

- [ ] **Step 3: Implement `Results.tsx`** (uses shared vote math)

```tsx
import { computeVoteResults, type PublicRoom } from '@hmpp/shared';

export function Results({ room }: { room: PublicRoom }) {
  if (!room.revealed) return null;
  const voters = room.connections.filter((c) => c.voter);
  const votes = voters.filter((c) => c.vote !== null).map((c) => ({ vote: c.vote }));
  const r = computeVoteResults(votes, voters.length, room.forcedReveal);

  const tone =
    r.voteStatus === 'unanimous' ? 'text-green-500'
    : r.voteStatus === 'problem' ? 'text-red-500'
    : 'opacity-80';

  return (
    <div className="flex items-center gap-6 rounded-md border p-4" style={{ borderColor: 'hsl(var(--border))' }}>
      {r.showAverage && <div><span className="opacity-70">Average</span> <span className="text-2xl font-bold">{r.average}</span></div>}
      <div><span className="opacity-70">Total</span> <span className="font-semibold">{r.total}</span></div>
      <div><span className="opacity-70">Std dev</span> <span className="font-semibold">{r.stddev.toFixed(2)}</span></div>
      <div className={`font-semibold ${tone}`}>{r.voteStatus.replace('_', ' ')}</div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `RoomControls.tsx`** (admin + self actions)

```tsx
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DECKS, type PublicRoom } from '@hmpp/shared';
import { socket } from '@/lib/socket';
import { NameEditor } from './NameEditor';

export function RoomControls({ room, sessionId }: { room: PublicRoom; sessionId: string }) {
  const slug = room.slug;
  const isAdmin = room.adminSessionId === sessionId;
  const me = room.connections.find((c) => c.sessionId === sessionId);
  const ack = (res: { ok: true } | { error: string }) => { if ('error' in res) toast.error(res.error); };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <NameEditor slug={slug} currentName={me?.name ?? ''} />

      <Button variant="secondary" onClick={() => socket.emit('voter:toggle', { slug, targetSessionId: sessionId, voter: !(me?.voter ?? true) }, ack)}>
        {me?.voter ? 'Become observer' : 'Become voter'}
      </Button>

      <Input
        className="w-56" placeholder="Round label (e.g. PROJ-123)"
        defaultValue={room.roundLabel}
        onBlur={(e) => socket.emit('round:label', { slug, label: e.target.value }, ack)}
      />

      {isAdmin && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline">Deck: {room.cardPack}</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.keys(DECKS).map((name) => (
                <DropdownMenuItem key={name} onClick={() => socket.emit('cardpack:set', { slug, cardPack: name }, ack)}>{name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => socket.emit('reveal:force', { slug }, ack)} disabled={room.revealed}>Reveal</Button>
          <Button variant="destructive" onClick={() => socket.emit('vote:reset', { slug }, ack)}>Reset</Button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement `NameEditor.tsx`**

```tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { socket } from '@/lib/socket';

export function NameEditor({ slug, currentName }: { slug: string; currentName: string }) {
  const [value, setValue] = useState(currentName);
  return (
    <Input
      className="w-44" value={value} onChange={(e) => setValue(e.target.value)}
      onBlur={() => value && value !== currentName && socket.emit('name:set', { slug, name: value }, (res) => { if ('error' in res) toast.error(res.error); })}
      aria-label="Your name"
    />
  );
}
```

- [ ] **Step 6: Implement `History.tsx`** (list + JSON export)

```tsx
import { Button } from '@/components/ui/button';
import type { PublicRoom } from '@hmpp/shared';

export function History({ room }: { room: PublicRoom }) {
  if (room.history.length === 0) return null;
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(room.history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${room.slug}-history.json`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="rounded-md border p-4" style={{ borderColor: 'hsl(var(--border))' }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">History</h2>
        <Button variant="outline" size="sm" onClick={exportJson}>Export JSON</Button>
      </div>
      <ul className="space-y-1 text-sm">
        {room.history.map((h, i) => (
          <li key={i}><span className="font-medium">{h.label}</span> — {h.votes.map((v) => String(v.vote)).join(', ')} <span className="opacity-60">({h.cardPack})</span></li>
        ))}
      </ul>
    </div>
  );
}
```

> Export format note: JSON is chosen for fidelity (preserves labels, deck, timestamps). If CSV is later preferred, it is a localized change to `exportJson`.

- [ ] **Step 7: Implement `Fireworks.tsx`** (fresh CSS-driven celebration on unanimous reveal)

```tsx
import { useEffect, useState } from 'react';
import { computeVoteResults, type PublicRoom } from '@hmpp/shared';

export function Fireworks({ room }: { room: PublicRoom }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!room.revealed) return;
    const voters = room.connections.filter((c) => c.voter);
    const votes = voters.filter((c) => c.vote !== null).map((c) => ({ vote: c.vote }));
    const { voteStatus } = computeVoteResults(votes, voters.length, room.forcedReveal);
    if (voteStatus === 'unanimous') {
      setShow(true);
      const t = setTimeout(() => setShow(false), 2500);
      return () => clearTimeout(t);
    }
  }, [room.revealed, room.connections, room.forcedReveal]);

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
      <div className="text-6xl animate-bounce">🎉</div>
    </div>
  );
}
```

> A richer CSS particle effect can replace the emoji later; behavior (fires on unanimous reveal) is what parity requires.

- [ ] **Step 8: Run tests + build**

Run: `npm test -w @hmpp/client && npm run build -w @hmpp/client`
Expected: PASS + build OK.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(client): results, controls, history export, name editor, fireworks"
```

### Task 19: End-to-end smoke (two clients)

**Files:**
- Create: `apps/client/e2e/smoke.spec.ts`, `apps/client/playwright.config.ts`
- Modify: `apps/client/package.json` (add `test:e2e`)

- [ ] **Step 1: Install Playwright**

Run: `npm install -D @playwright/test -w @hmpp/client && npx playwright install --with-deps chromium`

- [ ] **Step 2: `playwright.config.ts`** (assumes the built app served by the server on :5099)

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5099' },
});
```

- [ ] **Step 3: Write the smoke test**

```ts
import { test, expect } from '@playwright/test';

test('two users join, vote, reveal', async ({ browser }) => {
  const a = await browser.newContext(); const b = await browser.newContext();
  const pa = await a.newPage(); const pb = await b.newPage();

  await pa.goto('/');
  await pa.getByRole('button', { name: /create a room/i }).click();
  await pa.waitForURL(/\/room\//);
  const url = pa.url();
  await pb.goto(url);

  await pa.getByRole('button', { name: '5' }).click();
  await pb.getByRole('button', { name: '5' }).click();

  await expect(pa.getByText(/unanimous/i)).toBeVisible();
  await expect(pa.getByText(/Average/i)).toBeVisible();
});
```

- [ ] **Step 4: Run it** (start the built server first; SQLite needs no external service)

Run:
```bash
npm run build
CLIENT_DIR=apps/client/dist DATA_DIR=.e2e-data node apps/server/dist/index.js &
npx playwright test -w @hmpp/client
```
Expected: PASS. (`.e2e-data` is a throwaway dir; it is gitignored via the `coverage`/`*.log`
pattern siblings — add it to `.gitignore` if not already ignored.)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(client): two-user e2e smoke (join, vote, reveal)"
```

---

## Phase 4 — Deploy

### Task 20: Dockerfile (same-origin: server serves built client)

**Files:**
- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: `.dockerignore`**

```
node_modules
**/node_modules
**/dist
.git
.playwright
coverage
```

- [ ] **Step 2: `Dockerfile`** (multi-stage; copies client build into server's `public`)

```dockerfile
# --- build ---
# Debian slim (glibc), not alpine: better-sqlite3 ships glibc prebuilt binaries,
# so no source compilation / build-tools are needed.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci
COPY . .
RUN npm run build

# --- runtime ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev --workspace @hmpp/server --workspace @hmpp/shared
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/client/dist apps/server/dist/public
RUN groupadd --system app && useradd --system --gid app app \
 && mkdir -p /data && chown app:app /data
USER app
VOLUME ["/data"]
# Default to port 80 (what tools.hmn.md expects). Render injects its own PORT,
# which the app reads from process.env.PORT and overrides this default.
ENV PORT=80
ENV DATA_DIR=/data
EXPOSE 80
CMD ["node", "apps/server/dist/index.js"]
```

> `http.ts` resolves `CLIENT_DIR` to `./public` next to the server `dist`, which matches the copy above. The SQLite DB lives at `DATA_DIR=/data` (the mounted volume). No other env override needed in the image.

- [ ] **Step 3: Build + run locally to verify**

Run:
```bash
docker build -t hmpp .
docker run --rm -p 8080:80 -v hmpp-data:/data hmpp
```
Expected: server boots (data volume writable), `http://localhost:8080/healthz` returns `ok`, app loads. Room state persists across container restarts via the `hmpp-data` volume.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "build: multi-stage Dockerfile serving SPA same-origin"
```

### Task 21: Render + Railway config

**Files:**
- Create: `render.yaml`, `railway.toml`

- [ ] **Step 1: `render.yaml`** (web service + persistent disk at /data)

```yaml
services:
  - type: web
    name: hmplanningpoker
    runtime: docker
    plan: starter
    healthCheckPath: /healthz
    autoDeploy: true
    disk:
      name: hmpp-data
      mountPath: /data
      sizeGB: 1
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATA_DIR
        value: /data
```

> Render injects `PORT` automatically (the app reads `process.env.PORT`). A persistent
> disk pins the service to a single instance — consistent with the single-instance design.

- [ ] **Step 2: `railway.toml`** (Dockerfile build, healthcheck)

```toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/healthz"
restartPolicyType = "always"
```

> Railway: attach a Volume mounted at `/data` to the service (dashboard → Volumes) and set
> `DATA_DIR=/data`. Railway injects `PORT`; the server reads it. No external database
> service is needed.

- [ ] **Step 3 (optional): `tools.hmn.md` deploy workflow for pre-launch testing**

This is a TEMPORARY internal test target, not production. Only do this when you want HM
colleagues to test behind SSO. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  packages: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/humanmade/hmplanningpoker:latest
          labels: org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
```

Then provision once via the `humanmade/it` repo's `request-app.yml` workflow (GitHub UI or
`gh workflow run request-app.yml --repo humanmade/it --field name=hmplanningpoker --field repo=hmplanningpoker`).
The platform mounts `/data` (EFS) automatically — the image already defaults `DATA_DIR=/data`
and `PORT=80`, so no extra config is needed. App appears at `hmplanningpoker.tools.hmn.md`
behind Google SSO. Socket.io falls back to long-polling if the SSO/ALB proxy blocks the WS
upgrade, so realtime works regardless — verify this is the FIRST thing tested.

> Note: only `main` triggers the tools.hmn.md deploy. While building on the `rewrite`
> branch this workflow stays dormant; it activates when the rewrite lands on `main`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "deploy: render.yaml, railway.toml, optional tools.hmn.md workflow"
```

### Task 22: CI + README + finalize

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

- [ ] **Step 1: `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push: { branches: [main, rewrite] }
  pull_request: {}
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: `README.md`** (dev + deploy quickstart)

```markdown
# HM Planning Poker

Disposable, real-time planning-poker rooms. React + Express + Socket.io, durable SQLite
room state on a persistent volume.

## Develop
    nvm use
    npm install
    npm run dev:server       # :5099 (creates ./data/rooms.db)
    npm run dev:client       # Vite dev server, proxies /socket.io to :5099

## Test
    npm test                 # unit + integration across workspaces (in-memory SQLite)

## Build & run
    npm run build
    DATA_DIR=./data npm start

## Deploy
Push to `main`; Render (or Railway) auto-deploys the Docker image. State lives in a SQLite
DB on a persistent disk/volume mounted at `/data` (`DATA_DIR=/data`) — no external database
service. See `render.yaml` / `railway.toml`. An optional `.github/workflows/deploy.yml`
publishes to `tools.hmn.md` for temporary internal pre-launch testing only.
```

- [ ] **Step 3: Run the full suite**

Run: `npm ci && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "ci: workflow, README, finalize rewrite"
```

---

## Self-review

**Spec coverage:**
- Stack (React/Vite + Express 5 + Socket.io 4, TS monorepo) → Tasks 1–2, 8, 13.
- Tailwind + shadcn, HM tokens, juniper discarded → Tasks 13–14.
- Light/Dark/Auto theming, FOUC-safe → Task 14.
- Durable SQLite store on a volume, single instance, TTL sweep → Tasks 10, 12, 20, 21.
- Identity (localStorage UUID, authoritative `socket.data.sessionId`, multi-tab/reconnect) → Tasks 9, 11, 15, 17.
- Pure `Room` domain, validate→load→transition→save→broadcast → Tasks 9, 11.
- Parity checklist: rooms/slugs/auto-create (11), roles+observer (9/11/18), admin + reassign + perms (9/11/18), decks (4/17/18), hidden-until-revealed + force reveal (9/11/17), vote/change/unvote (11/17), stats (5/18), round labels + history + export (9/18), fireworks (18), toasts (16/throughout), responsive (Tailwind), reconnect (17).
- Async-aware data shape (`Session`/`mode`) → `RoomMode` + `mode:'live'` in types (Task 3), with `'async'` reserved.
- Clean-room (nothing ported) + content re-entered → Tasks 4, 6 re-key decks/names/forbidden as data; all logic TDD'd fresh.
- Same-origin serving, Dockerfile, PORT/DATA_DIR from env, per-provider config (incl. optional tools.hmn.md) → Tasks 12, 20, 21.
- CI/git-push deploy → Tasks 21–22.

**Gaps fixed inline:** added Room stub step (Task 16) and downstream component stubs (Task 17) so the build stays green between tasks; pinned the JSON history-export format with a note on CSV swap.

**Placeholder scan:** none — every code step contains full content. Brand token *values* in `globals.css` are explicitly marked as tunable, not placeholders for logic.

**Type consistency:** event names (`room:create/join/info`, `vote`, `unvote`, `vote:reset`, `reveal:force`, `name:set`, `round:label`, `voter:toggle`, `cardpack:set`, `room:update`), domain fns (`createRoom/enter/leave/recordVote/clearVote/resetVotes/forceReveal/toggleVoter/setName/setCardPack/setRoundLabel/votingFinished/clientCount/isAdmin/publicView`), and `RoomStore` methods (`load/save/exists/delete`) are used identically across Tasks 7, 9, 10, 11, 15, 17, 18.
