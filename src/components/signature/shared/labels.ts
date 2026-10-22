/** Human-readable labels shared by the signature components. Sentence case throughout. */
import type {
  Confidence,
  DataSourceCheck,
  DecisionAction,
  EventSource,
  RecommendationStatus,
  RiskTier,
} from '../../../domain/types';

export const SOURCE_LABELS: Record<EventSource | 'pki', string> = {
  monitoring: 'Monitoring',
  nps_log: 'NPS log',
  cert_inventory: 'Cert inventory',
  switch: 'Switch',
  helpdesk: 'Helpdesk',
  pki: 'PKI',
};

export const TIER_LABELS: Record<RiskTier, string> = {
  read_only: 'Read-only',
  low_impact: 'Low impact',
  consequential: 'Consequential',
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const STATUS_LABELS: Record<RecommendationStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  modified: 'Approved with changes',
  dismissed: 'Dismissed',
  escalated: 'Escalated',
};

export const ACTION_LABELS: Record<DecisionAction, string> = {
  approve: 'Approve',
  modify: 'Modify',
  dismiss: 'Dismiss',
  escalate: 'Escalate',
};

export const ACTION_PAST: Record<DecisionAction, string> = {
  approve: 'Approved',
  modify: 'Approved with changes',
  dismiss: 'Dismissed',
  escalate: 'Escalated',
};

export const ESCALATION_TEAMS = ['Identity & Access', 'Network Engineering', 'Service Desk'];

export function sourcesCheckedLine(sources: DataSourceCheck[]): string {
  const relevant = sources.filter((s) => s.status !== 'not_applicable');
  const checked = relevant.filter((s) => s.status === 'checked').length;
  const missing = relevant.filter((s) => s.status === 'unavailable').map((s) => s.label);
  const base = `Sources checked: ${checked} of ${relevant.length}.`;
  return missing.length ? `${base} Not retrieved: ${missing.join(', ')}.` : base;
}
