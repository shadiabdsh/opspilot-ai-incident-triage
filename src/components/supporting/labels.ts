/** Labels for generic, non-AI UI. */
import type { IncidentStatus, Severity, System } from '../../domain/types';

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  info: 'Info',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  decided: 'Decided',
  escalated: 'Escalated',
};

export const SYSTEM_KIND_LABELS: Record<System['kind'], string> = {
  workstation: 'Workstation',
  auth_server: 'Auth server (NPS)',
  printer: 'Printer',
  switch: 'Core switch',
};

export const SYSTEM_STATE_LABELS: Record<System['state'], string> = {
  online: 'Online',
  offline: 'Offline',
  degraded: 'Degraded',
};
