import { at } from '../domain/clock';
import type { OpsEvent } from '../domain/types';
import { WORKSTATION_IDS, WORKSTATION_OFFLINE_TIMES } from './systems';

/**
 * Raw events as the source systems reported them. Messages are written to look like
 * real tool output and are never edited by the AI layer.
 */

export const CERT_EXPIRED: OpsEvent = {
  id: 'ev-cert-expired',
  timestamp: at('06:00:00'),
  source: 'cert_inventory',
  systemId: 'nps-bldga-01',
  message: 'Certificate CN=nps-bldga-01.corp.example expired (NotAfter 2026-10-20 06:00:00 UTC)',
  severity: 'critical',
};

export const CERT_RENEWAL_AVAILABLE: OpsEvent = {
  id: 'ev-cert-renewed',
  timestamp: at('06:00:30'),
  source: 'cert_inventory',
  systemId: 'nps-bldga-01',
  message: 'Renewed certificate CN=nps-bldga-01.corp.example issued 2026-10-06, status: not bound',
  severity: 'info',
};

/** NPS authentication log events. Absent in the low-confidence scenario. */
export const NPS_EVENTS: OpsEvent[] = [
  {
    id: 'ev-nps-first-failure',
    timestamp: at('06:01:04'),
    source: 'nps_log',
    systemId: 'nps-bldga-01',
    message: 'EAP-TLS handshake failed for client ws-a-001: server certificate expired',
    severity: 'major',
  },
  {
    id: 'ev-nps-failures-7',
    timestamp: at('06:04:30'),
    source: 'nps_log',
    systemId: 'nps-bldga-01',
    message: 'EAP-TLS handshake failures: 7 distinct clients since 06:01, reason: server certificate expired',
    severity: 'major',
  },
  {
    id: 'ev-nps-failures-12',
    timestamp: at('06:08:50'),
    source: 'nps_log',
    systemId: 'nps-bldga-01',
    message: 'EAP-TLS handshake failures: 12 distinct clients since 06:01, reason: server certificate expired',
    severity: 'major',
  },
];

export const WORKSTATION_OFFLINE_EVENTS: OpsEvent[] = WORKSTATION_OFFLINE_TIMES.map((time, i) => ({
  id: `ev-offline-${WORKSTATION_IDS[i]}`,
  timestamp: at(time),
  source: 'monitoring',
  systemId: WORKSTATION_IDS[i] as string,
  message: 'Host unreachable (ICMP, 3 consecutive checks failed)',
  severity: 'major',
}));

export const SWITCH_HEALTHY: OpsEvent = {
  id: 'ev-switch-healthy',
  timestamp: at('06:05:00'),
  source: 'switch',
  systemId: 'sw-a-core-01',
  message: 'Interface summary: 48/48 ports up, 0 errors in last 15 min',
  severity: 'info',
};

export const PRINTER_ONLINE: OpsEvent = {
  id: 'ev-printer-online',
  timestamp: at('06:07:00'),
  source: 'monitoring',
  systemId: 'prn-a-03',
  message: 'Host reachable (MAB session active)',
  severity: 'info',
};

/** Events that arrive after the 06:11 analysis in the stale scenario. */
export const LATE_EVENTS: OpsEvent[] = [
  {
    id: 'ev-late-helpdesk',
    timestamp: at('06:13:20'),
    source: 'helpdesk',
    systemId: 'ws-a-005',
    message: 'Ticket HD-8812 opened: "Cannot connect to the network", Building A, floor 3',
    severity: 'minor',
  },
  {
    id: 'ev-late-nps-retry',
    timestamp: at('06:14:05'),
    source: 'nps_log',
    systemId: 'nps-bldga-01',
    message: 'EAP-TLS handshake failed for client ws-a-007 (retry): server certificate expired',
    severity: 'major',
  },
  {
    id: 'ev-late-offline-recheck',
    timestamp: at('06:15:10'),
    source: 'monitoring',
    systemId: 'ws-a-003',
    message: 'Host unreachable (ICMP, 3 consecutive checks failed), recheck',
    severity: 'major',
  },
];

const byTime = (a: OpsEvent, b: OpsEvent) => a.timestamp.localeCompare(b.timestamp);

/** All events present in the base scenario, oldest first. */
export const BASE_EVENTS: OpsEvent[] = [
  CERT_EXPIRED,
  CERT_RENEWAL_AVAILABLE,
  ...NPS_EVENTS,
  ...WORKSTATION_OFFLINE_EVENTS,
  SWITCH_HEALTHY,
  PRINTER_ONLINE,
].sort(byTime);

/** Low-confidence scenario: the NPS event log could not be retrieved. */
export const LOW_EVENTS: OpsEvent[] = BASE_EVENTS.filter((e) => e.source !== 'nps_log');

export const ALL_EVENTS: OpsEvent[] = [...BASE_EVENTS, ...LATE_EVENTS].sort(byTime);

export const sortEvents = (events: OpsEvent[]) => [...events].sort(byTime);
