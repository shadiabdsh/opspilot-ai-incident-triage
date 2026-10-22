/**
 * Domain types for OpsPilot.
 *
 * These follow the data model in the Product & AI UX Spec ("Suggested data model"),
 * with the additions the UX Blueprint needs for analysis, recommendation and audit states.
 *
 * The key structural rule: observed records (System, OpsEvent) are facts.
 * AI output (AIAnalysis) may only *reference* them by id, so every inference
 * can be traced back to evidence.
 */

export type Severity = 'critical' | 'major' | 'minor' | 'info';
export type Provenance = 'observed' | 'inferred' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low';
export type RiskTier = 'read_only' | 'low_impact' | 'consequential';

export type ScenarioId = 'base' | 'low' | 'stale';

// ── Observed facts ──────────────────────────────────────────────────────────

export interface Site {
  id: string;
  name: string; // 'Building A'
}

export interface System {
  id: string; // 'ws-a-001', 'nps-bldga-01'
  name: string;
  kind: 'workstation' | 'auth_server' | 'printer' | 'switch';
  siteId: string;
  state: 'online' | 'offline' | 'degraded';
  lastSeen: string; // ISO timestamp
  authMethod?: '802.1x' | 'mab';
}

export type EventSource = 'monitoring' | 'nps_log' | 'cert_inventory' | 'switch' | 'helpdesk';

/** Named OpsEvent to avoid clashing with the DOM's Event type. */
export interface OpsEvent {
  id: string;
  timestamp: string; // ISO timestamp
  source: EventSource;
  systemId: string;
  message: string; // raw, as received; never AI-written
  severity: Severity;
}

export type IncidentStatus = 'open' | 'in_review' | 'decided' | 'escalated';

export interface Incident {
  id: string; // 'INC-2041'
  title: string;
  severity: Severity;
  siteId: string;
  openedAt: string;
  /** For the scripted incident these resolve to fixture systems. */
  affectedSystemIds: string[];
  /** Shown on the dashboard row; for background incidents this is the only count. */
  affectedCount: number;
  /** Number of raw alerts the AI grouped into this incident, if any. */
  groupedAlertCount?: number;
  initialStatus: IncidentStatus;
}

// ── AI output (references facts by id only) ─────────────────────────────────

export interface Statement {
  text: string;
  provenance: Provenance;
  /** Required non-empty for 'inferred'; may list sources for 'observed'. */
  evidenceEventIds: string[];
  /** Required for 'unknown'. */
  unknownReason?: string;
}

export interface CounterEvidence {
  eventId: string;
  /** Why this observation does or does not weaken the hypothesis. Always 'inferred'. */
  explanation: Statement;
}

export interface Hypothesis {
  id: string;
  cause: Statement; // provenance 'inferred'
  confidence: Confidence;
  confidenceReason: string;
  supporting: string[]; // event ids
  counter: CounterEvidence[]; // always present, may be empty
  unknowns: Statement[]; // provenance 'unknown'
  rank: 'primary' | 'alternative';
}

export interface Recommendation {
  id: string;
  title: string;
  rationale: Statement; // provenance 'inferred'
  riskTier: RiskTier;
  reversible: boolean;
  impact: string;
  rollback?: string;
  /** Editable parameters for Modify. */
  params: Record<string, string>;
  /** Text the user must type to approve a consequential action (usually the target system). */
  confirmText?: string;
  requiresHypothesisId: string;
}

export interface DataSourceCheck {
  source: EventSource | 'pki';
  label: string;
  status: 'checked' | 'unavailable' | 'not_applicable';
  note?: string;
}

export interface AIAnalysis {
  id: string;
  incidentId: string;
  generatedAt: string;
  /** Staleness = incident events that are not in this list. */
  basedOnEventIds: string[];
  /** 'demo-fixture-v1' etc. The UI labels all output as pre-authored. */
  modelVersion: string;
  summary: Statement[];
  hypotheses: Hypothesis[];
  recommendations: Recommendation[];
  dataSources: DataSourceCheck[];
}

// ── Workflow state (UX Blueprint, section 8) ────────────────────────────────

export type AnalysisStatus = 'analyzing' | 'ready' | 'stale' | 'acknowledged';

/** Stored status only. "Blocked" is never stored: gate() computes it. */
export type RecommendationStatus = 'pending' | 'approved' | 'modified' | 'dismissed' | 'escalated';

export type DecisionAction = 'approve' | 'modify' | 'dismiss' | 'escalate';

export interface DecisionInput {
  typedConfirmation?: string;
  reason?: string;
  team?: string;
  note?: string;
  modifiedParams?: Record<string, string>;
}

export type AuditFlag = 'acknowledged_stale' | 'modified_from_original';

/** How the person confirmed the decision. */
export type ConfirmationUsed = 'typed_target' | 'single_confirm' | 'reason' | 'team_and_note';

export interface DecisionAuditEntry {
  kind: 'decision';
  id: string;
  incidentId: string;
  at: string;
  actor: string;
  action: DecisionAction;
  recommendationId: string;
  recommendationTitle: string;
  reason?: string;
  escalatedTo?: string;
  originalParams?: Record<string, string>;
  modifiedParams?: Record<string, string>;
  flags: AuditFlag[];
  outcome: string;
  /** Risk tier of the action as decided (Modify keeps its tier in this prototype). */
  riskTier: RiskTier;
  /** What the person had to do to confirm (typed the target, single confirm, reason, team and note). */
  confirmation: ConfirmationUsed;
  /** Frozen copy of the analysis the decision was made against. */
  analysisSnapshot: AIAnalysis;
  /** Analysis status at decision time: 'ready' or 'acknowledged' (an allowed action on stale analysis). */
  analysisStatusAtDecision: AnalysisStatus;
  /** Every recommendation's status at decision time, including this decision's result. */
  recommendationStatesAtDecision: Record<string, RecommendationStatus>;
  /** Frozen copy of every event present at decision time, so evidence renders from the record itself. */
  eventsAtDecision: OpsEvent[];
}

export type SystemAuditEvent = 'scenario_changed' | 'events_arrived' | 'analysis_rerun' | 'analysis_updated' | 'stale_acknowledged';

export interface SystemAuditEntry {
  kind: 'system';
  id: string;
  incidentId: string;
  at: string;
  /** Machine-readable event type. */
  event: SystemAuditEvent;
  /** Who initiated it; absent for events the system observed (new events arriving, analysis ready). */
  actor?: string;
  message: string; // 'Analysis re-run', 'Scenario changed to Low confidence'
}

export type AuditEntry = DecisionAuditEntry | SystemAuditEntry;
