# OpsPilot QA report (Phase 7)

Final accessibility, interaction and responsive QA of the complete prototype: Base, Low confidence and Stale analysis scenarios, the Operations Dashboard and the Audit trail.

**Conformance language:** OpsPilot is designed and audited against WCAG 2.2 AA criteria within the prototype's supported scope. It is not claimed to be WCAG 2.2 AA compliant. See [`ACCESSIBILITY-AUDIT.md`](ACCESSIBILITY-AUDIT.md).

## Final results

| Check | Command | Result |
| --- | --- | --- |
| Unit, component, integration tests | `npm test` | **243 of 243 pass**, 18 files, exit 0 |
| TypeScript (strict) | `npm run typecheck` | Pass, exit 0 |
| ESLint with jsx-a11y | `npm run lint` | Pass, 0 errors, 0 warnings |
| Production build | `npm run build` | Pass, exit 0 |
| Token contrast | `python3 scripts/contrast-audit.py` | **97 of 97 pairs pass** (baseline unchanged; no new pairs in Phase 7) |
| Browser QA, production build | `python3 scripts/qa-browser.py <url>` | 45 of 45 workflow steps; 594 Tab stops in 29 states with 0 focus issues; 33 layout checks clean; 0 console messages |
| Browser QA, dev server (React warnings) | `python3 scripts/qa-browser.py <url> --dev` | 45 of 45 workflow steps; 0 focus issues; 0 console messages (no React, key or prop warnings) |
| axe + keyboard, Incident Detail | `scripts/a11y-browser-audit.py` | 0 violations in 8 states; 20 of 20 keyboard steps |
| axe + keyboard, Dashboard | `scripts/a11y-dashboard-audit.py` | 0 violations in 5 states; 8 of 8 keyboard steps |
| axe + keyboard, scenarios and Audit | `scripts/a11y-scenarios-audit.py` | 0 violations in 13 states (including 2 Audit states); 21 of 21 keyboard steps |

No existing test was weakened, deleted or skipped. Phase 7 added 3 tests.

## Environment

- Chromium via Playwright (Python), headless, against `vite preview` (production build) and `vite` (dev server, React StrictMode).
- Viewports: 1024 × 768, 1280 × 800, 1440 × 900.
- 200% zoom, emulated with `device_scale_factor = 2` and half-size CSS viewports: 2048 × 1152 → 1024 × 576, 2560 × 1440 → 1280 × 720, 2880 × 1800 → 1440 × 900, plus 1280 × 800 → 640 × 400 (below supported width).
- Reduced motion via `prefers-reduced-motion: reduce` emulation.
- jsdom (Vitest) for unit, component and integration tests, with fake timers for scenario timing.

Not tested: Firefox, Safari, real browser zoom controls, touch, forced colours, real screen readers.

## Workflows tested


**Base, pointer, from the Dashboard** (8 of 8 pass)

- Pass: Dashboard → open INC-2041
- Pass: Observed facts and AI summary present
- Pass: Hover traces evidence → event
- Pass: Show source focuses the event
- Pass: Back to evidence returns focus
- Pass: Approve with typed confirmation records
- Pass: Audit shows the decision with frozen analysis
- Pass: Dashboard shows Decided and announces it

**Base, keyboard only, from page load** (15 of 15 pass)

- Pass: First Tab reaches "Skip to content"
- Pass: Sidebar Dashboard link reachable
- Pass: INC-2041 title link reachable
- Pass: Systems group toggle by keyboard
- Pass: Systems group expands with Enter
- Pass: Summary Inferred toggle by keyboard
- Pass: Show source by keyboard
- Pass: Show source moves focus to the source event
- Pass: Escape in the source row returns focus to the evidence item
- Pass: Recommendation radio by keyboard
- Pass: Approve in the dock by keyboard
- Pass: Typed confirmation recorded; focus on confirmation
- Pass: Audit expand by keyboard
- Pass: Back to Dashboard by keyboard (Shift+Tab to sidebar)
- Pass: Decided visible on Dashboard

**Low confidence** (7 of 7 pass)

- Pass: Missing NPS source stated in Observed facts
- Pass: Unknown stated with reason
- Pass: Both hypotheses Low
- Pass: Blocked Approve opens nothing
- Pass: Blocked reason visible in dock
- Pass: Verify, Dismiss, Escalate = exactly 3 decisions (blocked attempt wrote none)
- Pass: Audit records Other reason and team/note

**Stale analysis (run 1)** (7 of 7 pass)

- Pass: Banner after late events
- Pass: 3 events marked New since analysis
- Pass: Consequential still blocked after acknowledge
- Pass: Analyzing state
- Pass: Refreshed
- Pass: Audit times strictly decrease (newest first)
- Pass: Final snapshot is the re-run analysis

