import { at } from '../domain/clock';
import type { AIAnalysis } from '../domain/types';
import { ANALYSIS_BASE, HYPOTHESIS_CERT_HIGH } from './analysis.base';
import { ALL_EVENTS } from './events';

/**
 * The analysis after the user re-runs it in the stale scenario. It now accounts for the
 * three late events. The conclusion is unchanged and still High; the point of the
 * scenario is that the user could not know that without re-running.
 */
export const ANALYSIS_STALE_V2: AIAnalysis = {
  ...ANALYSIS_BASE,
  id: 'analysis-stale-v2',
  generatedAt: at('06:16:00'),
  basedOnEventIds: ALL_EVENTS.map((e) => e.id),
  modelVersion: 'demo-fixture-v2',
  summary: [
    {
      text: '12 Building A workstations went offline between 06:01 and 06:09, and are still unreachable at 06:15.',
      provenance: 'observed',
      evidenceEventIds: ['ev-offline-ws-a-001', 'ev-offline-ws-a-012', 'ev-late-offline-recheck'],
    },
    {
      text: 'The RADIUS server certificate on nps-bldga-01 expired at 06:00, and authentication is still failing at 06:14.',
      provenance: 'observed',
      evidenceEventIds: ['ev-cert-expired', 'ev-late-nps-retry'],
    },
    {
      text: 'The new events are consistent with the earlier conclusion: the expired certificate is the likely cause.',
      provenance: 'inferred',
      evidenceEventIds: ['ev-late-nps-retry', 'ev-late-helpdesk'],
    },
  ],
  hypotheses: [
    {
      ...HYPOTHESIS_CERT_HIGH,
      supporting: [...HYPOTHESIS_CERT_HIGH.supporting, 'ev-late-nps-retry'],
    },
  ],
};
