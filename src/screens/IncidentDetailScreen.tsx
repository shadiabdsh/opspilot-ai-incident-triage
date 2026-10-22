/**
 * Incident Detail (UX Blueprint, section 2).
 *
 * Two landmark regions keep provenance structural: Observed facts on the left contain only
 * raw records; AI assistance on the right contains everything the AI concluded. One page
 * scroll, a sticky incident header and a sticky DecisionBar. The trace runs
 * AI inference → EvidenceItem → timeline event → system row.
 */
import * as Tabs from '@radix-ui/react-tabs';
import { useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { decisionInputError, DEMO_ACTOR, findRecommendation, gateFor } from '../domain/reducer';
import {
  citedCounts,
  eventsById as indexEvents,
  newSinceAnalysisIds,
  sitesById,
  systemsById,
  timelineEvents,
} from '../domain/selectors';
import { INCIDENTS, SCRIPTED_INCIDENT_ID } from '../fixtures/incidents';
import { useStore } from '../state/StoreProvider';
import { useDockSlot } from '../state/DockSlot';
import { TraceProvider } from '../state/TraceProvider';
import { DecisionBar } from '../components/signature/DecisionBar/DecisionBar';
import { ACTION_PAST, ESCALATION_TEAMS } from '../components/signature/shared/labels';
import { IncidentHeader } from '../components/supporting/IncidentHeader/IncidentHeader';
import { ScenarioSwitcher } from '../components/supporting/ScenarioSwitcher/ScenarioSwitcher';
import { AuditTab } from './AuditTab';
import { AIAssistancePanel } from './incidentDetail/AIAssistancePanel';
import { ObservedFactsPanel } from './incidentDetail/ObservedFactsPanel';
import { useAnalysisStatusAnnouncement } from './incidentDetail/useAnalysisStatusAnnouncement';
import { useEvidenceNavigation } from './incidentDetail/useEvidenceNavigation';
import styles from './IncidentDetailScreen.module.css';

export function IncidentDetailScreen() {
  const { incidentId } = useParams();
  const { state, setScenario } = useStore();

  if (incidentId !== SCRIPTED_INCIDENT_ID) {
    return (
      <div className={styles.notFound}>
        <h1>Incident not available</h1>
        <p>
          This prototype scripts one incident. <Link to={`/incidents/${SCRIPTED_INCIDENT_ID}`}>Open {SCRIPTED_INCIDENT_ID}</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Outside the keyed view, so the pressed button keeps focus when the incident resets. */}
      <ScenarioSwitcher current={state.scenario} onChange={setScenario} />
      {/* A new scenario remounts the view: local UI state (trace, disclosures) starts fresh. */}
      <TraceProvider key={state.scenarioToken} events={state.events}>
        <IncidentDetailView />
      </TraceProvider>
    </>
  );
}

function IncidentDetailView() {
  const { state, dispatch, requestLateEvents, rerunAnalysis } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const incident = INCIDENTS.find((item) => item.id === SCRIPTED_INCIDENT_ID)!;
  const tab = searchParams.get('tab') === 'audit' ? 'audit' : 'overview';
  const setTab = useCallback(
    (next: string) => setSearchParams(next === 'audit' ? { tab: 'audit' } : {}, { replace: true }),
    [setSearchParams],
  );

  useEffect(() => {
    dispatch({ type: 'INCIDENT_OPENED' });
    requestLateEvents();
  }, [dispatch, requestLateEvents]);

  const eventsById = useMemo(() => indexEvents(state), [state]);
  const events = useMemo(() => timelineEvents(state), [state]);
  const citationCounts = useMemo(() => citedCounts(state.analysis), [state.analysis]);
  const newSinceIds = useMemo(() => newSinceAnalysisIds(state), [state]);

  const { bannerMode, lateCount, analysisAnnouncement } = useAnalysisStatusAnnouncement(state);
  const {
    factsRef,
    factsSticky,
    groupExpanded,
    toggleGroup,
    showSource,
    backToEvidence,
  } = useEvidenceNavigation(eventsById);

  const recommendation = findRecommendation(state, state.selectedRecommendationId) ?? null;
  const gateResult = recommendation ? gateFor(state, recommendation.id) ?? null : null;
  const draft = state.draft;
  const draftBlockedReason =
    draft && gateResult && !gateResult[draft.action].allowed ? gateResult[draft.action].reason ?? null : null;
  const inputError =
    draftBlockedReason ??
    (draft && recommendation && gateResult
      ? decisionInputError(draft.action, recommendation, gateResult, draft.input)
      : null);
  const lastDecision = state.audit.find((entry) => entry.id === state.lastDecisionId);
  const recorded =
    lastDecision?.kind === 'decision'
      ? { at: lastDecision.at, summary: ACTION_PAST[lastDecision.action], outcome: lastDecision.outcome }
      : null;
  const decisionCount = state.audit.filter((entry) => entry.kind === 'decision').length;

  const dockSlot = useDockSlot();
  const decisionDock = (
    <div className={styles.dockLayout}>
      <div id="decision-bar" className={styles.dockCell} tabIndex={-1}>
        <DecisionBar
          recommendation={recommendation}
          gate={gateResult}
          draft={draft}
          inputError={inputError}
          recorded={recorded}
          onStart={(action) => {
            dispatch({ type: 'DECISION_STARTED', action });
            if (action === 'escalate') {
              dispatch({ type: 'DECISION_INPUT_CHANGED', input: { team: ESCALATION_TEAMS[0] } });
            }
          }}
          onInput={(input) => dispatch({ type: 'DECISION_INPUT_CHANGED', input })}
          onCancel={() => dispatch({ type: 'DECISION_CANCELLED' })}
          onSubmit={() => dispatch({ type: 'DECISION_SUBMITTED' })}
          onViewAudit={() => setTab('audit')}
        />
      </div>
    </div>
  );

  const tabs = (
    <Tabs.List className={styles.tabs} aria-label="Incident views">
      <Tabs.Trigger className={styles.tab} value="overview">
        Overview
      </Tabs.Trigger>
      <Tabs.Trigger className={styles.tab} value="audit">
        {decisionCount === 0 ? 'Audit' : `Audit · ${decisionCount} ${decisionCount === 1 ? 'decision' : 'decisions'}`}
      </Tabs.Trigger>
    </Tabs.List>
  );

  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <IncidentHeader
        incident={incident}
        status={state.incidentStatus}
        owner={DEMO_ACTOR}
        siteName={sitesById[incident.siteId]?.name ?? ''}
        tabs={tabs}
      />

      <Tabs.Content value="overview" className={styles.overview}>
        <a href="#decision-bar" className={styles.skip}>
          Skip to decision
        </a>

        <div className={styles.layout}>
          <ObservedFactsPanel
            analysis={state.analysis}
            events={events}
            citationCounts={citationCounts}
            newSinceIds={newSinceIds}
            groupExpanded={groupExpanded}
            onToggleGroup={toggleGroup}
            onBackToEvidence={backToEvidence}
            factsRef={factsRef}
            factsSticky={factsSticky}
          />

          <AIAssistancePanel
            state={state}
            eventsById={eventsById}
            bannerMode={bannerMode}
            lateCount={lateCount}
            analysisAnnouncement={analysisAnnouncement}
            onRerun={rerunAnalysis}
            onAcknowledgeStale={() => dispatch({ type: 'STALE_ACKNOWLEDGED' })}
            onShowSource={showSource}
            onSelectRecommendation={(recommendationId) =>
              dispatch({ type: 'RECOMMENDATION_SELECTED', recommendationId })
            }
          />
        </div>
      </Tabs.Content>

      {tab === 'overview' && dockSlot ? createPortal(decisionDock, dockSlot) : null}

      <Tabs.Content value="audit">
        <AuditTab entries={state.audit} eventsById={eventsById} systemsById={systemsById} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
