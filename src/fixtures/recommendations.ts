import type { Recommendation } from '../domain/types';

/**
 * Recommendations shared across analyses. Ids stay the same across a re-run, so a
 * decision made before re-running analysis is still attached to the same card after.
 */

export const REC_BIND_AND_RESTART: Recommendation = {
  id: 'rec-bind-restart',
  title: 'Bind the renewed certificate to NPS and restart the service',
  rationale: {
    text: 'Restoring a valid server certificate should let the workstations complete 802.1X authentication again.',
    provenance: 'inferred',
    evidenceEventIds: ['ev-cert-expired', 'ev-cert-renewed'],
  },
  riskTier: 'consequential',
  reversible: true,
  impact: '802.1X authentication for all of Building A pauses briefly while the NPS service restarts.',
  rollback: 'Rebind the previous certificate binding and restart NPS.',
  params: {
    Certificate: 'CN=nps-bldga-01.corp.example (renewed 2026-10-06)',
    'Restart window': 'Now',
  },
  confirmText: 'nps-bldga-01',
  requiresHypothesisId: 'hyp-cert',
};

export const REC_VERIFY_CHAIN: Recommendation = {
  id: 'rec-verify-chain',
  title: 'Verify the renewed certificate chain before binding',
  rationale: {
    text: 'A complete, trusted chain avoids a second authentication failure after binding.',
    provenance: 'inferred',
    evidenceEventIds: ['ev-cert-renewed'],
  },
  riskTier: 'read_only',
  reversible: true,
  impact: 'None. Reads certificate details only.',
  params: {},
  requiresHypothesisId: 'hyp-cert',
};

export const REC_CHECK_NPS_LOG: Recommendation = {
  id: 'rec-check-nps-log',
  title: 'Check the NPS event log directly on nps-bldga-01',
  rationale: {
    text: 'Authentication logs would confirm or rule out the expired certificate as the cause.',
    provenance: 'inferred',
    evidenceEventIds: ['ev-cert-expired'],
  },
  riskTier: 'read_only',
  reversible: true,
  impact: 'None. Reads logs only.',
  params: {},
  requiresHypothesisId: 'hyp-cert',
};

export const REC_NOTIFY_USERS: Recommendation = {
  id: 'rec-notify-users',
  title: 'Notify Building A users about the network outage',
  rationale: {
    text: 'Affected users are already reporting the problem; a notice reduces duplicate tickets while the fix is applied.',
    provenance: 'inferred',
    evidenceEventIds: ['ev-offline-ws-a-001', 'ev-offline-ws-a-012'],
  },
  riskTier: 'low_impact',
  reversible: false,
  impact: 'Sends one message to Building A staff.',
  params: { Audience: 'Building A staff', Channel: 'Email and Teams' },
  requiresHypothesisId: 'hyp-cert',
};

export const REC_EXPIRY_MONITORING: Recommendation = {
  id: 'rec-expiry-monitoring',
  title: 'Create a follow-up task: monitor certificate expiry on NPS servers',
  rationale: {
    text: 'The certificate expired while a renewed one was available but unbound, so earlier warning could have prevented the outage.',
    provenance: 'inferred',
    evidenceEventIds: ['ev-cert-expired', 'ev-cert-renewed'],
  },
  riskTier: 'low_impact',
  reversible: true,
  impact: 'Creates one task in the operations backlog.',
  params: { Assignee: 'Identity & Access' },
  requiresHypothesisId: 'hyp-cert',
};
