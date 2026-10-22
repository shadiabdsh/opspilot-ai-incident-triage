/**
 * Signature component gallery: a development and review surface, not portfolio UI.
 * Open with `npm run dev` and visit /#gallery. Excluded from production builds.
 */
import { useReducer, useState, type ReactNode } from 'react';
import { gate } from '../domain/gate';
import {
  decisionInputError,
  findRecommendation,
  gateFor,
  reducer,
  type AppState,
} from '../domain/reducer';
import { systemsById } from '../domain/selectors';
import { ANALYSIS_BASE } from '../fixtures/analysis.base';
import { ANALYSIS_LOW } from '../fixtures/analysis.low';
import { ALL_EVENTS } from '../fixtures/events';
import { REC_BIND_AND_RESTART, REC_NOTIFY_USERS, REC_VERIFY_CHAIN } from '../fixtures/recommendations';
import { TraceProvider, useTrace } from '../state/TraceProvider';
import { AuditEntry } from '../components/signature/AuditEntry/AuditEntry';
import { ConfidenceIndicator } from '../components/signature/ConfidenceIndicator/ConfidenceIndicator';
import { DecisionBar } from '../components/signature/DecisionBar/DecisionBar';
import { EvidenceItem } from '../components/signature/EvidenceItem/EvidenceItem';
import { HypothesisCard } from '../components/signature/HypothesisCard/HypothesisCard';
import { ProvenanceTag } from '../components/signature/ProvenanceTag/ProvenanceTag';
import { RecommendationCard } from '../components/signature/RecommendationCard/RecommendationCard';
import { ACTION_PAST } from '../components/signature/shared/labels';
import {
  allEventsById,
  auditExamples,
  mediumConfidenceState,
  openedState,
  recordedState,
  staleArrived,
} from './galleryData';
import styles from './Gallery.module.css';

const ev = (id: string) => {
  const e = allEventsById[id];
  if (!e) throw new Error(`Unknown event ${id}`);
  return e;
};

function Specimen({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={styles.specimen} data-wide={wide || undefined}>
      <figcaption className={styles.caption}>{label}</figcaption>
      <div className={styles.stage}>{children}</div>
    </figure>
  );
}

function Section({ id, name, purpose, notes, children }: { id: string; name: string; purpose: string; notes?: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>{name}</h2>
      <p className={styles.purpose}>{purpose}</p>
      {notes && <p className={styles.notes}>Accessibility: {notes}</p>}
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

// ── Interactive helpers ─────────────────────────────────────────────────────

function ToggleTagDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.stack}>
      <ProvenanceTag kind="inferred" evidenceCount={3} onToggle={() => setOpen((o) => !o)} expanded={open} controlsId="gallery-tag-evidence" />
      <p id="gallery-tag-evidence" hidden={!open} className={styles.small}>
        (Evidence list would appear here.)
      </p>
    </div>
  );
}

function TraceReadout() {
  const { activeEventId, highlightedSystemId } = useTrace();
  const event = activeEventId ? allEventsById[activeEventId] : undefined;
  return (
    <div className={styles.readout}>
      <p className={styles.small}>Stand-ins for the timeline row and system row the trace highlights:</p>
      <p className={styles.row} data-active={event ? true : undefined}>
        Event row: {event ? `${event.id}` : 'nothing traced'}
      </p>
      <p className={styles.row} data-active={highlightedSystemId ? true : undefined}>
        System row: {highlightedSystemId ?? 'nothing traced'}
      </p>
    </div>
  );
}

function LiveTraceDemo() {
  const [requested, setRequested] = useState<string | null>(null);
  return (
    <TraceProvider events={ALL_EVENTS}>
      <div className={styles.stack}>
        <ul className={styles.list}>
          <EvidenceItem event={ev('ev-nps-failures-12')} system={systemsById['nps-bldga-01']} stance="supporting" onShowSource={setRequested} />
          <EvidenceItem event={ev('ev-offline-ws-a-001')} system={systemsById['ws-a-001']} stance="supporting" onShowSource={setRequested} />
        </ul>
        <TraceReadout />
        <p className={styles.small} aria-live="polite">
          {requested ? `Show source requested for ${requested}` : 'Hover, or Tab to a Show source button.'}
        </p>
      </div>
    </TraceProvider>
  );
}

