/**
 * Incident Detail (UX Blueprint, section 2).
 *
 * Two landmark regions keep provenance structural: Observed facts on the left contain only
 * raw records; AI assistance on the right contains everything the AI concluded. One page
 * scroll, a sticky incident header and a sticky DecisionBar. The trace runs
 * AI inference → EvidenceItem → timeline event → system row.
 */
import * as Tabs from '@radix-ui/react-tabs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { decisionInputError, DEMO_ACTOR, findRecommendation, gateFor } from '../domain/reducer';
import { citedCounts, eventsById as indexEvents, newSinceAnalysisIds, sitesById, systemsById, timelineEvents } from '../domain/selectors';
import { formatTime } from '../domain/clock';
import { INCIDENTS, SCRIPTED_INCIDENT_ID } from '../fixtures/incidents';
import { SCENARIOS } from '../fixtures/scenarios';
import { SYSTEMS, WORKSTATION_IDS } from '../fixtures/systems';
import { useStore } from '../state/StoreProvider';
import { useDockSlot } from '../state/DockSlot';
import { getScrollContainer, getScrollTop, setScrollTop } from '../state/scrollContainer';
import { eventRowId, TraceProvider, useTrace } from '../state/TraceProvider';
import { DecisionBar } from '../components/signature/DecisionBar/DecisionBar';
import { HypothesisCard } from '../components/signature/HypothesisCard/HypothesisCard';
import { RecommendationCard } from '../components/signature/RecommendationCard/RecommendationCard';
import { ACTION_PAST, sourcesCheckedLine } from '../components/signature/shared/labels';
import { EyeIcon, SparkIcon } from '../components/signature/shared/icons';
import { AffectedSystemsTable } from '../components/supporting/AffectedSystemsTable/AffectedSystemsTable';
import { AISummaryCard } from '../components/supporting/AISummaryCard/AISummaryCard';
import { EventTimeline } from '../components/supporting/EventTimeline/EventTimeline';
import { IncidentHeader } from '../components/supporting/IncidentHeader/IncidentHeader';
import { ScenarioSwitcher } from '../components/supporting/ScenarioSwitcher/ScenarioSwitcher';
import { SourceAvailability } from '../components/supporting/SourceAvailability/SourceAvailability';
import { StaleBanner, type StaleBannerMode } from '../components/supporting/StaleBanner/StaleBanner';
import { ESCALATION_TEAMS } from '../components/signature/shared/labels';
import { AuditTab } from './AuditTab';
import styles from './IncidentDetailScreen.module.css';

const workstationSet = new Set(WORKSTATION_IDS);
const groupSystems = SYSTEMS.filter((s) => workstationSet.has(s.id));
const relatedSystems = SYSTEMS.filter((s) => !workstationSet.has(s.id));

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

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

/** Describes only the sources that were actually read, so the facts header never claims a missing one. */
function factsSourceLine(sources: ReturnType<typeof useStore>['state']['analysis']['dataSources']): string {
  const unreadable = sources.some((d) => d.status === 'unavailable');
  if (!unreadable) return 'Raw records from monitoring, the NPS log, certificate inventory and switch telemetry.';
  const read = sources.filter((d) => d.status === 'checked').map((d) => d.label.toLowerCase());
  const list = read.length > 1 ? `${read.slice(0, -1).join(', ')} and ${read.at(-1)}` : (read[0] ?? 'no source');
  return `Raw records from the sources that could be read: ${list}.`;
}

function bannerModeFor(state: ReturnType<typeof useStore>['state']): StaleBannerMode | null {
  if (state.analysisStatus === 'stale') return 'stale';
  if (state.analysisStatus === 'analyzing') return 'analyzing';
  if (state.analysisStatus === 'acknowledged') return 'acknowledged';
  if (state.analysis.id === SCENARIOS[state.scenario].rerunAnalysis?.id) return 'refreshed';
  return null;
}

const ANNOUNCEMENTS: Record<StaleBannerMode, (n: number) => string> = {
  stale: (n) => `${n} new events arrived. The analysis is out of date, so approvals are paused.`,
  analyzing: () => 'Re-running analysis.',
  refreshed: () => 'Analysis updated. It now includes the new events.',
  acknowledged: () => 'Continuing with the out-of-date analysis. Consequential actions still need a re-run.',
};

