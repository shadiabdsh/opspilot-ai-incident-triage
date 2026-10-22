# OpsPilot accessibility audit

**Statement of conformance.** OpsPilot is designed and audited against WCAG 2.2 AA criteria within the prototype's supported scope. It is not claimed to be WCAG 2.2 AA compliant: not every applicable criterion has been tested with real assistive technology, and layouts below 1024 px are outside the designed scope.

Automated tools (axe-core, jsdom tests, scripted browser checks) found the issues listed below and helped verify fixes. They do not prove conformance; a substantial part of WCAG can only be judged by people, including people who use assistive technology.

Audit date: 2026-10-21. Covers Incident Detail (Phase 3), the Operations Dashboard (Phase 4), and the Low-confidence and Stale-analysis scenario states (Phase 5).

---

## 1. WCAG target

WCAG 2.2, Level A and AA success criteria, as they apply to the Incident Detail screen, the Operations Dashboard, and their dialogs and panels, in the Base, Low-confidence and Stale-analysis scenarios.

## 2. Supported prototype scope

| In scope | Out of scope |
| --- | --- |
| Incident Detail (Overview and Audit tabs), confirmation, reason and acknowledge dialogs; Operations Dashboard, source-alert preview and panel, return state; all three demo scenarios | — |
| Viewport widths 1024, 1280 and 1440 CSS px, at 100% and the 200% zoom equivalents of 2048, 2560 and 2880 px windows | Designed layouts below 1024 CSS px, including WCAG 1.4.10 reflow at 320 CSS px (a basic single-column fallback exists; it is not a designed layout) |
| Keyboard, pointer, reduced motion | Touch input, speech input, forced-colours / Windows High Contrast (not tested) |
| Chromium (Playwright) for scripted checks | Firefox and Safari (not tested) |

## 3. Colour contrast

Method: `scripts/contrast-audit.py` reads the actual values in `src/styles/tokens.css`, alpha-blends translucent colours (the DecisionBar navy, chip fills, the active nav tint) over the background they actually sit on, and computes WCAG contrast ratios. Run it with `python3 scripts/contrast-audit.py --markdown`. axe-core's colour-contrast rule was also run in a real browser (section 9).

Thresholds: 4.5:1 for normal text, 3:1 for large text and for non-text UI boundaries and states (1.4.3, 1.4.11). All text in the table is treated as normal-size text, the stricter case.

**Result: 97 of 97 measured pairs pass** (11 failed before the Phase 3 accessibility pass; see section 10). Phase 4 added 9 Dashboard pairings Phase 5 added 15 scenario-state pairings and Phase 6 added 3 audit pairings; one Phase 5 border failed at first and was fixed (see the Phase 5 section).

