import type { AppState } from '../../domain/reducer';
import { gateFor } from '../../domain/reducer';
import { formatTime } from '../../domain/clock';
import { systemsById } from '../../domain/selectors';
import type { OpsEvent } from '../../domain/types';
import { HypothesisCard } from '../../components/signature/HypothesisCard/HypothesisCard';
import { RecommendationCard } from '../../components/signature/RecommendationCard/RecommendationCard';
import { sourcesCheckedLine } from '../../components/signature/shared/labels';
import { SparkIcon } from '../../components/signature/shared/icons';
import { AISummaryCard } from '../../components/supporting/AISummaryCard/AISummaryCard';
import { StaleBanner, type StaleBannerMode } from '../../components/supporting/StaleBanner/StaleBanner';
import styles from '../IncidentDetailScreen.module.css';

interface AIAssistancePanelProps {
  state: AppState;
  eventsById: Record<string, OpsEvent>;
  bannerMode: StaleBannerMode | null;
  lateCount: number;
  analysisAnnouncement: string;
  onRerun: () => void;
  onAcknowledgeStale: () => void;
  onShowSource: (eventId: string) => void;
  onSelectRecommendation: (recommendationId: string) => void;
}

export function AIAssistancePanel({
  state,
  eventsById,
  bannerMode,
  lateCount,
  analysisAnnouncement,
  onRerun,
  onAcknowledgeStale,
  onShowSource,
  onSelectRecommendation,
}: AIAssistancePanelProps) {
  return (
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
          onRerun={onRerun}
          onAcknowledge={onAcknowledgeStale}
        />
      )}

      <div className={styles.analysis} data-analyzing={state.analysisStatus === 'analyzing' || undefined}>
        <AISummaryCard
          summary={state.analysis.summary}
          eventsById={eventsById}
          systemsById={systemsById}
          onShowSource={onShowSource}
        />

        {state.analysis.hypotheses.map((hypothesis) => (
          <HypothesisCard
            key={hypothesis.id}
            hypothesis={hypothesis}
            eventsById={eventsById}
            systemsById={systemsById}
            dataSources={hypothesis.rank === 'primary' ? state.analysis.dataSources : undefined}
            onShowSource={onShowSource}
          />
        ))}

        <fieldset className={styles.recommendations}>
          <legend className={styles.blockTitle}>Recommendations</legend>
          {state.analysis.recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              status={state.recommendations[recommendation.id]?.status ?? 'pending'}
              gate={gateFor(state, recommendation.id)}
              selected={state.selectedRecommendationId === recommendation.id}
              onSelect={() => onSelectRecommendation(recommendation.id)}
              groupName="recommendation"
              modifiedParams={state.recommendations[recommendation.id]?.modifiedParams}
              eventsById={eventsById}
              systemsById={systemsById}
              onShowSource={onShowSource}
            />
          ))}
        </fieldset>
      </div>
    </section>
  );
}
