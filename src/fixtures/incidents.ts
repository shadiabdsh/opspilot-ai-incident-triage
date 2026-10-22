import { at } from '../domain/clock';
import type { Incident } from '../domain/types';
import { WORKSTATION_IDS } from './systems';

export const SCRIPTED_INCIDENT_ID = 'INC-2041';

export const INCIDENTS: Incident[] = [
  {
    id: SCRIPTED_INCIDENT_ID,
    title: '12 endpoints offline in Building A',
    severity: 'critical',
    siteId: 'bldg-a',
    openedAt: at('06:10:00'),
    affectedSystemIds: [...WORKSTATION_IDS],
    affectedCount: 12,
    groupedAlertCount: 12,
    initialStatus: 'open',
  },
  // Background incidents give the queue realistic context. They are not interactive.
  {
    id: 'INC-2039',
    title: 'Nightly backup job failed: crm-db',
    severity: 'major',
    siteId: 'dc-1',
    openedAt: at('03:42:00'),
    affectedSystemIds: [],
    affectedCount: 1,
    initialStatus: 'in_review',
  },
  {
    id: 'INC-2040',
    title: 'Elevated latency on VPN gateway',
    severity: 'minor',
    siteId: 'dc-1',
    openedAt: at('05:31:00'),
    affectedSystemIds: [],
    affectedCount: 1,
    initialStatus: 'open',
  },
  {
    id: 'INC-2037',
    title: 'Print queue stalled on floor 2',
    severity: 'minor',
    siteId: 'bldg-c',
    openedAt: at('02:15:00'),
    affectedSystemIds: [],
    affectedCount: 1,
    initialStatus: 'in_review',
  },
  {
    id: 'INC-2036',
    title: 'Certificate expires in 14 days: mail-gw-01',
    severity: 'info',
    siteId: 'dc-1',
    openedAt: at('00:05:00'),
    affectedSystemIds: [],
    affectedCount: 1,
    initialStatus: 'open',
  },
];