**Stale analysis (run 2)** (7 of 7 pass)

- Pass: Banner after late events
- Pass: 3 events marked New since analysis
- Pass: Consequential still blocked after acknowledge
- Pass: Analyzing state
- Pass: Refreshed
- Pass: Audit times strictly decrease (newest first)
- Pass: Final snapshot is the re-run analysis

**Stale determinism** (1 of 1 pass)

- Pass: Two runs produce identical audit transcripts

**Stale audit transcript** (newest first, identical across both runs):

1. 06:17 Dana (you) Approved Bind the renewed certificate to NPS and restart the service Conf
2. 06:17 Event Analysis updated (demo-fixture-v2), now based on 22 events.
3. 06:16 Event Dana (you) Analysis re-run
4. 06:16 Dana (you) Approved Notify Building A users about the network outage Approved on ack
5. 06:15 Event Dana (you) Stale analysis acknowledged. Consequential actions still require a 
6. 06:15 Event 3 new events arrived after the 06:11 analysis. Analysis marked out of date.
7. 06:12 Event Dana (you) Scenario changed to Stale analysis

## Keyboard

Covered by the keyboard-only Base workflow above and the three accessibility scripts: skip links, sidebar navigation, Dashboard incident links, source-alert disclosure and panel, tabs (arrow keys), affected-systems disclosure, timeline Expand/Collapse (1024–1279 px), evidence controls, Show source, Back to evidence (button and Escape), recommendation radio group (arrow keys), DecisionBar, all dialogs (Escape returns focus), scenario switcher, stale banner (Acknowledge dialog, Re-run), Audit expansion. No keyboard trap was found: modal dialogs trap focus by design and release it on Escape or Cancel. Async changes (late events, re-run) do not move focus; when a control disappears under focus, focus moves to the replacement message.

## Focus not obscured (WCAG 2.4.11)

Every Tab stop in every state was hit-tested: the browser was asked what is painted at nine points across the focused control, so sticky UI, overlays and z-order are judged as rendered, not by geometry. A control counts as visible when every sample point is the control itself. Containers taller than the viewport (the tab panel) are judged by whether any part is visible.

| State | Tab stops | Focus issues |
| --- | --- | --- |
| Dashboard 1024 | 11 | 0 |
| Source-alert panel 1024 | 5 | 0 |
| Incident Base 1024 | 51 | 0 |
| Confirmation dialog 1024 | 4 | 0 |
| Low confidence 1024 | 44 | 0 |
| Stale banner 1024 | 49 | 0 |
| Audit long snapshot 1024 | 13 | 0 |
| Dashboard 1280 | 11 | 0 |
| Source-alert panel 1280 | 5 | 0 |
| Incident Base 1280 | 33 | 0 |
| Confirmation dialog 1280 | 4 | 0 |
| Low confidence 1280 | 29 | 0 |
| Stale banner 1280 | 28 | 0 |
| Audit long snapshot 1280 | 13 | 0 |
| Dashboard 1440 | 11 | 0 |
| Source-alert panel 1440 | 5 | 0 |
| Incident Base 1440 | 33 | 0 |
| Confirmation dialog 1440 | 4 | 0 |
| Low confidence 1440 | 29 | 0 |
| Stale banner 1440 | 28 | 0 |
| Audit long snapshot 1440 | 13 | 0 |
| zoom 2048x1152 Incident | 51 | 0 |
| zoom 2048x1152 dialog | 4 | 0 |
| zoom 2560x1440 Incident | 33 | 0 |
| zoom 2560x1440 dialog | 4 | 0 |
| zoom 2880x1800 Incident | 33 | 0 |
| zoom 2880x1800 dialog | 4 | 0 |
| zoom 1280x800 (below scope) Incident | 38 | 0 |
| zoom 1280x800 (below scope) dialog | 4 | 0 |

## Responsive (1024, 1280, 1440)

