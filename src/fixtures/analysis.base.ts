import { at } from '../domain/clock';
import type { AIAnalysis, Hypothesis } from '../domain/types';
import { BASE_EVENTS } from './events';
import { REC_BIND_AND_RESTART, REC_EXPIRY_MONITORING, REC_NOTIFY_USERS, REC_VERIFY_CHAIN } from './recommendations';

export const HYPOTHESIS_CERT_HIGH: Hypothesis = {
  id: 'hyp-cert',
  rank: 'primary',
  cause: {
    text: 'The expired RADIUS server certificate on nps-bldga-01 is blocking 802.1X authentication for the Building A workstations.',
    provenance: 'inferred',
    evidenceEventIds: ['ev-cert-expired', 'ev-nps-failures-12'],
  },
  confidence: 'high',
  confidenceReason:
    'Authentication logs tie the expired certificate to failures on all 12 workstations, and nothing observed contradicts it.',
  supporting: ['ev-cert-expired', 'ev-nps-first-failure', 'ev-nps-failures-12', 'ev-offline-ws-a-001'],
  counter: [
    {
      eventId: 'ev-printer-online',
      explanation: {
        text: 'prn-a-03 stayed online because it authenticates by MAC address bypass, which does not use the certificate.',
        provenance: 'inferred',
        evidenceEventIds: ['ev-printer-online'],
      },
    },
    {
      eventId: 'ev-switch-healthy',
      explanation: {
        text: 'The core switch reports every port up, which makes a network hardware fault unlikely.',
        provenance: 'inferred',
        evidenceEventIds: ['ev-switch-healthy'],
      },
    },
  ],
  unknowns: [],
};

export const ANALYSIS_BASE: AIAnalysis = {
  id: 'analysis-base',
  incidentId: 'INC-2041',
  generatedAt: at('06:11:00'),
  basedOnEventIds: BASE_EVENTS.map((e) => e.id),
  modelVersion: 'demo-fixture-v1',
  summary: [
    {
      text: '12 Building A workstations went offline between 06:01 and 06:09.',
      provenance: 'observed',
      evidenceEventIds: ['ev-offline-ws-a-001', 'ev-offline-ws-a-012'],
    },
    {
      text: 'The RADIUS server certificate on nps-bldga-01 expired at 06:00.',
      provenance: 'observed',
      evidenceEventIds: ['ev-cert-expired'],
    },
    {
      text: 'The outages are likely caused by the expired certificate, which blocks 802.1X network authentication.',
      provenance: 'inferred',
      evidenceEventIds: ['ev-cert-expired', 'ev-nps-failures-12'],
    },
  ],
  hypotheses: [HYPOTHESIS_CERT_HIGH],
  recommendations: [REC_BIND_AND_RESTART, REC_VERIFY_CHAIN, REC_NOTIFY_USERS, REC_EXPIRY_MONITORING],
  dataSources: [
    { source: 'monitoring', label: 'Endpoint monitoring', status: 'checked' },
    { source: 'nps_log', label: 'NPS event log', status: 'checked' },
    { source: 'cert_inventory', label: 'Certificate inventory', status: 'checked' },
    { source: 'switch', label: 'Switch telemetry', status: 'checked' },
  ],
};
