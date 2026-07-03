# Prospect Radar Progress Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Prospect Radar a visible 4-step progress indicator (gathering → synthesizing → critiquing → sharpening) in the panel, replacing the single pulsing text line, and surface the fine-grained gather sub-step text the server already sends but the client currently discards.

**Architecture:** Pure frontend change, no backend edits. A new pure-logic module (`src/lib/prospectSteps.ts`) defines the step order and a `stepStatus` function; `useProspectScan.ts` tracks the raw current phase alongside the existing human-readable progress text; `ProspectRadarPanel.tsx` renders a row of status chips plus the existing text line underneath.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS 4, `lucide-react` icons, Vitest.

## Global Constraints

- TypeScript strict mode; avoid `any`.
- No comments unless the *why* is non-obvious.
- Danish UI strings; branding only "Neura Studio"/"Prospect Radar".
- No ESLint/Prettier — `tsc --noEmit` (`npm run lint`) is the only lint gate.
- Tests co-located with source (e.g. `foo.test.ts` next to `foo.ts`); only `src/lib/` pure helpers get unit tests in this codebase — hooks and components do not (verify those via `npm run lint` and manual reasoning only).
- `npm run lint`, `npm test`, and `npm run build` must all pass before every commit.
- Version lives in 3 synced source places (`package.json`, `src/App.tsx` footer, `src/components/AppHeader.tsx`) plus `package-lock.json`; this is a visible-behaviour change to an *existing* feature → **patch** bump `1.27.0` → `1.27.1` per CLAUDE.md's versioning rule.
- Branch: `claude/prospect-radar` (same branch/PR as the rest of Prospect Radar — do not create a new branch).
- Backend (`server/ai/prospectScan.ts`, `server.ts`) is NOT touched by this plan — every field this UI needs is already emitted by the existing SSE stream.

---

### Task 1: `prospectSteps.ts` — step order + status logic (pure, tested)

**Files:**
- Create: `src/lib/prospectSteps.ts`
- Test: `src/lib/prospectSteps.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `export type ProspectPhase = 'gathering' | 'synthesizing' | 'critiquing' | 'sharpening';`
  - `export interface ProspectStepDef { key: ProspectPhase; label: string; }`
  - `export const PROSPECT_STEPS: ProspectStepDef[]`
  - `export type StepStatus = 'pending' | 'active' | 'done';`
  - `export function stepStatus(stepKey: ProspectPhase, currentPhase: ProspectPhase | null): StepStatus`

- [ ] **Step 1: Write the failing test**

Create `src/lib/prospectSteps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stepStatus, PROSPECT_STEPS } from './prospectSteps';

describe('PROSPECT_STEPS', () => {
  it('lists the four phases in order', () => {
    expect(PROSPECT_STEPS.map((s) => s.key)).toEqual(['gathering', 'synthesizing', 'critiquing', 'sharpening']);
  });
});