| State | Horizontal overflow | Controls outside viewport | Clipped text (excluding deliberate one-line truncation and visually hidden text) | Dialog | Dock over scroll area |
| --- | --- | --- | --- | --- | --- |
| Source-alert panel 1024 | No | None | None | Fits | — |
| Dashboard 1024 | No | None | None | — | — |
| Incident Base 1024 | No | None | None | — | No |
| Confirmation dialog 1024 | No | None | None | Fits | No |
| Low confidence 1024 | No | None | None | — | No |
| Stale banner 1024 | No | None | None | — | No |
| Audit long snapshot 1024 | No | None | None | — | — |
| Source-alert panel 1280 | No | None | None | Fits | — |
| Dashboard 1280 | No | None | None | — | — |
| Incident Base 1280 | No | None | None | — | No |
| Confirmation dialog 1280 | No | None | None | Fits | No |
| Low confidence 1280 | No | None | None | — | No |
| Stale banner 1280 | No | None | None | — | No |
| Audit long snapshot 1280 | No | None | None | — | — |
| Source-alert panel 1440 | No | None | None | Fits | — |
| Dashboard 1440 | No | None | None | — | — |
| Incident Base 1440 | No | None | None | — | No |
| Confirmation dialog 1440 | No | None | None | Fits | No |
| Low confidence 1440 | No | None | None | — | No |
| Stale banner 1440 | No | None | None | — | No |
| Audit long snapshot 1440 | No | None | None | — | — |