| Element | Token | Foreground | Background | Ratio | Required | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Primary body text | `--color-ink` | `#0e1a2b` | `#ffffff` | 17.48:1 | 4.5:1 | Pass |
| Primary text on canvas | `--color-ink` | `#0e1a2b` | `#f3f6f9` | 16.12:1 | 4.5:1 | Pass |
| Secondary text (ink-soft) | `--color-ink-soft` | `#2a3a50` | `#ffffff` | 11.54:1 | 4.5:1 | Pass |
| Muted metadata (quiet) on white | `--color-quiet` | `#4b5a6e` | `#ffffff` | 7.03:1 | 4.5:1 | Pass |
| Muted metadata (quiet) on canvas | `--color-quiet` | `#4b5a6e` | `#f3f6f9` | 6.48:1 | 4.5:1 | Pass |
| Muted metadata (quiet) on sunken | `--color-quiet` | `#4b5a6e` | `#f6f8fb` | 6.61:1 | 4.5:1 | Pass |
| Faint labels (faint) on white | `--color-faint` | `#5a697c` | `#ffffff` | 5.61:1 | 4.5:1 | Pass |
| Faint labels (faint) on sunken | `--color-faint` | `#5a697c` | `#f6f8fb` | 5.27:1 | 4.5:1 | Pass |
| Faint labels (faint) on canvas | `--color-faint` | `#5a697c` | `#f3f6f9` | 5.17:1 | 4.5:1 | Pass |
| Faint labels (faint) on canvas top | `--color-faint` | `#5a697c` | `#e7eef5` | 4.79:1 | 4.5:1 | Pass |
| Faint labels (faint) on AI tint top | `--color-faint` | `#5a697c` | `#e2f4f7` | 4.94:1 | 4.5:1 | Pass |
| Source label (quiet) on sunken group rows | `--color-quiet` | `#4b5a6e` | `#f6f8fb` | 6.61:1 | 4.5:1 | Pass |
| Timeline raw message (quiet) on trace | `--color-quiet` | `#4b5a6e` | `#fff1bf` | 6.22:1 | 4.5:1 | Pass |
| Timeline metadata (ink-soft) on trace | `--color-ink-soft` | `#2a3a50` | `#fff1bf` | 10.22:1 | 4.5:1 | Pass |
| Links | `(literal)` | `#1b62bd` | `#ffffff` | 5.95:1 | 4.5:1 | Pass |
| AI region meta (quiet) on AI tint top | `--color-quiet` | `#4b5a6e` | `#e2f4f7` | 6.20:1 | 4.5:1 | Pass |
| AI heading text on AI tint | `--color-ink` | `#0e1a2b` | `#e2f4f7` | 15.41:1 | 4.5:1 | Pass |
| Teal text on white (rank, toggles) | `--color-inference-strong` | `#066574` | `#ffffff` | 6.73:1 | 4.5:1 | Pass |
| Teal text on pale cyan (Inferred tag) | `--color-inference-strong` | `#066574` | `#eaf7f9` | 6.14:1 | 4.5:1 | Pass |
| Teal text on strong cyan (tag expanded) | `--color-inference-strong` | `#066574` | `#cdeef2` | 5.48:1 | 4.5:1 | Pass |
| Teal text on AI tint top | `--color-inference-strong` | `#066574` | `#e2f4f7` | 5.93:1 | 4.5:1 | Pass |
| Confidence word on cyan chip | `--color-inference-strong` | `#066574` | `#eaf7f9` | 6.14:1 | 4.5:1 | Pass |
| Unknown tag text | `--color-unknown` | `#555f6c` | `#eef0f3` | 5.68:1 | 4.5:1 | Pass |
| Observed tag text | `--color-ink-soft` | `#2a3a50` | `#f6f8fb` | 10.85:1 | 4.5:1 | Pass |
| Observed tag source (quiet) | `--color-quiet` | `#4b5a6e` | `#f6f8fb` | 6.61:1 | 4.5:1 | Pass |
| Critical badge (coral on tint) | `--color-critical` | `#c63c28` | `#fdeeea` | 4.56:1 | 4.5:1 | Pass |
| Coral text on white | `--color-critical` | `#c63c28` | `#ffffff` | 5.15:1 | 4.5:1 | Pass |
| Decided pill (green on tint) | `--color-success` | `#11795a` | `#e3f4ee` | 4.72:1 | 4.5:1 | Pass |
| Caution note (orange on tint) | `--color-warning` | `#ad4a14` | `#fcefe6` | 4.95:1 | 4.5:1 | Pass |
| Major badge | `--color-major` | `#a85a12` | `#fbf0e4` | 4.52:1 | 4.5:1 | Pass |
| Minor badge | `--color-minor` | `#6b6a1c` | `#f4f4df` | 5.09:1 | 4.5:1 | Pass |
| Info badge | `--color-info` | `#475569` | `#eef2f6` | 6.74:1 | 4.5:1 | Pass |
| Sidebar inactive nav | `--color-nav-text` | `#9fb0c5` | `#0b1626` | 8.20:1 | 4.5:1 | Pass |
| Sidebar strong text | `--color-nav-text-strong` | `#eaf1f8` | `#0b1626` | 15.93:1 | 4.5:1 | Pass |
| Sidebar active nav | `--color-nav-text-strong` | `#eaf1f8` | `#102838` | 13.33:1 | 4.5:1 | Pass |
| Sidebar raised band text | `--color-nav-text` | `#9fb0c5` | `#12233a` | 7.15:1 | 4.5:1 | Pass |
| DecisionBar title | `(literal)` | `#ffffff` | `#192333` | 15.79:1 | 4.5:1 | Pass |
| DecisionBar secondary (eyebrow, impact, reasons) | `--color-nav-text` | `#9fb0c5` | `#192333` | 7.14:1 | 4.5:1 | Pass |
| DecisionBar secondary action label | `--color-nav-text-strong` | `#eaf1f8` | `#222c3b` | 12.36:1 | 4.5:1 | Pass |
| DecisionBar blocked action label | `--color-dock-disabled` | `#7d90a7` | `#192333` | 4.83:1 | 4.5:1 | Pass |
| Approve label on cyan | `(literal)` | `#04202a` | `#3cc8d8` | 8.39:1 | 4.5:1 | Pass |
| DecisionBar risk chip (caution) | `(literal)` | `#ffb3a4` | `#3b313b` | 7.25:1 | 4.5:1 | Pass |
| DecisionBar neutral chip | `--color-nav-text-strong` | `#eaf1f8` | `#27303f` | 11.66:1 | 4.5:1 | Pass |
| DecisionBar recorded message | `--color-nav-text-strong` | `#eaf1f8` | `#1c3444` | 11.35:1 | 4.5:1 | Pass |
| DecisionBar warning text | `(literal)` | `#ffc2a8` | `#192333` | 10.18:1 | 4.5:1 | Pass |
| DecisionBar link | `--color-inference-bright` | `#3cc8d8` | `#1c3444` | 6.43:1 | 4.5:1 | Pass |
| Dialog description | `--color-quiet` | `#4b5a6e` | `#ffffff` | 7.03:1 | 4.5:1 | Pass |
| Dialog facts label (faint) on sunken | `--color-faint` | `#5a697c` | `#f6f8fb` | 5.27:1 | 4.5:1 | Pass |
| Dialog primary button label | `(literal)` | `#ffffff` | `#066574` | 6.73:1 | 4.5:1 | Pass |
| Dialog disabled button label | `--color-faint` | `#5a697c` | `#f6f8fb` | 5.27:1 | 4.5:1 | Pass |
| Dialog error text | `--color-critical` | `#c63c28` | `#ffffff` | 5.15:1 | 4.5:1 | Pass |
| Dashboard changed-row highlight: title (ink) | `--color-ink` | `#0e1a2b` | `#eaf7f9` | 15.96:1 | 4.5:1 | Pass |
| Dashboard changed-row highlight: metadata (quiet) | `--color-quiet` | `#4b5a6e` | `#eaf7f9` | 6.42:1 | 4.5:1 | Pass |
| Dashboard changed-row highlight: id / affected (ink-soft) | `--color-ink-soft` | `#2a3a50` | `#eaf7f9` | 10.54:1 | 4.5:1 | Pass |
| Dashboard column headers (faint) on white | `--color-faint` | `#5a697c` | `#ffffff` | 5.61:1 | 4.5:1 | Pass |
| Dashboard preview toggle hover (teal on tint) | `--color-inference-strong` | `#066574` | `#eaf7f9` | 6.14:1 | 4.5:1 | Pass |
| Site health: degraded state (coral) on white | `--color-critical` | `#c63c28` | `#ffffff` | 5.15:1 | 4.5:1 | Pass |
| Source-alert panel message (quiet) on white | `--color-quiet` | `#4b5a6e` | `#ffffff` | 7.03:1 | 4.5:1 | Pass |
| Stale banner title (ink) on caution tint | `--color-ink` | `#0e1a2b` | `#fcefe6` | 15.51:1 | 4.5:1 | Pass |
| Stale banner body (ink-soft) on caution tint | `--color-ink-soft` | `#2a3a50` | `#fcefe6` | 10.24:1 | 4.5:1 | Pass |
| Refreshed notice (ink-soft) on success tint | `--color-ink-soft` | `#2a3a50` | `#e3f4ee` | 10.14:1 | 4.5:1 | Pass |
| Refreshed notice strong (ink) on success tint | `--color-ink` | `#0e1a2b` | `#e3f4ee` | 15.35:1 | 4.5:1 | Pass |
| Re-run button label (white) on teal | `(literal)` | `#ffffff` | `#066574` | 6.73:1 | 4.5:1 | Pass |
| Analyzing banner body (ink-soft) on white | `--color-ink-soft` | `#2a3a50` | `#ffffff` | 11.54:1 | 4.5:1 | Pass |
| Demo strip hint (quiet) on canvas top | `--color-quiet` | `#4b5a6e` | `#e7eef5` | 6.01:1 | 4.5:1 | Pass |
| Demo strip label (ink-soft) on canvas top | `--color-ink-soft` | `#2a3a50` | `#e7eef5` | 9.86:1 | 4.5:1 | Pass |
| Demo option pressed (ink) on white | `--color-ink` | `#0e1a2b` | `#ffffff` | 17.48:1 | 4.5:1 | Pass |
| Source availability (ink) on sunken | `--color-ink` | `#0e1a2b` | `#f6f8fb` | 16.43:1 | 4.5:1 | Pass |
| New since analysis label (caution) on white | `--color-warning` | `#ad4a14` | `#ffffff` | 5.58:1 | 4.5:1 | Pass |
| Audit "Event" label (ink-soft) on canvas | `--color-ink-soft` | `#2a3a50` | `#f3f6f9` | 10.64:1 | 4.5:1 | Pass |
| Audit event message (ink-soft) on canvas | `--color-ink-soft` | `#2a3a50` | `#f3f6f9` | 10.64:1 | 4.5:1 | Pass |
| Snapshot group label (ink-soft) on sunken | `--color-ink-soft` | `#2a3a50` | `#f6f8fb` | 10.85:1 | 4.5:1 | Pass |
| Input / select / textarea border | `--color-control-border` | `#7d8b9e` | `#ffffff` | 3.47:1 | 3.0:1 | Pass |
| Focus ring on white | `--color-focus` | `#1b6fd1` | `#ffffff` | 4.95:1 | 3.0:1 | Pass |
| Focus ring on canvas | `--color-focus` | `#1b6fd1` | `#f3f6f9` | 4.57:1 | 3.0:1 | Pass |
| Focus ring on trace highlight | `--color-focus` | `#1b6fd1` | `#fff1bf` | 4.38:1 | 3.0:1 | Pass |
| Focus ring on DecisionBar (white) | `(literal)` | `#ffffff` | `#192333` | 15.79:1 | 3.0:1 | Pass |
| Focus ring on sidebar (cyan) | `--color-inference-bright` | `#3cc8d8` | `#0b1626` | 9.03:1 | 3.0:1 | Pass |
| Focus ring on active nav item | `--color-inference-bright` | `#3cc8d8` | `#102838` | 7.55:1 | 3.0:1 | Pass |
| Active tab indicator | `--color-inference` | `#0b8a9b` | `#ffffff` | 4.10:1 | 3.0:1 | Pass |
| Selected recommendation border | `--color-inference` | `#0b8a9b` | `#ffffff` | 4.10:1 | 3.0:1 | Pass |
| Inferred toggle border | `--color-inference` | `#0b8a9b` | `#ffffff` | 4.10:1 | 3.0:1 | Pass |
| Trace edge vs trace fill | `--color-trace-edge` | `#b07d00` | `#fff1bf` | 3.22:1 | 3.0:1 | Pass |
| Trace edge vs white | `--color-trace-edge` | `#b07d00` | `#ffffff` | 3.63:1 | 3.0:1 | Pass |
| Confidence bar fill vs chip | `--color-inference` | `#0b8a9b` | `#eaf7f9` | 3.74:1 | 3.0:1 | Pass |
| Confidence empty bar vs chip | `--color-control-border` | `#7d8b9e` | `#eaf7f9` | 3.16:1 | 3.0:1 | Pass |
| Approve button vs dock | `--color-inference-bright` | `#3cc8d8` | `#192333` | 7.86:1 | 3.0:1 | Pass |
| Secondary action border vs dock | `(literal)` | `#6d7c8e` | `#192333` | 3.70:1 | 3.0:1 | Pass |
| Timeline expand / control border | `--color-control-border` | `#7d8b9e` | `#ffffff` | 3.47:1 | 3.0:1 | Pass |
| Offline status dot | `--color-critical` | `#c63c28` | `#ffffff` | 5.15:1 | 3.0:1 | Pass |
| Online status dot | `--color-success` | `#11795a` | `#ffffff` | 5.38:1 | 3.0:1 | Pass |
| Site health degraded rail (coral) vs white | `--color-critical` | `#c63c28` | `#ffffff` | 5.15:1 | 3.0:1 | Pass |
| View-all / Close button border | `--color-control-border` | `#7d8b9e` | `#ffffff` | 3.47:1 | 3.0:1 | Pass |
| Stale banner caution rail vs caution tint | `--color-warning` | `#ad4a14` | `#fcefe6` | 4.95:1 | 3.0:1 | Pass |
| Demo option group border vs canvas top | `--color-faint` | `#5a697c` | `#e7eef5` | 4.79:1 | 3.0:1 | Pass |
| Demo option pressed outline vs white | `--color-control-border` | `#7d8b9e` | `#ffffff` | 3.47:1 | 3.0:1 | Pass |
| Analyzing progress bar vs its track | `--color-inference` | `#0b8a9b` | `#cdeef2` | 3.34:1 | 3.0:1 | Pass |

