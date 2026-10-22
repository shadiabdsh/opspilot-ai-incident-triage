import { at } from '../domain/clock';
import type { AIAnalysis } from '../domain/types';
import { LOW_EVENTS } from './events';
import { REC_BIND_AND_RESTART, REC_CHECK_NPS_LOG, REC_EXPIRY_MONITORING, REC_NOTIFY_USERS } from './recommendations';

/** Low-confidence scenario: NPS logs unavailable, two comparably weak hypotheses. */
export const ANALYSIS_LOW: AIAnalysis = {
  id: 'analysis-low',
  incidentId: 'INC-2041',
  generatedAt: at('06:11:00'),
  basedOnEventIds: LOW_EVENTS.map((e) => e.id),
  modelVersion: 'demo-fixture-v1-low',
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
      text: 'The expired certificate may be the cause, but without authentication logs this cannot be confirmed.',
      provenance: 'inferred',
      evidenceEventIds: ['ev-cert-expired', 'ev-offline-ws-a-001'],
    },
  ],
  hypotheses: [
    {
      id: 'hyp-cert',
      rank: 'primary',
      cause: {
        text: 'The expired RADIUS server certificate on nps-bldga-01 may be blocking 802.1X authentication.',
        provenance: 'inferred',
        evidenceEventIds: ['ev-cert-expired', 'ev-offline-ws-a-001'],
      },
      confidence: 'low',
      confidenceReason:
        'The certificate expired one minute before the first outage, but without NPS logs the link to the failures is timing only.',
      supporting: ['ev-cert-expired', 'ev-offline-ws-a-001', 'ev-offline-ws-a-012'],
      counter: [
        {
          eventId: 'ev-printer-online',
          explanation: {
            text: 'prn-a-03 stayed online; it authenticates by MAC address bypass, so this fits the certificate explanation but does not prove it.',
            provenance: 'inferred',
            evidenceEventIds: ['ev-printer-online'],
          },
        },
      ],
      unknowns: [
        {
          text: 'Whether the workstations are failing authentication',
          provenance: 'unknown',
          evidenceEventIds: [],
          unknownReason: 'The NPS event log could not be retrieved for this analysis.',
        },
      ],
    },
    {
      id: 'hyp-access-switch',
      rank: 'alternative',
      cause: {
        text: 'A fault in the Building A access network may have disconnected the workstations.',
        provenance: 'inferred',
        evidenceEventIds: ['ev-offline-ws-a-001', 'ev-offline-ws-a-012'],
      },
      confidence: 'low',
      confidenceReason:
        'All affected workstations are in one building and failed within 8 minutes, but the core switch reports healthy.',
      supporting: ['ev-offline-ws-a-001', 'ev-offline-ws-a-012'],
      counter: [
        {
          eventId: 'ev-switch-healthy',
          explanation: {
            text: 'The core switch reports every port up, which argues against a network fault.',
            provenance: 'inferred',
            evidenceEventIds: ['ev-switch-healthy'],
          },
        },
        {
          eventId: 'ev-printer-online',
          explanation: {
            text: 'prn-a-03 on the same network stayed reachable, which argues against a network fault.',
            provenance: 'inferred',
            evidenceEventIds: ['ev-printer-online'],
          },
        },
      ],
      unknowns: [
        {
          text: 'Access-switch port status',
          provenance: 'unknown',
          evidenceEventIds: [],
          unknownReason: 'Access-layer switch telemetry was not collected for this analysis.',
        },
      ],
    },
  ],
  recommendations: [REC_CHECK_NPS_LOG, REC_BIND_AND_RESTART, REC_NOTIFY_USERS, REC_EXPIRY_MONITORING],
  dataSources: [
    { source: 'monitoring', label: 'Endpoint monitoring', status: 'checked' },
    { source: 'nps_log', label: 'NPS event log', status: 'unavailable', note: 'Not retrieved' },
    { source: 'cert_inventory', label: 'Certificate inventory', status: 'checked' },
    { source: 'switch', label: 'Switch telemetry', status: 'checked', note: 'Core switch only' },
  ],
};
