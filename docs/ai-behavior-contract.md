# AI behaviour contract

OpsPilot's AI drafts, explains and recommends. It never executes, and every statement it makes is labelled as observed, inferred or unknown. This document is the contract the UI and code are held to. Where a rule is enforced in code, the file is named.

## Provenance

| Label | Meaning | Example | Rule |
| --- | --- | --- | --- |
| **Observed** | A fact read directly from a source system | "The certificate on nps-bldga-01 expired at 06:00." | Links to the event it came from |
| **Inferred** | The AI's conclusion from observed facts | "The outages are likely caused by the expired certificate." | Must cite at least one event (`fixtures.test.ts`, check 2) |
| **Unknown** | Something relevant the AI could not determine | "Whether workstations are failing authentication." | Must give a reason (`fixtures.test.ts`, check 2) |

Observed facts never appear in the AI region as plain prose: a fact the AI relies on is always shown as an evidence item that links to its source.

## Confidence

Categorical bands, each with a one-line reason that is always visible.

| Band | Criteria | What it allows |
| --- | --- | --- |
| High | Direct evidence links the cause to every affected system; no unexplained counter-evidence | Consequential actions, with typed confirmation |
| Medium | Strong correlation, but at least one link is indirect or a source is missing | Consequential actions, with typed confirmation and a warning |
| Low | Correlation only, or a competing hypothesis is comparably supported | No consequential actions; verify, dismiss or escalate |

## Risk tiers

| Tier | Example | Confirmation |
| --- | --- | --- |
| Read-only | Check the NPS event log | Single click |
| Low impact | Notify Building A users | Single click |
| Consequential | Bind the renewed certificate and restart NPS | Dialog restating action, impact and rollback; user types the target system name |

## The gate (`src/domain/gate.ts`)

One function decides availability for every action. Approve and Modify:

| Analysis status | Confidence | Read-only / Low impact | Consequential |
| --- | --- | --- | --- |
| Analyzing | any | Blocked: waiting for analysis | Blocked: waiting for analysis |
| Ready | High | Allowed | Allowed, typed confirmation |
| Ready | Medium | Allowed | Allowed, typed confirmation and warning |
| Ready | Low | Allowed | Blocked: verify the cause first |
| Stale | any | Blocked: re-run, or acknowledge to continue with low-risk actions | Blocked: re-run required |
| Acknowledged | any | Allowed, flagged in the audit entry | Blocked: re-run required |

Dismiss and Escalate are allowed in every status except Analyzing. Decided recommendations allow nothing. An escalated incident blocks further Approve and Modify, because the receiving team owns changes.

When several reasons apply, the most actionable one is shown: already decided → incident escalated → analyzing → stale → acknowledged and consequential → low confidence.

## Rules the AI output must follow

1. Cite at least one observed event for every inference; an inference with no evidence is not shown.
2. Show counter-evidence and unexplained observations, never only supporting ones.
3. Name every data source tried and its status (checked, unavailable, not applicable).
4. Never invent values: missing values render as Unknown with a reason.
5. Record the analysis time and the events it was based on, so staleness is detectable.
6. Offer an alternative hypothesis whenever confidence is below High.
7. Never take an action or imply one was taken. Approval creates a mock change request, and the UI says so.
8. Treat a rejection or modification as final for that recommendation.

## Audit

The audit trail is append-only and newest first. It answers: *what existed when this decision was made?*

**Decision entries** (`src/domain/reducer.ts`, `submitDecision`) record, in the same step as the status change:

| Field | Content |
| --- | --- |
| Who, when, what | actor, logical timestamp, action (approve, modify, dismiss, escalate), recommendation |
| How it was confirmed | `typed_target` (typed the system name), `single_confirm`, `reason`, or `team_and_note` |
| Risk | the recommendation's risk tier |
| Action data | Modify: original and modified parameters; Dismiss: reason, including "Other: …"; Escalate: team and note |
| Flags | `acknowledged_stale` only on an Approve or Modify made after acknowledging stale analysis, never on Dismiss or Escalate; `modified_from_original` only on Modify |
| Outcome | the mock change request, task or "no action taken" |
| Frozen record | a deep copy of the analysis (version, time, summary, hypotheses, evidence, counter-evidence, unknowns, sources); the analysis status at decision time; every recommendation's status at decision time; every event present at decision time |

Because events are frozen with the entry, the snapshot renders entirely from the record; later state changes cannot alter it (tested in `src/domain/audit.test.ts`).

**System entries** record what changed around decisions, each with a machine-readable `event` and, when a person initiated it, an actor: `scenario_changed`, `events_arrived`, `analysis_rerun`, `analysis_updated`, `stale_acknowledged`.

**Never written:** a blocked action. The reducer re-runs `gate()` on submit, so even a forged draft for a blocked consequential action is refused.