**Areas specifically reviewed on request:** muted grey metadata (`--color-quiet` 6.2–7.0:1, `--color-faint` 4.8–5.6:1 after fixes); teal text on pale cyan and white (5.5–6.7:1); cyan provenance outlines (4.1:1 as a UI boundary); tiny secondary labels (use `--color-faint` or darker); timeline metadata (≥ 6.2:1, including on the amber highlight); DecisionBar secondary text (7.1:1); blocked-action labels (4.8:1, even though disabled controls are exempt); coral badges (4.56:1 on their tint, 5.15:1 on white); pale status backgrounds (all ≥ 4.5:1 with their text); AI-assistance tint (text measured on both gradient stops).

## 4. Keyboard test results

Method: `scripts/a11y-browser-audit.py` drives Chromium with the keyboard only (Tab, Shift+Tab, Enter, Space, arrows, Escape) against the production build. Results are in `scripts/a11y-results.json`.

**Base workflow: 20 of 20 steps pass.**

| Step | Result |
| --- | --- |
| Reach the incident tabs from page start (6 Tab presses, via the skip link) | Pass |
| Observed facts: reach and expand the workstation group with Enter | Pass |
| AI analysis: reach the summary's Inferred toggle; expand its evidence with Enter | Pass |
| Evidence: reach Show source in the primary hypothesis | Pass |
| Show source moves focus to the source event row (not obscured, 2px outline) | Pass |
| Tab reaches Back to evidence; Enter returns focus to the same evidence item | Pass |
| Escape in the source row returns focus to the same evidence item | Pass |
| Recommendations: reach the radio group; ArrowDown and ArrowUp change the selection | Pass |
| Reach Approve in the decision dock; Enter opens the dialog with focus inside it | Pass |
| Escape closes the dialog and returns focus to Approve | Pass |
| Typed confirmation records the decision; focus moves to the recorded confirmation | Pass |
| View in audit trail opens the Audit tab; the frozen analysis expands with Enter | Pass |