function IncidentDetailView() {
  const { state, dispatch, requestLateEvents, rerunAnalysis } = useStore();
  const trace = useTrace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupExpanded, setGroupExpanded] = useState(false);

  const incident = INCIDENTS.find((i) => i.id === SCRIPTED_INCIDENT_ID)!;
  const tab = searchParams.get('tab') === 'audit' ? 'audit' : 'overview';
  const setTab = useCallback(
    (next: string) => setSearchParams(next === 'audit' ? { tab: 'audit' } : {}, { replace: true }),
    [setSearchParams],
  );

  useEffect(() => {
    dispatch({ type: 'INCIDENT_OPENED' });
    requestLateEvents(); // stale scenario only; no-op otherwise
  }, [dispatch, requestLateEvents]);

  // Analysis freshness: banner state and one polite announcement per transition.
  const bannerMode = bannerModeFor(state);
  const lateCount = SCENARIOS[state.scenario].lateEvents?.length ?? 0;
  const [analysisAnnouncement, setAnalysisAnnouncement] = useState('');
  const previousBanner = useRef(bannerMode);
  useEffect(() => {
    if (previousBanner.current === bannerMode) return;
    previousBanner.current = bannerMode;
    setAnalysisAnnouncement(bannerMode ? ANNOUNCEMENTS[bannerMode](lateCount) : '');
  }, [bannerMode, lateCount]);

  const eventsById = useMemo(() => indexEvents(state), [state]);
  const events = useMemo(() => timelineEvents(state), [state]);
  const cited = useMemo(() => citedCounts(state.analysis), [state.analysis]);
  const newSince = useMemo(() => newSinceAnalysisIds(state), [state]);

  // Observed facts stays in view while the AI column scrolls, but only when the whole
  // panel fits in the visible band; otherwise it scrolls normally (no scroll trap).
  const factsRef = useRef<HTMLElement>(null);
  const [factsSticky, setFactsSticky] = useState(false);
  useEffect(() => {
    const facts = factsRef.current;
    const scroller = getScrollContainer();
    if (!facts || !scroller || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 0;
      const available = scroller.clientHeight - header - 32;
      setFactsSticky(facts.offsetHeight > 0 && facts.offsetHeight <= available);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(facts);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // ── Trace: Show source and Back to evidence ───────────────────────────────
  const { setReturnPoint, returnPoint } = trace;

  const showSource = useCallback(
    (eventId: string) => {
      const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setReturnPoint({ eventId, scrollY: getScrollTop(), returnFocusTo });
      const systemId = eventsById[eventId]?.systemId;
      if (systemId && workstationSet.has(systemId)) setGroupExpanded(true);
      requestAnimationFrame(() => {
        const row = document.getElementById(eventRowId(eventId));
        // A sticky facts panel is already fully in view: move as little as possible.
        const block = factsSticky ? 'nearest' : 'center';
        row?.scrollIntoView({ block, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        row?.focus({ preventScroll: true });
      });
    },
    [eventsById, setReturnPoint, factsSticky],
  );

  const backToEvidence = useCallback(() => {
    if (!returnPoint) return;
    setReturnPoint(null);
    setScrollTop(returnPoint.scrollY);
    returnPoint.returnFocusTo?.focus({ preventScroll: true });
  }, [returnPoint, setReturnPoint]);

  // Escape inside the shown source row also goes back.
  useEffect(() => {
    if (!returnPoint) return;
    const onKey = (e: KeyboardEvent) => {
      const row = document.getElementById(eventRowId(returnPoint.eventId));
      if (e.key === 'Escape' && row && row.contains(document.activeElement)) {
        e.preventDefault();
        backToEvidence();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [returnPoint, backToEvidence]);

  // ── Decision wiring ───────────────────────────────────────────────────────
  const rec = findRecommendation(state, state.selectedRecommendationId) ?? null;
  const gateResult = rec ? gateFor(state, rec.id) ?? null : null;
  const draft = state.draft;
  // If the analysis changes while a dialog is open (for example new events arrive), the dialog
  // shows why it can no longer submit instead of silently refusing.
  const draftBlockedReason = draft && gateResult && !gateResult[draft.action].allowed ? gateResult[draft.action].reason ?? null : null;
  const inputError =
    draftBlockedReason ??
    (draft && rec && gateResult ? decisionInputError(draft.action, rec, gateResult, draft.input) : null);
  const last = state.audit.find((a) => a.id === state.lastDecisionId);
  const recorded = last?.kind === 'decision' ? { at: last.at, summary: ACTION_PAST[last.action], outcome: last.outcome } : null;
  const decisionCount = state.audit.filter((a) => a.kind === 'decision').length;

  const dockSlot = useDockSlot();
  const decisionDock = (
    <div className={styles.dockLayout}>
      <div id="decision-bar" className={styles.dockCell} tabIndex={-1}>
        <DecisionBar
          recommendation={rec}
          gate={gateResult}
          draft={draft}
          inputError={inputError}
          recorded={recorded}
          onStart={(action) => {
            dispatch({ type: 'DECISION_STARTED', action });
            // Escalation defaults to the team that owns NPS; the user can change it.
            if (action === 'escalate') dispatch({ type: 'DECISION_INPUT_CHANGED', input: { team: ESCALATION_TEAMS[0] } });
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
        {/* Counts decisions only, and says so: the trail also contains system events. */}
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
          <section ref={factsRef} className={styles.facts} data-sticky={factsSticky || undefined} aria-labelledby="facts-heading">
            <header className={styles.regionHeader}>
              <h2 id="facts-heading" className={styles.regionTitle}>
                <span className={styles.regionIcon} aria-hidden="true">
                  <EyeIcon />
                </span>
                Observed facts
              </h2>
              <p className={styles.regionMeta}>{factsSourceLine(state.analysis.dataSources)}</p>
            </header>

            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Affected systems</h3>
              <AffectedSystemsTable
                group={{ label: 'Building A workstations', systems: groupSystems }}
                related={relatedSystems}
                groupExpanded={groupExpanded}
                onToggleGroup={() => setGroupExpanded((g) => !g)}
              />
            </div>

            <SourceAvailability sources={state.analysis.dataSources} />

            <div className={styles.block}>
              <h3 className={styles.blockTitle}>Event timeline</h3>
              <EventTimeline events={events} citedCounts={cited} newSinceIds={newSince} onBackToEvidence={backToEvidence} />
            </div>
          </section>

          <section className={styles.ai} aria-labelledby="ai-heading" aria-busy={state.analysisStatus === 'analyzing' || undefined}>
            <header className={styles.regionHeader}>
              <h2 id="ai-heading" className={`${styles.regionTitle} ${styles.aiTitle}`}>
                <span className={`${styles.regionIcon} ${styles.aiIcon}`} aria-hidden="true">
                  <SparkIcon />
                </span>
                AI assistance
              </h2>
              <p className={styles.regionMeta}>
                Analysis at {formatTime(state.analysis.generatedAt)}, based on {state.analysis.basedOnEventIds.length} events.{' '}
                {sourcesCheckedLine(state.analysis.dataSources)} Pre-authored for this prototype.
              </p>
            </header>

            <div aria-live="polite" className="visually-hidden" data-testid="analysis-announcer">
              {analysisAnnouncement}
            </div>
            {bannerMode && (
              <StaleBanner
                mode={bannerMode}
                newCount={lateCount}
                analysisTime={state.analysis.generatedAt}
                onRerun={rerunAnalysis}
                onAcknowledge={() => dispatch({ type: 'STALE_ACKNOWLEDGED' })}
              />
            )}

            <div className={styles.analysis} data-analyzing={state.analysisStatus === 'analyzing' || undefined}>
              <AISummaryCard summary={state.analysis.summary} eventsById={eventsById} systemsById={systemsById} onShowSource={showSource} />

            {state.analysis.hypotheses.map((h) => (
              <HypothesisCard
                key={h.id}
                hypothesis={h}
                eventsById={eventsById}
                systemsById={systemsById}
                dataSources={h.rank === 'primary' ? state.analysis.dataSources : undefined}
                onShowSource={showSource}
              />
            ))}

            <fieldset className={styles.recommendations}>
              <legend className={styles.blockTitle}>Recommendations</legend>
              {state.analysis.recommendations.map((r) => (
                <RecommendationCard
                  key={r.id}
                  recommendation={r}
                  status={state.recommendations[r.id]?.status ?? 'pending'}
                  gate={gateFor(state, r.id)}
                  selected={state.selectedRecommendationId === r.id}
                  onSelect={() => dispatch({ type: 'RECOMMENDATION_SELECTED', recommendationId: r.id })}
                  groupName="recommendation"
                  modifiedParams={state.recommendations[r.id]?.modifiedParams}
                  eventsById={eventsById}
                  systemsById={systemsById}
                  onShowSource={showSource}
                />
              ))}
            </fieldset>
            </div>
          </section>
        </div>
      </Tabs.Content>

      {/* The decision surface lives in the reserved dock while the Overview is shown. */}
      {tab === 'overview' && dockSlot ? createPortal(decisionDock, dockSlot) : null}

      <Tabs.Content value="audit">
        <AuditTab entries={state.audit} eventsById={eventsById} systemsById={systemsById} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