Deliberate one-line truncations (timeline messages at 1024–1279 px, the DecisionBar's impact line, compact recommendation rationales) keep the full text in the DOM and are revealed by Expand, by selection or in the confirmation dialog.

## 200% zoom (emulated)

| State | Horizontal overflow | Controls outside viewport | Clipped text | Dialog |
| --- | --- | --- | --- | --- |
| zoom 2048x1152 Incident | No | None | None | — |
| zoom 2048x1152 dialog | No | None | None | Fits |
| zoom 2048x1152 Dashboard | No | None | None | — |
| zoom 2560x1440 Incident | No | None | None | — |
| zoom 2560x1440 dialog | No | None | None | Fits |
| zoom 2560x1440 Dashboard | No | None | None | — |
| zoom 2880x1800 Incident | No | None | None | — |
| zoom 2880x1800 dialog | No | None | None | Fits |
| zoom 2880x1800 Dashboard | No | None | None | — |
| zoom 1280x800 (below scope) Incident | No | None | None | — |
| zoom 1280x800 (below scope) dialog | No | None | None | Fits, scrolls |
| zoom 1280x800 (below scope) Dashboard | No | None | None | — |

Short viewports (≤ 760 px tall) let the incident header scroll away and compact the DecisionBar; below 1024 px the page falls back to normal document flow. Focus sweeps at each zoom size found no obscured control.

## Reduced motion

| Check | Result |
| --- | --- |
| Evidence trace highlight transition | 1e-05s |
| Show source scroll behaviour | `['auto']` (instant, not smooth) |
| Confirmation dialog animation | 1e-05s |
| Source-alert panel animation | 1e-05s |
| Dashboard return-highlight transition | 1e-05s |
| Analyzing progress animation | 1e-05s |
| Late events still arrive | True |
| Re-run still completes | True |

No meaning depends on motion: each state change is also conveyed by text, shape, focus or an announcement.

## Routes, refresh and runtime

| Route | HTTP | h1 | Survives reload | Page title |
| --- | --- | --- | --- | --- |
| `/` | 200 | Operations | Yes | Operations – OpsPilot |
| `/incidents/INC-2041` | 200 | 12 endpoints offline in Building A | Yes | 12 endpoints offline in Building A (INC-2041) – OpsPilot |
| `/incidents/INC-2041?tab=audit` | 200 | 12 endpoints offline in Building A | Yes | 12 endpoints offline in Building A (INC-2041) – OpsPilot |
| `/incidents/INC-9999` | 200 | Incident not available | Yes | Incident not available – OpsPilot |
| `/no-such-page` | 200 | Page not found | Yes | Page not found – OpsPilot |

Timers: switching scenarios five times in quick succession and leaving the incident mid-timer produced exactly one arrival of the late events (3 "New since analysis" labels, 1 "events arrived" audit line). No uncaught exception, failed request, missing asset, React warning, missing-key warning or invalid-ARIA warning was logged in either build.

## Defects found and fixed

| # | Defect | Where found | Severity | Fix |
| --- | --- | --- | --- | --- |
| 1 | Every route had the same page title, "OpsPilot" (WCAG 2.4.2 Page Titled) | Route checks | Moderate | `RouteEffects` sets a title from the page's h1, for example "12 endpoints offline in Building A (INC-2041) – OpsPilot" |
| 2 | After following a link, focus fell to the page body, so keyboard and screen-reader users got no signal that the page changed | Keyboard workflow | Moderate | Focus moves to the new page's h1 after a route change (not on first load, not on tab or search-param changes); the h1 shows no focus ring because it is a landing point, not a control |
| 3 | React Router logged two future-flag deprecation warnings on every load, in production and development | Console capture | Low | Opted in to `v7_startTransition` and `v7_relativeSplatPath`; tests use the same router flags |
| 4 | The fix for #2 first used a "first render" flag, which React StrictMode's double effects turned into a focus steal on initial load in development (first Tab skipped the skip link and sidebar) | Dev-server QA run, before release | Moderate (development only) | Compares with the previous pathname instead; regression test renders under `StrictMode` |

No visible UI changed in Phase 7, so no screenshots are attached.

## Regressions

None in Phase 1–6 behaviour. Defect 4 was introduced and caught within Phase 7.

## QA tooling issues (not product defects)

Found and corrected while building `scripts/qa-browser.py`, recorded for transparency:

- Playwright refuses to click `aria-disabled` controls by default; the "blocked Approve opens nothing" step uses a forced click, as a real user's click would be.
- A geometric focus-obscured estimate produced false positives (the demo strip above the header, the skip link drawn over the header); replaced with hit-testing.
- Visually hidden text (screen-reader prefixes, table captions, collapsed sidebar labels) was reported as clipped; excluded.
- Two predicates were too loose or too specific (one matched the focusable tab panel; one hard-coded 06:16 where the logical clock correctly gives 06:17 after an earlier decision).

## Content consistency

Terminology checked across all screens: OpsPilot, Incident, Observed, Inferred, Unknown, High / Medium / Low confidence, Consequential / Low impact / Read-only, Re-run analysis, Acknowledge, Audit trail, Event vs decision. No conflicting usage found. Two phrasings of the same idea remain ("still need a re-run" in the banner, "still require a re-run" in the recorded audit line); they do not conflict in meaning and the audit wording is part of the locked record.

## Known limitations

- Not tested with real screen readers, in Firefox or Safari, with real browser zoom controls, in forced-colours mode, or with touch or speech input.
- 200% zoom was emulated. Layouts below 1024 CSS px are a basic fallback, not a designed layout; WCAG 1.4.10 reflow at 320 CSS px is not claimed.
- The scroll area is `#main-scroll`, not the window: with focus on the page body, Page Down scrolls only after focus enters the content.
- The trace highlight is visual only; screen-reader users get the relationship through evidence names and Show source.
- Two polite live regions (analysis freshness, decision recorded) could queue together.
- State is in memory: refresh resets the demo to the Base scenario.

## Manual screen-reader test checklist

To be run by a person; none of these is reported as verified.

**VoiceOver + Safari (macOS).** Optionally repeat with NVDA + Firefox or Chrome (Windows).

1. **Observed vs inferred.** On Incident Detail, use the rotor (VO-U) to list landmarks: confirm "Observed facts" and "AI assistance" regions. In the AI summary, confirm each statement is preceded by "Observed fact, source: …" or "Inferred by AI, n evidence items".
2. **Evidence → source → return.** In the primary hypothesis, activate "Show source: 06:08:50, nps-bldga-01". Confirm VoiceOver moves to and reads the timeline event, then that "Back to evidence" (or Escape) returns to the same evidence button.
3. **Low-confidence blocked action.** Switch to Low confidence, select "Bind the renewed certificate…", move to Approve. Confirm it is announced as dimmed or unavailable with "Approve and Modify unavailable: Confidence is Low. Verify the cause first."
4. **Stale announcement.** Switch to Stale analysis and wait 3 seconds without moving focus. Confirm "3 new events arrived. The analysis is out of date, so approvals are paused." is spoken once and focus does not move.
5. **DecisionBar status.** Approve Verify (Low confidence). Confirm the recorded message is announced and focus lands on it.
6. **Dialogs.** Open Approve (Base), Dismiss, Escalate and Acknowledge. Confirm each announces its title and description, the typed-confirmation hint is read, and Escape returns to the opening button.
7. **Audit chronology.** In the Stale scenario after a re-run and approval, open the Audit tab. Navigate by list item: confirm newest-first order is understandable, decisions are distinguishable from lines beginning "Event", and time, actor, action and outcome are read for each decision.
8. **Long frozen analysis.** Expand "View analysis at decision time" on a decision. Navigate by heading (VO-Command-H): confirm the hypotheses and recommendations are reachable as h4 headings and that the snapshot contains no actionable controls.

## Reproducing

```bash
npm test && npm run typecheck && npm run lint && npm run build
python3 scripts/contrast-audit.py
npx vite preview --port 4173 &
python3 scripts/qa-browser.py http://localhost:4173
python3 scripts/a11y-browser-audit.py http://localhost:4173
python3 scripts/a11y-dashboard-audit.py http://localhost:4173
python3 scripts/a11y-scenarios-audit.py http://localhost:4173
npx vite --port 5173 &
python3 scripts/qa-browser.py http://localhost:5173 --dev
```