**Other decisions by keyboard only:** Modify (edit parameter, typed confirmation), Dismiss (preset reason), Escalate (team and note) each opened with focus inside the dialog and recorded correctly. ReasonDialog moves focus to the first invalid field on a failed submit (covered by component tests).

**Keyboard traps:** none found. Dialogs trap focus intentionally (modal) and release it on Escape or Cancel.

## 5. Focus test results

| Check | Method | Result |
| --- | --- | --- |
| Focus visible (2.4.7) | Computed outline at each of 28 focus stops in the Base walkthrough | All 28 show a 2px solid outline |
| Focus colour contrast | Contrast audit | Blue ring 4.95:1 on white, 4.57:1 on canvas, 4.38:1 on the amber highlight; white ring 15.8:1 on the DecisionBar; cyan ring 9.0:1 on the sidebar and 7.6:1 on the active nav item |
| Focus not obscured (2.4.11) | At every focus stop, compare the focused element with the sticky header (when sticky), the scroll-area edge and the dock | No control is entirely or partly hidden at 1024, 1280, 1440 or the 200% equivalents. The only "partly" result is the Overview tab panel itself (focusable per the ARIA tabs pattern), which is taller than the viewport by nature; 2.4.11 is met because it is not entirely hidden |
| Light and dark surfaces | Screenshots `12a`, `12b` | Visible on both |
| Programmatic focus targets | Source event rows (`tabIndex=-1`) | Always outlined when focused (`:focus`, not only `:focus-visible`) |

Two containers suppress the outline on purpose: the skip-link target `#main` and the decision dock wrapper. Both are non-interactive landing points for skip links (`tabIndex=-1`); the next Tab moves to a visibly focused control.

## 6. Screen-reader observations

**Not tested with a real screen reader.** The following were verified programmatically (accessible-name computation, roles and DOM structure in jsdom and Chromium), which is necessary but not sufficient:

