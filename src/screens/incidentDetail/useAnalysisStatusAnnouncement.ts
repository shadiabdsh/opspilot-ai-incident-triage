import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../../domain/reducer';
import { SCENARIOS } from '../../fixtures/scenarios';
import type { StaleBannerMode } from '../../components/supporting/StaleBanner/StaleBanner';

const ANNOUNCEMENTS: Record<StaleBannerMode, (n: number) => string> = {
  stale: (n) => `${n} new events arrived. The analysis is out of date, so approvals are paused.`,
  analyzing: () => 'Re-running analysis.',
  refreshed: () => 'Analysis updated. It now includes the new events.',
  acknowledged: () => 'Continuing with the out-of-date analysis. Consequential actions still need a re-run.',
};

function bannerModeFor(state: AppState): StaleBannerMode | null {
  if (state.analysisStatus === 'stale') return 'stale';
  if (state.analysisStatus === 'analyzing') return 'analyzing';
  if (state.analysisStatus === 'acknowledged') return 'acknowledged';
  if (state.analysis.id === SCENARIOS[state.scenario].rerunAnalysis?.id) return 'refreshed';
  return null;
}

export function useAnalysisStatusAnnouncement(state: AppState) {
  const bannerMode = bannerModeFor(state);
  const lateCount = SCENARIOS[state.scenario].lateEvents?.length ?? 0;
  const [analysisAnnouncement, setAnalysisAnnouncement] = useState('');
  const previousBanner = useRef(bannerMode);

  useEffect(() => {
    if (previousBanner.current === bannerMode) return;
    previousBanner.current = bannerMode;
    setAnalysisAnnouncement(bannerMode ? ANNOUNCEMENTS[bannerMode](lateCount) : '');
  }, [bannerMode, lateCount]);

  return { bannerMode, lateCount, analysisAnnouncement };
}
