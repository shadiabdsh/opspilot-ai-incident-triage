import type { RefObject } from 'react';
import type { AIAnalysis, OpsEvent } from '../../domain/types';
import { SYSTEMS, WORKSTATION_IDS } from '../../fixtures/systems';
import { EyeIcon } from '../../components/signature/shared/icons';
import { AffectedSystemsTable } from '../../components/supporting/AffectedSystemsTable/AffectedSystemsTable';
import { EventTimeline } from '../../components/supporting/EventTimeline/EventTimeline';
import { SourceAvailability } from '../../components/supporting/SourceAvailability/SourceAvailability';
import styles from '../IncidentDetailScreen.module.css';

const workstationSet = new Set(WORKSTATION_IDS);
const groupSystems = SYSTEMS.filter((system) => workstationSet.has(system.id));
const relatedSystems = SYSTEMS.filter((system) => !workstationSet.has(system.id));

function factsSourceLine(sources: AIAnalysis['dataSources']): string {
  const unreadable = sources.some((source) => source.status === 'unavailable');
  if (!unreadable) {
    return 'Raw records from monitoring, the NPS log, certificate inventory and switch telemetry.';
  }

  const read = sources.filter((source) => source.status === 'checked').map((source) => source.label.toLowerCase());
  const list = read.length > 1 ? `${read.slice(0, -1).join(', ')} and ${read.at(-1)}` : (read[0] ?? 'no source');
  return `Raw records from the sources that could be read: ${list}.`;
}

interface ObservedFactsPanelProps {
  analysis: AIAnalysis;
  events: OpsEvent[];
  citationCounts: Record<string, number>;
  newSinceIds: Set<string>;
  groupExpanded: boolean;
  onToggleGroup: () => void;
  onBackToEvidence: () => void;
  factsRef: RefObject<HTMLElement>;
  factsSticky: boolean;
}

export function ObservedFactsPanel({
  analysis,
  events,
  citationCounts,
  newSinceIds,
  groupExpanded,
  onToggleGroup,
  onBackToEvidence,
  factsRef,
  factsSticky,
}: ObservedFactsPanelProps) {
  return (
    <section ref={factsRef} className={styles.facts} data-sticky={factsSticky || undefined} aria-labelledby="facts-heading">
      <header className={styles.regionHeader}>
        <h2 id="facts-heading" className={styles.regionTitle}>
          <span className={styles.regionIcon} aria-hidden="true">
            <EyeIcon />
          </span>
          Observed facts
        </h2>
        <p className={styles.regionMeta}>{factsSourceLine(analysis.dataSources)}</p>
      </header>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Affected systems</h3>
        <AffectedSystemsTable
          group={{ label: 'Building A workstations', systems: groupSystems }}
          related={relatedSystems}
          groupExpanded={groupExpanded}
          onToggleGroup={onToggleGroup}
        />
      </div>

      <SourceAvailability sources={analysis.dataSources} />

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Event timeline</h3>
        <EventTimeline
          events={events}
          citedCounts={citationCounts}
          newSinceIds={newSinceIds}
          onBackToEvidence={onBackToEvidence}
        />
      </div>
    </section>
  );
}