- One `h1` (the incident title). Headings descend without skips: h2 regions → h3 objects → h4 evidence sections.
- Landmarks: primary `nav`, `main`, breadcrumb `nav`, named regions "Observed facts", "AI assistance", "Summary", and the DecisionBar region named "Deciding on …".
- Tabs: Radix Tabs (ARIA tabs pattern; arrow keys move between tabs; covered by a test).
- Recommendation selection: native radio group in a `fieldset` with legend "Recommendations"; arrow keys move selection.
- Dialogs: Radix Dialog with a title (name) and description.
- Blocked actions: `aria-disabled`, focusable, with `aria-describedby` pointing to the visible reason (for example "Approve and Modify unavailable: Confidence is Low. Verify the cause first.").
- Confidence: a group named "Confidence: High" followed by the visible reason text.
- Provenance: names state the meaning ("Observed fact, source: NPS log", "Inferred by AI, 4 evidence items", "Unknown: the AI could not determine this").
- Evidence relationship without colour: each evidence item names its time, system and raw message; Show source has a specific name ("Show source: 06:08:50, nps-bldga-01") and moves focus to the event.
- Live regions: exactly one (`role=status`, polite) for "Decision recorded". The confirm dialog's hint is polite and changes only when the typed text becomes valid or invalid.

**Known gap:** the hover/focus trace highlight is visual. A screen-reader user gets the same relationship through the evidence item's content and Show source, but the highlight itself is not announced.

## 7. Zoom test

Method: Chromium with `device_scale_factor=2` and a CSS viewport of half the window size, which is what 200% browser zoom produces. This emulates zoom; it was not done with the browser's zoom control.

| Window at 200% | CSS viewport | Horizontal overflow | Header | Reading space | Focus obscured |
| --- | --- | --- | --- | --- | --- |
| 2048 × 1152 | 1024 × 576 | None | Scrolls away (short viewport) | 434 px | None |
| 2560 × 1440 | 1280 × 720 | None | Scrolls away (short viewport) | 570 px | None |
| 2880 × 1800 | 1440 × 900 | None | Sticky | 578 px | None |
| 1280 × 800 (below scope) | 640 × 400 | None | Scrolls away | 400 px (normal document flow; decision surface at the end) | None |

Before this pass, 1024 × 576 left 276 px of reading space and 640 × 400 left 6 px. Fixes: the incident header stops being sticky when the viewport is 760 px tall or less; the DecisionBar drops its one-line impact context on short viewports; below 1024 px the page returns to normal flow.

## 8. Reduced motion

With `prefers-reduced-motion: reduce` (verified in Chromium): transitions and animations compute to effectively zero (`1e-05s`) for evidence items, timeline rows and the dialog; Show source uses instant scrolling instead of smooth scrolling. No meaning depends on motion: every state change (trace, selection, recorded decision, dialog) is also conveyed by colour plus text, shape or focus.

## 9. Automated checks

| Check | Result |
| --- | --- |
| axe-core in Chromium, colour contrast enabled: overview at 1440, 1280, 1024; trace hover; recommendation expanded; typed-confirmation dialog; recorded state; Audit with frozen analysis expanded | 0 violations in all 8 states |
| axe "needs review" | Colour contrast over gradient or translucent backgrounds (sidebar, header, AI region): axe cannot compute these, so they were measured in section 3. `aria-hidden-focus` while a dialog is open: Radix's modal pattern hides the background from assistive technology while focus is trapped in the dialog; the keyboard test confirms background controls cannot receive focus |
| Component tests (jsdom) | 167 tests pass, including 19 axe assertions across the signature components, dialogs, Gallery and Incident Detail |
| TypeScript, ESLint (with jsx-a11y), production build | Pass |

## Colour independence

| Meaning | Non-colour cue |
| --- | --- |
| Critical severity | The word "Critical" (plus a dot) |
| Decided / In review | The words in the status pill |
| High / Medium / Low confidence | The word, plus 3 / 2 / 1 filled signal bars |
| Observed / Inferred / Unknown | The word, a solid / dashed / dotted border, an eye / spark / question icon, and the accessible name |
| Consequential / low impact / read-only | The tier word; consequential also has a warning icon |
| Online / offline | The word, plus a dot |
| Blocked action | A lock icon, a dashed border, the visible reason, and `aria-disabled` |
| Evidence trace | Amber fill plus a darker amber edge and node ring; Show source also moves focus |
| Cited events | The "Cited by AI (n)" label with icon, plus a filled timeline node |

## Target size (2.5.8)

All visible interactive targets are at least 24 × 24 CSS px, except:

- The four recommendation radios (16 × 16). Each meets the **spacing exception**: the nearest other target is 49–55 px from the radio's centre, well beyond the 12 px required. Each radio's label also activates it.
- The skip links, which are 1 × 1 until focused and then render at full size.
- "View in audit trail", an inline link inside a sentence (inline exception).

## 10. Issues discovered and fixes made

