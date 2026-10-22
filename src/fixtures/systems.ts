import { at } from '../domain/clock';
import type { System } from '../domain/types';

/** Times each Building A workstation dropped offline (UTC, incident day). */
export const WORKSTATION_OFFLINE_TIMES = [
  '06:01:12', '06:01:48', '06:02:30', '06:03:05', '06:03:51', '06:04:40',
  '06:05:22', '06:06:10', '06:06:58', '06:07:45', '06:08:20', '06:09:05',
] as const;

export const WORKSTATION_IDS = WORKSTATION_OFFLINE_TIMES.map(
  (_, i) => `ws-a-${String(i + 1).padStart(3, '0')}`,
);

const workstations: System[] = WORKSTATION_OFFLINE_TIMES.map((time, i) => ({
  id: WORKSTATION_IDS[i] as string,
  name: `Workstation A-${String(i + 1).padStart(3, '0')}`,
  kind: 'workstation',
  siteId: 'bldg-a',
  state: 'offline',
  lastSeen: at(time),
  authMethod: '802.1x',
}));

export const SYSTEMS: System[] = [
  ...workstations,
  {
    id: 'nps-bldga-01',
    name: 'NPS authentication server',
    kind: 'auth_server',
    siteId: 'bldg-a',
    state: 'online',
    lastSeen: at('06:12:00'),
  },
  {
    id: 'prn-a-03',
    name: 'Printer A-03',
    kind: 'printer',
    siteId: 'bldg-a',
    state: 'online',
    lastSeen: at('06:12:00'),
    authMethod: 'mab',
  },
  {
    id: 'sw-a-core-01',
    name: 'Core switch A-01',
    kind: 'switch',
    siteId: 'bldg-a',
    state: 'online',
    lastSeen: at('06:12:00'),
  },
];