function DecisionBarHarness({ initial, note }: { initial: AppState; note?: string }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const rec = findRecommendation(state, state.selectedRecommendationId) ?? null;
  const g = rec ? gateFor(state, rec.id) ?? null : null;
  const draft = state.draft;
  const inputError = draft && rec && g ? decisionInputError(draft.action, rec, g, draft.input) : null;
  const last = state.audit.find((a) => a.id === state.lastDecisionId);
  const recorded =
    last?.kind === 'decision' ? { at: last.at, summary: ACTION_PAST[last.action], outcome: last.outcome } : null;

  return (
    <div className={styles.stack}>
      {note && <p className={styles.small}>{note}</p>}
      <label className={styles.small}>
        Selected recommendation{' '}
        <select
          value={state.selectedRecommendationId ?? ''}
          onChange={(e) => dispatch({ type: 'RECOMMENDATION_SELECTED', recommendationId: e.target.value })}
        >
          {state.analysis.recommendations.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <DecisionBar
        recommendation={rec}
        gate={g}
        draft={draft}
        inputError={inputError}
        recorded={recorded}
        onStart={(action) => dispatch({ type: 'DECISION_STARTED', action })}
        onInput={(input) => dispatch({ type: 'DECISION_INPUT_CHANGED', input })}
        onCancel={() => dispatch({ type: 'DECISION_CANCELLED' })}
        onSubmit={() => dispatch({ type: 'DECISION_SUBMITTED' })}
        onViewAudit={() => undefined}
      />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Gallery() {
  const base = openedState('base');
  const low = openedState('low');
  const stale = staleArrived();
  const audit = auditExamples();
  const pendingReview = { recommendationStatus: 'pending', incidentStatus: 'in_review', analysisStatus: 'ready' } as const;
  const baseHyp = ANALYSIS_BASE.hypotheses[0]!;
  const [lowPrimary, lowAlt] = ANALYSIS_LOW.hypotheses;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Signature component gallery</h1>
        <p className={styles.purpose}>
          Development and review surface for OpsPilot&apos;s seven signature components, rendered with the approved fixtures.
          Not portfolio UI.
        </p>
        <nav aria-label="Components">
          <ol className={styles.toc}>
            <li><a href="#g-provenance">ProvenanceTag</a></li>
            <li><a href="#g-confidence">ConfidenceIndicator</a></li>
            <li><a href="#g-evidence">EvidenceItem</a></li>
            <li><a href="#g-hypothesis">HypothesisCard</a></li>
            <li><a href="#g-recommendation">RecommendationCard</a></li>
            <li><a href="#g-decision">DecisionBar</a></li>
            <li><a href="#g-audit">AuditEntry</a></li>
          </ol>
        </nav>
      </header>

      <Section
        id="g-provenance"
        name="1. ProvenanceTag"
        purpose="Marks how OpsPilot knows something. Border style (solid, dashed, dotted), word and accessible name all carry the meaning."
        notes="each tag's accessible name states its meaning in full, for example “Observed fact, source: NPS log”. The Inferred toggle exposes aria-expanded and aria-controls."
      >
        <Specimen label="Observed, with source"><ProvenanceTag kind="observed" source="NPS log" /></Specimen>
        <Specimen label="Observed, no source"><ProvenanceTag kind="observed" /></Specimen>
        <Specimen label="Inferred, static, with evidence count"><ProvenanceTag kind="inferred" evidenceCount={4} /></Specimen>
        <Specimen label="Inferred, toggle (try it)"><ToggleTagDemo /></Specimen>
        <Specimen label="Inferred, toggle expanded"><ProvenanceTag kind="inferred" evidenceCount={2} onToggle={() => undefined} expanded /></Specimen>
        <Specimen label="Unknown"><ProvenanceTag kind="unknown" /></Specimen>
        <Specimen label="All three in grayscale" wide>
          <div className={styles.grayscale}>
            <ProvenanceTag kind="observed" source="Cert inventory" /> <ProvenanceTag kind="inferred" evidenceCount={3} />{' '}
            <ProvenanceTag kind="unknown" />
          </div>
        </Specimen>
      </Section>

      <Section
        id="g-confidence"
        name="2. ConfidenceIndicator"
        purpose="Categorical band with a reason that is always visible. Filled segments (3, 2, 1) carry the band in grayscale."
        notes="announced as a group named “Confidence: High”, followed by the visible reason."
      >
        <Specimen label="High (base fixture)"><ConfidenceIndicator band="high" reason={baseHyp.confidenceReason} /></Specimen>
        <Specimen label="Medium (gallery-only text; no fixture uses Medium)">
          <ConfidenceIndicator band="medium" reason="Strong correlation, but one link is indirect." />
        </Specimen>
        <Specimen label="Low (low-confidence fixture)"><ConfidenceIndicator band="low" reason={lowPrimary!.confidenceReason} /></Specimen>
        <Specimen label="All three in grayscale" wide>
          <div className={`${styles.grayscale} ${styles.row3}`}>
            <ConfidenceIndicator band="high" reason="High" />
            <ConfidenceIndicator band="medium" reason="Medium" />
            <ConfidenceIndicator band="low" reason="Low" />
          </div>
        </Specimen>
      </Section>

      <Section
        id="g-evidence"
        name="3. EvidenceItem"
        purpose="Ties an inference to one observed event and starts the trace. Supporting and counter-evidence differ by label and rule style."
        notes="the item highlights on hover and on keyboard focus of its Show source button. The button's name includes time and system, and it is described by the raw message."
      >
        <Specimen label="Supporting, with Show source">
          <ul className={styles.list}><EvidenceItem event={ev('ev-nps-first-failure')} system={systemsById['nps-bldga-01']} stance="supporting" onShowSource={() => undefined} /></ul>
        </Specimen>
        <Specimen label="Counter-evidence, with inferred explanation">
          <ul className={styles.list}><EvidenceItem event={ev('ev-printer-online')} system={systemsById['prn-a-03']} stance="counter" explanation={baseHyp.counter[0]!.explanation} onShowSource={() => undefined} /></ul>
        </Specimen>
        <Specimen label="Trace active (forced)">
          <ul className={styles.list}><EvidenceItem event={ev('ev-cert-expired')} system={systemsById['nps-bldga-01']} stance="supporting" onShowSource={() => undefined} traceActive /></ul>
        </Specimen>
        <Specimen label="Source off-screen hint">
          <ul className={styles.list}><EvidenceItem event={ev('ev-offline-ws-a-012')} system={systemsById['ws-a-012']} stance="supporting" onShowSource={() => undefined} offscreen="below" /></ul>
        </Specimen>
        <Specimen label="Read-only (inside an audit snapshot)">
          <ul className={styles.list}><EvidenceItem event={ev('ev-switch-healthy')} system={systemsById['sw-a-core-01']} stance="counter" explanation={baseHyp.counter[1]!.explanation} readOnly /></ul>
        </Specimen>
        <Specimen label="Live trace (hover or Tab)" wide><LiveTraceDemo /></Specimen>
      </Section>

      <Section
        id="g-hypothesis"
        name="4. HypothesisCard"
        purpose="The proposed cause, its confidence and reason, supporting and counter-evidence, unknowns and sources checked. Sections collapse but always show counts."
        notes="an article named by its cause. Section toggles expose aria-expanded. The Inferred tag on the cause also toggles the supporting evidence."
      >
        <Specimen label="Primary, High (base)" wide>
          <HypothesisCard hypothesis={baseHyp} eventsById={allEventsById} systemsById={systemsById} dataSources={ANALYSIS_BASE.dataSources} onShowSource={() => undefined} />
        </Specimen>
        <Specimen label="Primary, Low, with Unknown (low-confidence)" wide>
          <HypothesisCard hypothesis={lowPrimary!} eventsById={allEventsById} systemsById={systemsById} dataSources={ANALYSIS_LOW.dataSources} onShowSource={() => undefined} />
        </Specimen>
        <Specimen label="Alternative, Low, collapsed by default" wide>
          <HypothesisCard hypothesis={lowAlt!} eventsById={allEventsById} systemsById={systemsById} onShowSource={() => undefined} />
        </Specimen>
        <Specimen label="Read-only (no controls, no ids)" wide>
          <HypothesisCard hypothesis={baseHyp} eventsById={allEventsById} systemsById={systemsById} dataSources={ANALYSIS_BASE.dataSources} readOnly headingLevel={4} />
        </Specimen>
      </Section>

      <Section
        id="g-recommendation"
        name="5. RecommendationCard"
        purpose="An AI proposal with risk tier, reversibility, impact and rollback. Selecting a card loads it into the DecisionBar. Blocked cards stay selectable and state why."
        notes="cards in one list share a native radio group (arrow keys move selection). A blocked card's radio is described by its reason."
      >
        <Specimen label="Selection group: consequential (selected), read-only, low impact" wide>
          <fieldset className={styles.fieldset}>
            <legend className={styles.small}>Recommendations (base)</legend>
            <SelectionGroup />
          </fieldset>
        </Specimen>
        <Specimen label="Approved">
          <RecommendationCard recommendation={REC_VERIFY_CHAIN} status="approved" readOnly={false} />
        </Specimen>
        <Specimen label="Modified (approved with changes)">
          <RecommendationCard recommendation={REC_BIND_AND_RESTART} status="modified" modifiedParams={{ ...REC_BIND_AND_RESTART.params, 'Restart window': '06:30' }} />
        </Specimen>
        <Specimen label="Dismissed">
          <RecommendationCard recommendation={REC_NOTIFY_USERS} status="dismissed" />
        </Specimen>
        <Specimen label="Escalated">
          <RecommendationCard recommendation={REC_BIND_AND_RESTART} status="escalated" />
        </Specimen>
        <Specimen label="Blocked: Low confidence">
          <RecommendationCard recommendation={REC_BIND_AND_RESTART} status="pending" gate={gateFor(low, 'rec-bind-restart')} onSelect={() => undefined} groupName="g-blocked-low" />
        </Specimen>
        <Specimen label="Blocked: analysis out of date (stale)">
          <RecommendationCard recommendation={REC_BIND_AND_RESTART} status="pending" gate={gateFor(stale, 'rec-bind-restart')} onSelect={() => undefined} groupName="g-blocked-stale" />
        </Specimen>
        <Specimen label="Blocked: acknowledged stale, consequential still needs re-run">
          <RecommendationCard
            recommendation={REC_BIND_AND_RESTART}
            status="pending"
            gate={gate({ ...pendingReview, analysisStatus: 'acknowledged', confidence: 'high', tier: 'consequential' })}
            onSelect={() => undefined}
            groupName="g-blocked-ack"
          />
        </Specimen>
      </Section>

      <Section
        id="g-decision"
        name="6. DecisionBar"
        purpose="Where the human decides. Each specimen runs the real reducer: open the dialogs, try the typed confirmation, and record a decision."
        notes="blocked actions use aria-disabled, stay focusable and are described by the visible reason. Dialogs trap focus, close on Escape and return focus. Recorded decisions are announced through a polite status region."
      >
        <Specimen label="Base: consequential available, typed confirmation" wide>
          <DecisionBarHarness initial={base} />
        </Specimen>
        <Specimen label="Low confidence: Approve and Modify blocked; Dismiss and Escalate open" wide>
          <DecisionBarHarness initial={{ ...low, selectedRecommendationId: 'rec-bind-restart' }} />
        </Specimen>
        <Specimen label="Stale: Approve and Modify blocked until re-run or acknowledge" wide>
          <DecisionBarHarness initial={{ ...stale, selectedRecommendationId: 'rec-bind-restart' }} />
        </Specimen>
        <Specimen label="Medium confidence warning (gallery-only state)" wide>
          <DecisionBarHarness initial={{ ...mediumConfidenceState(), selectedRecommendationId: 'rec-bind-restart' }} note="No demo fixture uses Medium; the rule is defined and tested so the contract is complete." />
        </Specimen>
        <Specimen label="Recorded confirmation" wide>
          <DecisionBarHarness initial={recordedState()} />
        </Specimen>
      </Section>

      <Section
        id="g-audit"
        name="7. AuditEntry"
        purpose="One decision and the analysis it was made against. The frozen analysis uses read-only signature components: no controls, no duplicate ids."
        notes="an article named by the recommendation title. The snapshot toggle exposes aria-expanded. The diff uses Was and Now column headers, not colour."
      >
        <Specimen label="Approved (consequential), snapshot expanded" wide>
          <AuditEntry entry={audit.approved} eventsById={allEventsById} systemsById={systemsById} defaultExpanded />
        </Specimen>
        <Specimen label="Modified, with was/now diff" wide>
          <AuditEntry entry={audit.modified} eventsById={allEventsById} systemsById={systemsById} />
        </Specimen>
        <Specimen label="Dismissed, with reason"><AuditEntry entry={audit.dismissed} eventsById={allEventsById} systemsById={systemsById} /></Specimen>
        <Specimen label="Escalated, with team and note"><AuditEntry entry={audit.escalated} eventsById={allEventsById} systemsById={systemsById} /></Specimen>
        <Specimen label="Approved on acknowledged stale analysis (flagged)"><AuditEntry entry={audit.acknowledged} eventsById={allEventsById} systemsById={systemsById} /></Specimen>
        <Specimen label="System line"><AuditEntry entry={audit.systemLine} eventsById={allEventsById} systemsById={systemsById} /></Specimen>
      </Section>
    </main>
  );
}

function SelectionGroup() {
  const base = openedState('base');
  const [selected, setSelected] = useState('rec-bind-restart');
  return (
    <div className={styles.stack}>
      {[REC_BIND_AND_RESTART, REC_VERIFY_CHAIN, REC_NOTIFY_USERS].map((rec) => (
        <RecommendationCard
          key={rec.id}
          recommendation={rec}
          status="pending"
          gate={gateFor(base, rec.id)}
          selected={selected === rec.id}
          onSelect={() => setSelected(rec.id)}
          groupName="g-selection"
          eventsById={allEventsById}
          systemsById={systemsById}
          onShowSource={() => undefined}
        />
      ))}
    </div>
  );
}