| # | Issue | WCAG | Fix |
| --- | --- | --- | --- |
| 1 | `--color-faint` metadata 2.9–3.1:1 | 1.4.3 | Token darkened to `#5a697c` (≥ 4.8:1 on every surface); `--color-quiet` darkened to `#4b5a6e` so the two remain distinct |
| 2 | Form-field and control borders 1.5:1 | 1.4.11 | New token `--color-control-border` `#7d8b9e` (3.5:1), used by inputs, selects, textareas, dialog buttons, timeline Expand |
| 3 | Amber trace edge 2.0–2.3:1 | 1.4.11 | `--color-trace-edge` darkened to `#b07d00` (3.2:1 on the highlight, 3.6:1 on white) |
| 4 | Empty confidence bars 1.4:1 | 1.4.11 | Outline uses `--color-control-border` |
| 5 | DecisionBar secondary button border 2.99:1 | 1.4.11 | Border alpha raised to 0.48 (3.7:1) |
| 6 | Focus ring drawn with box-shadow, clipped inside an `overflow: hidden` card and not rendered on native radios | 2.4.7 | Global focus is now a 2px outline; the primary hypothesis card no longer clips; white ring on the DecisionBar so it stays distinct from the cyan Approve |
| 7 | DecisionBar could cover hypothesis, evidence and recommendation content (sticky overlay) | 2.4.11, 1.4.10 | The bar moved to a reserved dock below the single scroll area; nothing scrolls behind it |
| 8 | Sticky header plus dock left 276 px (1024 × 576) and 6 px (640 × 400) of reading space at 200% zoom | 1.4.10, 2.4.11 | Header scrolls away on short viewports; DecisionBar compacts; normal-flow fallback below 1024 px |
| 9 | Disclosure targets 18–20 px tall (Inferred toggle, section toggles, systems group, audit expander, breadcrumb link) | 2.5.8 | Minimum 24 px height |
| 10 | Sticky header was 96% opaque, so scrolled text showed faintly behind the title | 1.4.3 | Header is opaque |
| 11 | Truncated raw messages at 1024–1279 px could not be revealed by keyboard | 2.1.1 | An Expand / Collapse button appears on rows whose message is actually truncated |

## 11. Known limitations

- Not tested with real screen readers (VoiceOver, NVDA, JAWS).
- Not tested in Firefox, Safari, Windows forced-colours mode, or with touch or speech input.
- Zoom was emulated with device scale factor, not the browser zoom control.
- Layouts below 1024 CSS px are not designed. The fallback keeps content reachable but has not been reviewed for usability; 1.4.10 at 320 CSS px is not claimed.
- The scroll area is `#main-scroll`, not the window. With focus on the page body, Page Down and Space scroll it only after focus enters the content (for example via the skip link or the first Tab).
- The trace highlight is not announced to screen readers (section 6).

## 12. Requires real manual and user testing

1. Screen-reader passes with VoiceOver (macOS, Safari) and NVDA (Windows, Firefox and Chrome): the trace, blocked-action announcements, the confirmation dialog, and the Audit tab.
2. Real browser zoom at 200% and 400%, plus text-only zoom and the 1.4.12 text-spacing overrides.
3. Windows High Contrast / forced colours: provenance borders, the trace and focus rings.
4. Keyboard use by people who rely on it daily, especially the Show source / Back to evidence round trip.
5. Cognitive load and comprehension of provenance and confidence with operations practitioners (the proposed validation criteria in the product spec).
6. Re-run this audit after the Dashboard and the remaining scenarios are built.

## Phase 4: Operations Dashboard

Method: `scripts/a11y-dashboard-audit.py` (Chromium, production build) plus the jsdom tests in `src/screens/DashboardScreen.test.tsx`. Loading and empty states use a development-only switch, so they are covered by the jsdom axe tests rather than the production-build browser run.

**axe in Chromium (colour contrast enabled):** 0 violations at 1440, 1280 and 1024, with the source-alert preview open, and with the full source-alert panel open. Items marked for review: colour contrast over the canvas gradient (measured in section 3); `aria-valid-attr-value` on the "View all" trigger, because Radix points `aria-controls` at the panel before the panel exists (resolves once open); `aria-hidden-focus` while the panel is open (Radix modal pattern, as in Phase 3).

**Keyboard:**

| Step | Result |
| --- | --- |
| Tab reaches INC-2041 title link | Pass |
| Tab reaches Preview source alerts | Pass |
| Enter expands preview; focus stays on the toggle | Pass |
| Tab reaches View all | Pass |
| Panel opens with focus inside | Pass |
| Escape closes the panel; focus returns to View all | Pass |
| Shift+Tab back to the title link | Pass |
| Enter on the title opens Incident Detail | Pass |

**Focus:** 7 of 7 focus stops show the 2px outline; none is obscured.

**Structure:** `h1` Operations, `h2` Incident queue, `h2` Site health. The queue is a `table` with a caption; each row's header cell is the incident, and the title is the only link in the row (no whole-row click target). Severity and status read as "Severity: Critical" and "Status: Open". The grouping line reads "Inferred by AI, 12 alerts grouped". The preview control is a `button` with `aria-expanded` and `aria-controls`. The full list is a named dialog with a description.

**Return after a decision:** the status updates in place and the row keeps its position. A polite live region announces "INC-2041 status changed to Decided." (or Escalated) once; a second visit is silent. The row highlight fades over 0.6s; with reduced motion the transition computes to effectively zero (`1e-05s`). The highlight is never the only signal: the status text changes.

**Target size:** no visible target under 24 × 24 px.

**Zoom:** no horizontal overflow at the 200% equivalents of 2048 × 1152 and 2560 × 1440, nor at 640 × 400 (below scope).

**Issue found and fixed:** the full source-alert list scrolled inside the panel but contained no focusable element, so keyboard users could not scroll it (axe `scrollable-region-focusable`, WCAG 2.1.1). It is now a named, focusable region ("Source alerts list").