describe('stepStatus', () => {
  it('returns pending for every step when no phase is active', () => {
    expect(stepStatus('gathering', null)).toBe('pending');
    expect(stepStatus('sharpening', null)).toBe('pending');
  });

  it('marks earlier steps done, the current step active, and later steps pending', () => {
    expect(stepStatus('gathering', 'critiquing')).toBe('done');
    expect(stepStatus('synthesizing', 'critiquing')).toBe('done');
    expect(stepStatus('critiquing', 'critiquing')).toBe('active');
    expect(stepStatus('sharpening', 'critiquing')).toBe('pending');
  });

  it('treats the very first phase as active-only, never done, when it is current', () => {
    expect(stepStatus('gathering', 'gathering')).toBe('active');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run prospectSteps`
Expected: FAIL — "Cannot find module './prospectSteps'".

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/prospectSteps.ts`:

```ts
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProspectPhase = 'gathering' | 'synthesizing' | 'critiquing' | 'sharpening';

export interface ProspectStepDef {
  key: ProspectPhase;
  label: string;
}

export const PROSPECT_STEPS: ProspectStepDef[] = [
  { key: 'gathering', label: 'Indsamler' },
  { key: 'synthesizing', label: 'Syntetiserer' },
  { key: 'critiquing', label: 'Pres-tester' },
  { key: 'sharpening', label: 'Skærper' },
];

export type StepStatus = 'pending' | 'active' | 'done';

export function stepStatus(stepKey: ProspectPhase, currentPhase: ProspectPhase | null): StepStatus {
  if (!currentPhase) return 'pending';
  const stepIndex = PROSPECT_STEPS.findIndex((s) => s.key === stepKey);
  const currentIndex = PROSPECT_STEPS.findIndex((s) => s.key === currentPhase);
  if (currentIndex < 0) return 'pending';
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run prospectSteps`
Expected: PASS (4/4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prospectSteps.ts src/lib/prospectSteps.test.ts
git commit -m "feat(prospect): add step-order + status logic for the progress indicator"
```

---

### Task 2: Hook — track raw phase + surface fine-grained gather sub-step text

**Files:**
- Modify: `src/hooks/useProspectScan.ts`

**Interfaces:**
- Consumes: `ProspectPhase` (Task 1, from `../lib/prospectSteps`).
- Produces: hook's returned object gains `phase: ProspectPhase | null` alongside the existing `progress: string | null`.

No test for this file (established convention — hooks aren't unit-tested here). Verify via `npm run lint`.

- [ ] **Step 1: Add the import**

In `src/hooks/useProspectScan.ts`, change:
```ts
import { detectMarketFromInput } from '../lib/market';
```
to:
```ts
import { detectMarketFromInput } from '../lib/market';
import { ProspectPhase } from '../lib/prospectSteps';
```

- [ ] **Step 2: Add `phase` state**

Change:
```ts
  const [isResearching, setIsResearching] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [synthesisModel, setSynthesisModel] = useState<string | undefined>(undefined);
```
to:
```ts
  const [isResearching, setIsResearching] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [phase, setPhase] = useState<ProspectPhase | null>(null);
  const [synthesisModel, setSynthesisModel] = useState<string | undefined>(undefined);
```

- [ ] **Step 3: Set phase optimistically when research starts**

Change:
```ts
    setIsResearching(true);
    setErrorMsg(null);
    setProgress(PROGRESS_LABELS.gathering);
```
to:
```ts
    setIsResearching(true);
    setErrorMsg(null);
    setPhase('gathering');
    setProgress(PROGRESS_LABELS.gathering);
```

- [ ] **Step 4: In the SSE parse loop, track the raw phase and prefer the server's fine-grained gather sub-step text**

Change:
```ts
          if (parsed.phase) setProgress(PROGRESS_LABELS[parsed.phase] ?? parsed.phase);
```
to:
```ts
          if (parsed.phase) {
            setPhase(parsed.phase);
            setProgress(
              parsed.phase === 'gathering' && parsed.step
                ? parsed.step
                : (PROGRESS_LABELS[parsed.phase] ?? parsed.phase),
            );
          }
```

- [ ] **Step 5: Reset phase alongside progress when the run ends**

Change:
```ts
    } finally {
      setIsResearching(false);
      setProgress(null);
    }
```
to:
```ts
    } finally {
      setIsResearching(false);
      setProgress(null);
      setPhase(null);
    }
```

- [ ] **Step 6: Return `phase` from the hook**

Change:
```ts
  return {
    company, setCompany,
    market, setMarket,
    sellerProfile, setSellerProfile, resetSellerProfile,
    synthesisModel, setSynthesisModel, maxTokens, setMaxTokens,
    brief, isResearching, progress,
    handleResearch, handleClearBrief,
  };
```
to:
```ts
  return {
    company, setCompany,
    market, setMarket,
    sellerProfile, setSellerProfile, resetSellerProfile,
    synthesisModel, setSynthesisModel, maxTokens, setMaxTokens,
    brief, isResearching, progress, phase,
    handleResearch, handleClearBrief,
  };
```

- [ ] **Step 7: Verify**

Run: `npm run lint`
Expected: PASS (clean `tsc --noEmit`).

Run: `npx vitest run` (full suite — confirms nothing else broke)
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useProspectScan.ts
git commit -m "feat(prospect): track raw phase + surface fine-grained gather sub-step text"
```

---

### Task 3: Wiring + panel UI + version bump

**Files:**
- Modify: `src/hooks/useContentMachine.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/ProspectRadarPanel.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `phase` from `useProspectScan` (Task 2); `PROSPECT_STEPS`, `stepStatus`, `ProspectPhase` from `../lib/prospectSteps` (Task 1).
- Produces: the feature wired end-to-end and visible in the running app.

No test for the hook-composition or component files (established convention). Verify via `npm run lint` + `npm test` + `npm run build`.

- [ ] **Step 1: Expose `phase` from `useContentMachine.ts`**

Find this exact block (in the `Prospect Radar` section of the big return object):
```ts
    prospectBrief: prospect.brief,
    isResearchingProspect: prospect.isResearching,
    prospectProgress: prospect.progress,
    handleProspectResearch: prospect.handleResearch,
```
Replace with:
```ts
    prospectBrief: prospect.brief,
    isResearchingProspect: prospect.isResearching,
    prospectProgress: prospect.progress,
    prospectPhase: prospect.phase,
    handleProspectResearch: prospect.handleResearch,
```

- [ ] **Step 2: Destructure + pass `phase` through `src/App.tsx`**

Find this exact block in the `useContentMachine()` destructure:
```ts
    prospectBrief, isResearchingProspect, prospectProgress,
    handleProspectResearch, handleClearProspectBrief,
```
Replace with:
```ts
    prospectBrief, isResearchingProspect, prospectProgress, prospectPhase,
    handleProspectResearch, handleClearProspectBrief,
```

Find the `<ProspectRadarPanel ... />` JSX. It currently reads:
```tsx
              brief={prospectBrief}
              isResearching={isResearchingProspect}
              progress={prospectProgress}
              onResearch={handleProspectResearch}
```
Replace with:
```tsx
              brief={prospectBrief}
              isResearching={isResearchingProspect}
              progress={prospectProgress}
              phase={prospectPhase}
              onResearch={handleProspectResearch}
```

- [ ] **Step 3: Update imports + props in `ProspectRadarPanel.tsx`**

Change:
```tsx
import { useState } from 'react';
import { Radar, Search, Copy, Download, X } from 'lucide-react';
import { ProspectBrief, SellerProfile, ProspectMarket } from '../types';
import { MARKETS } from '../lib/market';
import { prospectBriefToMarkdown, downloadProspectMarkdown } from '../lib/prospectExport';
```
to:
```tsx
import { useState } from 'react';
import { Radar, Search, Copy, Download, X, Loader2, Check } from 'lucide-react';
import { ProspectBrief, SellerProfile, ProspectMarket } from '../types';
import { MARKETS } from '../lib/market';
import { prospectBriefToMarkdown, downloadProspectMarkdown } from '../lib/prospectExport';
import { PROSPECT_STEPS, stepStatus, ProspectPhase } from '../lib/prospectSteps';
```

Change:
```tsx
interface ProspectRadarPanelProps {
  company: string;
  setCompany: (v: string) => void;
  market: ProspectMarket;
  setMarket: (m: ProspectMarket) => void;
  sellerProfile: SellerProfile;
  setSellerProfile: (p: SellerProfile) => void;
  resetSellerProfile: () => void;
  synthesisModel: string | undefined;
  setSynthesisModel: (m: string | undefined) => void;
  maxTokens: number | undefined;
  setMaxTokens: (n: number | undefined) => void;
  brief: ProspectBrief | null;
  isResearching: boolean;
  progress: string | null;
  onResearch: () => void;
  onClearBrief: () => void;
}
```
to:
```tsx
interface ProspectRadarPanelProps {
  company: string;
  setCompany: (v: string) => void;
  market: ProspectMarket;
  setMarket: (m: ProspectMarket) => void;
  sellerProfile: SellerProfile;
  setSellerProfile: (p: SellerProfile) => void;
  resetSellerProfile: () => void;
  synthesisModel: string | undefined;
  setSynthesisModel: (m: string | undefined) => void;
  maxTokens: number | undefined;
  setMaxTokens: (n: number | undefined) => void;
  brief: ProspectBrief | null;
  isResearching: boolean;
  progress: string | null;
  phase: ProspectPhase | null;
  onResearch: () => void;
  onClearBrief: () => void;
}
```

Change:
```tsx
export function ProspectRadarPanel({
  company, setCompany, market, setMarket,
  sellerProfile, setSellerProfile, resetSellerProfile,
  synthesisModel, setSynthesisModel, maxTokens, setMaxTokens,
  brief, isResearching, progress, onResearch, onClearBrief,
}: ProspectRadarPanelProps) {
```
to:
```tsx
export function ProspectRadarPanel({
  company, setCompany, market, setMarket,
  sellerProfile, setSellerProfile, resetSellerProfile,
  synthesisModel, setSynthesisModel, maxTokens, setMaxTokens,
  brief, isResearching, progress, phase, onResearch, onClearBrief,
}: ProspectRadarPanelProps) {
```

- [ ] **Step 4: Replace the single progress line with the step-chip row**

Change:
```tsx
      {progress && <p className="text-xs text-orange-300 font-mono animate-pulse">{progress}</p>}
```
to:
```tsx
      {isResearching && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            {PROSPECT_STEPS.map((step) => {
              const status = stepStatus(step.key, phase);
              return (
                <span
                  key={step.key}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
                    status === 'active'
                      ? 'border-orange-500 bg-orange-500/15 text-orange-200'
                      : status === 'done'
                      ? 'border-orange-500/40 bg-orange-500/5 text-orange-300'
                      : 'border-slate-700 text-slate-500'
                  }`}
                >
                  {status === 'active' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : status === 'done' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full border border-slate-600" />
                  )}
                  {step.label}
                </span>
              );
            })}
          </div>
          {progress && <p className="text-xs text-orange-300 font-mono animate-pulse">{progress}</p>}
        </div>
      )}
```

- [ ] **Step 5: Version bump 1.27.0 → 1.27.1 (three source places + lockfile)**

- `package.json`: change `"version": "1.27.0"` to `"version": "1.27.1"`.
- `src/App.tsx` footer tagline: change `v1.27.0` to `v1.27.1`.
- `src/components/AppHeader.tsx` subtitle span: change `v1.27.0` to `v1.27.1`.
- Sync the lockfile:
  ```bash
  sed -i 's/"1.27.0"/"1.27.1"/g' package-lock.json
  ```
  Then confirm: `grep -c '"1.27.1"' package-lock.json` should print `2`.

- [ ] **Step 6: Verify**

Run: `npm run lint`
Expected: PASS.

Run: `npx vitest run` (full suite)
Expected: PASS — no regressions.

Run: `npm run build`
Expected: PASS (Vite + esbuild).

Confirm version consistency:
```bash
grep -rn "1.27.1" package.json src/App.tsx src/components/AppHeader.tsx
```
Expected: exactly one hit per file, no stray `1.27.0` remaining.

- [ ] **Step 7: Manual verification (requires `ANTHROPIC_API_KEY` in `.env.local`)**

Run `npm run dev`, open http://localhost:3000, find the Prospect Radar panel, type a company (e.g. `exemplar.dk`), click **Research**. Confirm: the moment you click, the "Indsamler" chip turns orange with a spinning icon; as the SSE stream progresses you see the chip row advance (previous chips turn into a filled orange checkmark, the next chip becomes active), and the fine-grained text line beneath it changes as gather sub-steps arrive (e.g. "Firma-overblik & produkter" → "Nyheder, emballage & beslutningstagere" → "Konkurrenter & retail") rather than a single static label. When the briefing is delivered, the whole chip row disappears and the result renders below it.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useContentMachine.ts src/App.tsx src/components/ProspectRadarPanel.tsx package.json package-lock.json
git commit -m "feat(prospect): render step-chip progress indicator + bump to v1.27.1"
```

---

## After all tasks

- Confirm `npm run lint`, `npm test`, and `npm run build` are all green.
- Push `claude/prospect-radar` — this updates the existing open PR (#1 on `Brandsurface/Sales-Agent-Opus-4.8`) automatically; no new PR needed.

## Self-review notes (coverage vs. spec)

- §2.1 step definition + status logic (pure, tested): Task 1. ✅
- §2.2 hook tracks raw phase + prefers server's fine-grained gather sub-step text: Task 2. ✅
- §2.3 wiring through `useContentMachine`/`App.tsx`: Task 3 Steps 1-2. ✅
- §2.4 panel renders the 4-chip row (pending/active/done styling, orange theme matching the file's existing market-selector chips) + keeps the detail text line beneath: Task 3 Steps 3-4. ✅
- §3 error handling unchanged (no new task needed — confirmed the existing catch/finally already covers this; nothing added that needs new error handling). ✅
- §4 testing: Task 1's test file; hook/panel verified via lint per established convention. ✅
- §5 version bump patch (1.27.0 → 1.27.1), 3 places + lockfile: Task 3 Step 5. ✅
- §6 out of scope (no backend, no `WorkingOverlay` changes, no history) — confirmed no task touches `server/ai/prospectScan.ts`, `server.ts`, or `WorkingOverlay.tsx`. ✅
- Type consistency: `ProspectPhase` defined once in Task 1, imported identically (same name, same source path `../lib/prospectSteps`) in Task 2 and Task 3; `phase` field name is identical end-to-end (hook state → hook return → `useContentMachine` key `prospectPhase` → `App.tsx` destructure `prospectPhase` → panel prop `phase`), matching the exact naming pattern already used for `market`/`progress` in this codebase.
