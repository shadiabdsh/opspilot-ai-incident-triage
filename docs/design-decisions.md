# Design decisions

A short log of the decisions that shape OpsPilot: what was chosen, what else was considered, and why. Product decisions come from the spec and UX blueprint; implementation decisions from the implementation plan.

| Decision | Alternatives considered | Why |
| --- | --- | --- |
| **Facts and AI in separate landmark regions** | One feed mixing facts and AI cards; AI as a side drawer | Provenance should be structural, not only a label. A drawer hides AI reasoning behind a click; a mixed feed blurs what was observed. |
| **Provenance as a visual channel separate from severity** | Reusing severity colours for AI states | Severity says how bad; provenance says how we know. Mixing them would make an AI inference look like an alarm. |
| **Categorical confidence with a reason** | Percentages; no confidence shown | Percentages imply precision a pre-authored or generated number does not have. Hiding confidence breaks the "never hide uncertainty" rule. |
| **Typed confirmation for consequential actions** | Simple confirm dialog; two-person approval | A typed system name forces a moment of attention without needing a second user, which the prototype does not model. |
| **Acknowledging stale analysis reopens only low-risk actions** | Acknowledge unlocks everything | A consequential change based on analysis that has not seen the latest events is exactly the failure the product exists to prevent. |
| **One scroll area above a reserved decision dock** | Sticky bar overlaying content; independently scrolling columns | A sticky overlay hid hypothesis and evidence text at 1024 px and could cover focused controls (WCAG 2.4.11). The workspace is one scroll area; the DecisionBar lives in a reserved zone below it. Columns never scroll on their own. |
| **Header scrolls away on short viewports** | Always-sticky header | At 200% zoom a pinned header plus the dock left too little reading space. Below 760 px of height the header scrolls with the page. |
| **Observed facts sticky only when it fits** | Always sticky; never sticky | Keeps facts beside long AI content without ever creating a scroll trap. With the current data the panel is taller than the viewport, so it scrolls normally. |
| **Compact unselected recommendations** | Every card fully expanded | The selected card shows everything; others show title, tier, status and a one-line rationale, with Show details. Nothing is removed. |
| **Routine timeline events quieter, never hidden** | Collapsing repetitive events | Keeps the complete evidence base while letting the events the AI cites lead. |
| **Focus as a real outline; white on the dark dock** | Box-shadow ring | Outlines are not clipped by rounded containers, render on native radios and survive forced colours; white stays distinct from the cyan Approve. |
| **Dashboard grouping preview shows 4 of 12 alerts** | Expanding all 12 inline | Lets the user check the AI's grouping against raw alerts without the queue growing by twelve rows. |
| **Dashboard: queue as one table, title is the only link** | A card per incident; whole-row click targets | Rows scan faster and stay lighter than Incident Detail. A single link per row avoids ambiguous targets and keeps keyboard order predictable. |
| **Site health says "No known issues", not "Healthy"** | "Healthy" or "OK" | The prototype has no telemetry for the other sites, so claiming health would fabricate information. |
| **Return-state highlight is cyan, not amber** | Amber highlight | Amber is reserved for the evidence trace. The highlight is brief and non-essential; the status text and a polite announcement carry the change. |
| **Loading and empty states behind a development switch** | Artificial loading delay on every visit | The data is local and deterministic; adding fake latency would slow every demo. `?demo=loading` and `?demo=empty` exist only in development builds. |
| **Scenario switcher only on Incident Detail, as buttons** | A `<select>`; a global control on every screen | The Dashboard stays unchanged as approved. Buttons with `aria-pressed` make switching an explicit act; arrowing through a native select can change it on every key press and reset the incident each time. |
| **Missing source stated in Observed facts** | Only an Unknown in the AI region | "We do not have this evidence" is a fact about data availability, not an AI conclusion; the AI region still lists its own Unknown. |
| **No dimming while re-running** | Fade the analysis to show it is busy | Dimming text fails contrast. The analyzing banner, `aria-busy` and the paused DecisionBar convey the state. |
| **Events-arrived line in the audit** | Only re-run and acknowledge lines | Lets a reviewer see exactly which analysis was current when each later decision was made. |
| **Escalation pre-fills Identity & Access** | Empty team field | The team that owns NPS is the likely destination; it remains editable and required. |
| **Pre-authored AI output** | Live model calls | Deterministic demos and tests, and no risk of the prototype inventing facts. The UI labels output as pre-authored. |
| **Plain CSS tokens and CSS Modules** | A CSS framework or styled component library | Tokens map one-to-one to the spec; signature components get their own identity instead of a library's look. |
| **One reducer and two small contexts** | A state library | Small enough to read in one sitting, and easy to test without rendering. |

## Visual direction (v2)

Dark navy navigation and decision surface, a bright cool workspace, a pale cyan AI region, amber only for the active evidence trace, coral only for critical severity and consequential risk. Token values are verified for contrast by `scripts/contrast-audit.py`; see `ACCESSIBILITY-AUDIT.md`.

## Visual direction (v1, superseded)

- **Palette:** cool neutral page (`#f4f6f8`) with near-black ink for facts; **petrol** (`#0e6b73`) reserved for AI inference; a **highlighter yellow** (`#fff1a8`) for the evidence trace, like marking a printed log; severity colours only inside severity badges.
- **Type:** IBM Plex Sans for the interface; IBM Plex Mono only for raw machine output (event messages), where the monospace face marks text as unedited source data.
- **Restraint:** the seven signature components get the accent, motion and richer states. Tables, shell and dialogs stay plain.