**Not tested:** real screen readers on the Dashboard, including how the live-region announcement and the table's row headers are read.

## Phase 5: Scenario States

Method: `scripts/a11y-scenarios-audit.py` (Chromium, production build, real timers) plus `src/screens/ScenarioStates.test.tsx` (jsdom, fake timers for the 3 s and 1.5 s boundaries).

**axe in Chromium (colour contrast enabled):**

| State | Violations | Needs review (explained below) |
| --- | --- | --- |
| low-default | 0 | color-contrast |
| low-blocked-card-selected | 0 | color-contrast |
| low-verify-selected | 0 | color-contrast |
| low-dismiss-dialog | 0 | aria-hidden-focus, color-contrast |
| low-escalate-dialog | 0 | aria-hidden-focus, color-contrast |
| low-audit-entry | 0 | color-contrast |
| stale-before-events | 0 | color-contrast |
| stale-banner | 0 | aria-valid-attr-value, color-contrast |
| stale-acknowledge-dialog | 0 | aria-hidden-focus, color-contrast |
| stale-acknowledged | 0 | color-contrast |
| stale-analyzing | 0 | color-contrast |
| stale-refreshed | 0 | color-contrast |
| stale-audit | 0 | color-contrast |

"Needs review" items: colour contrast over the canvas gradient (measured in section 3); `aria-hidden-focus` while a modal dialog is open (Radix modal pattern); `aria-valid-attr-value` on the Acknowledge trigger, whose `aria-controls` points at the dialog before it exists (resolves once open).

**Low confidence: keyboard**

| Step | Result |
| --- | --- |
| Reach "Low confidence" in the demo control | Pass |
| Switch keeps focus on the pressed button | Pass |
| Reach the recommendation radios (Verify preselected) | Pass |
| ArrowDown selects the blocked consequential card | Pass |
| Reach Approve in the dock (aria-disabled, focusable) | Pass |
| Blocked reason is the description: "Approve and Modify unavailable: Confidence is Low. Verify the cause first." | Pass |
| Enter on blocked Approve opens nothing | Pass |
| Shift+Tab back to the radios | Pass |
| ArrowUp returns to Verify | Pass |
| Verify approved by keyboard; outcome announced | Pass |

**Stale analysis: keyboard and focus**

| Step | Result |
| --- | --- |
| Focus unchanged when events arrive | Pass |
| Stale announced in a polite live region | Pass |
| Shift+Tab reaches Acknowledge in the banner | Pass |
| Acknowledge dialog opens with focus inside | Pass |
| Escape cancels and returns focus to Acknowledge | Pass |
| After acknowledging, focus lands on the compact notice (not lost) | Pass |
| Tab reaches Re-run analysis in the notice | Pass |
| During re-run, focus is on the analyzing message (not lost) | Pass |
| After refresh, focus is on the updated notice (not lost) | Pass |
| Refresh announced | Pass |
| Consequential Approve available after refresh | Pass |

**Gating and blocked actions.** All availability comes from `gate()`. In Low confidence, consequential Approve and Modify stay visible, focusable (`aria-disabled`) and described by "Approve and Modify unavailable: Confidence is Low. Verify the cause first."; the blocked card keeps its reason visible and its radio is described by it. While stale, every Approve and Modify is blocked ("Analysis is out of date…"); Dismiss and Escalate stay available. While analyzing, all actions are paused ("Waiting for analysis."). After acknowledging, read-only and low-impact actions return (and are flagged in the audit), but consequential Approve and Modify stay blocked ("Re-run required: consequential actions need fresh analysis."). Blocked attempts never write an audit entry (tested). If the analysis goes stale while a confirmation dialog is open, the dialog shows the new reason and its submit stays unavailable.

**Unknown provenance and missing evidence.** The Unknown statement is tagged "Unknown: the AI could not determine this" and shows its reason as text. The unreadable NPS log is stated in Observed facts as a factual notice ("NPS event log: not retrieved. Events from this source are missing from the timeline because they could not be read, not because none occurred."), and the facts header names only the sources that were read.

**Alternative hypothesis.** Each hypothesis is an article named by its cause, preceded by the text "Primary hypothesis" or "Alternative hypothesis"; both show "Low confidence" as text with its reason. No percentage is shown anywhere.

**Stale announcement and timers.** One polite live region announces each analysis transition once: events arrived, re-running, updated, acknowledged. Events arriving do not move focus (verified: the focused radio stays focused). When a banner control disappears (Acknowledge confirmed, re-run started or finished), focus moves to the banner's message rather than falling to the page body. The banner never takes focus when it first appears. New events carry the visible text "New since analysis", not colour alone. Switching scenario cancels pending timers, and callbacks from an old scenario are ignored (tested with fake timers).

**Reduced motion.** With `prefers-reduced-motion: reduce`, the timers still run (events arrived: True; refresh completed: True), and the analyzing progress animation computes to 1e-05s. No meaning depends on motion.

**Issues found and fixed in Phase 5**

| Issue | WCAG | Fix |
| --- | --- | --- |
| Analysis body dimmed to 55% opacity while re-running dropped secondary text below 4.5:1 (axe, real browser) | 1.4.3 | Dimming removed; the analyzing banner, `aria-busy` and the paused DecisionBar convey the state |
| Banner `div` carried `aria-labelledby` without a role | 4.1.2 | `role="group"` |
| Demo-control dashed border 2.96:1 against the canvas top | 1.4.11 | Uses `--color-faint` (4.79:1) |
| Observed facts header named the NPS log even when it could not be read | 1.3.1 (accuracy of information) | Header lists only the sources that were read |

**Still requires manual testing:** how VoiceOver and NVDA read the analysis announcements alongside the DecisionBar's own status message (two polite regions can queue together); the acknowledge dialog's three-point explanation with a screen reader; the scenario switcher's `aria-pressed` buttons in each screen reader.

## Phase 6: Audit integrity

Method: `src/domain/audit.test.ts` (data integrity) and `src/screens/AuditIntegrity.test.tsx` (rendering, keyboard, axe), plus the Phase 3 and 5 browser audits, which include Audit states.

**Verified:**

- **Structure:** `h2` "Audit trail"; each decision is an `article` named by its recommendation (`h3`); frozen analysis uses `h4` and below. The list is an ordered list, newest first, and the intro text says so.
- **Decision vs system entry, without colour:** system lines carry a visible "Event" label and, when a person initiated them, the actor ("Dana (you)"). Decisions read time, actor, action, recommendation, confirmation and outcome as text.
- **Expand / collapse:** "View analysis at decision time" is a button with `aria-expanded` and `aria-controls`; Enter and Space toggle it; focus stays on it.
- **Read-only snapshot:** no buttons, radios, inputs, links, `tabindex` or `id` attributes inside it (tested). The only control is the entry's own toggle. Reading order follows the live analysis: summary, hypotheses, then the recommendation decided and the others at the time.
- **Tab label:** "Audit" when there are no decisions, "Audit · 1 decision" / "Audit · 2 decisions" otherwise. It never shows a bare number that could be read as the total of all entries, since the trail also contains events.
- **axe (jsdom):** empty Audit, one decision, expanded frozen analysis, Low-confidence Audit, Stale Audit with every system event type: 0 violations. **axe (Chromium):** Low-confidence and Stale Audit states: 0 violations.

**New text pairings:** the "Event" label and event message on the canvas (10.6:1) and the snapshot group labels (10.9:1); included in the 97-pair table.

**Still requires manual testing:** how screen readers announce long frozen snapshots (many cards in sequence), and whether the newest-first order is clear when navigating by list item.

## Phase 7: Final QA

Full results: [`QA-REPORT.md`](QA-REPORT.md). This section classifies what is and is not verified.

### Verified automatically

- 243 unit, component and integration tests, including 33 axe assertions in jsdom (Dashboard, Incident Detail, all signature components, dialogs, scenario states, Audit states).
- Token contrast: 97 of 97 pairs (no new pairs in Phase 7).
- axe-core in Chromium with colour contrast enabled: 0 violations across 26 states (Incident Detail 8, Dashboard 5, scenarios and Audit 13).
- Gate rules, audit integrity, immutability, flags and chronology (unit tests).

### Verified in the browser (scripted Chromium sessions)

- Complete workflows by pointer and by keyboard only from page load: Base (Dashboard → incident → trace → approve → Audit → Dashboard), Low confidence (verify, dismiss, escalate; blocked approve writes nothing), Stale (arrival, acknowledge, re-run, approve; identical transcripts across two runs).
- Focus not obscured (2.4.11): every Tab stop in 29 states (594 stops), hit-tested against what is actually painted, at 1024, 1280, 1440 and the 200% zoom equivalents: 0 obscured, 0 without a visible outline.
- Focus visible (2.4.7), keyboard (2.1.1), no keyboard trap (2.1.2), focus order (2.4.3), page titled (2.4.2, fixed in Phase 7).
- Responsive and zoom: no horizontal overflow, no control outside the viewport, no clipped text, dialogs fit, the dock never overlaps the scroll area.
- Reduced motion: transitions and animations ≈ 0; Show source scrolls instantly; timers still work.
- Runtime: 0 console messages in production and development builds (no React, key, prop or ARIA warnings); all routes load and survive reload.

### Requires real assistive-technology testing

- VoiceOver + Safari and NVDA + Firefox/Chrome, using the checklist in `QA-REPORT.md`: provenance announcements, the evidence → source → return flow, blocked-action reasons, stale-state announcement, DecisionBar status, dialogs, Audit chronology, long frozen snapshots.
- Interaction of the two polite live regions.
- Forced-colours / Windows High Contrast.
- Real browser zoom at 200% and 400%, and text-spacing overrides (1.4.12).
- Firefox and Safari rendering.

### Outside prototype scope

- Designed layouts below 1024 CSS px, including 1.4.10 reflow at 320 CSS px (a basic fallback exists).
- Touch, pointer gestures and speech input.
- Persistence, authentication and real integrations.

---

### Reproducing this audit

```bash
npm test                                   # unit, component and axe tests
python3 scripts/contrast-audit.py          # token contrast (exit 1 on any failure)
npm run build && npx vite preview --port 4173 &
python3 scripts/a11y-browser-audit.py http://localhost:4173     # Incident Detail; needs Python Playwright + Chromium
python3 scripts/a11y-dashboard-audit.py http://localhost:4173   # Operations Dashboard
python3 scripts/a11y-scenarios-audit.py http://localhost:4173   # Low-confidence and Stale scenarios
python3 scripts/qa-browser.py http://localhost:4173            # Phase 7 workflows, focus sweep, responsive, zoom, motion, runtime
```
