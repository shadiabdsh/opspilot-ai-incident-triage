import { describe, expect, it } from 'vitest';
import { gate, REASONS, type GateInput } from './gate';
import type {
  AnalysisStatus,
  Confidence,
  IncidentStatus,
  RecommendationStatus,
  RiskTier,
} from './types';

const tiers: RiskTier[] = ['read_only', 'low_impact', 'consequential'];
const confidences: Confidence[] = ['high', 'medium', 'low'];
const analysisStatuses: AnalysisStatus[] = ['analyzing', 'ready', 'stale', 'acknowledged'];
const recStatuses: RecommendationStatus[] = ['pending', 'approved', 'modified', 'dismissed', 'escalated'];
const incidentStatuses: IncidentStatus[] = ['open', 'in_review', 'decided', 'escalated'];

/** Every combination of inputs: 3 × 3 × 4 × 5 × 4 = 720 cases. */
function allInputs(): GateInput[] {
  const out: GateInput[] = [];
  for (const tier of tiers)
    for (const confidence of confidences)
      for (const analysisStatus of analysisStatuses)
        for (const recommendationStatus of recStatuses)
          for (const incidentStatus of incidentStatuses)
            out.push({ tier, confidence, analysisStatus, recommendationStatus, incidentStatus });
  return out;
}

const pendingReview = { recommendationStatus: 'pending', incidentStatus: 'in_review' } as const;

describe('gate(): Approve and Modify rule table (Implementation Plan §6)', () => {
  // [analysis status, confidence, tier, expected reason or 'allowed']
  const table: Array<[AnalysisStatus, Confidence, RiskTier, string]> = [
    ['analyzing', 'high', 'read_only', REASONS.analyzing],
    ['analyzing', 'high', 'consequential', REASONS.analyzing],
    ['ready', 'high', 'read_only', 'allowed'],
    ['ready', 'high', 'low_impact', 'allowed'],
    ['ready', 'high', 'consequential', 'allowed'],
    ['ready', 'medium', 'consequential', 'allowed'],
    ['ready', 'low', 'read_only', 'allowed'],
    ['ready', 'low', 'low_impact', 'allowed'],
    ['ready', 'low', 'consequential', REASONS.lowConfidence],
    ['stale', 'high', 'read_only', REASONS.staleLowRisk],
    ['stale', 'high', 'low_impact', REASONS.staleLowRisk],
    ['stale', 'high', 'consequential', REASONS.staleConsequential],
    ['acknowledged', 'high', 'read_only', 'allowed'],
    ['acknowledged', 'high', 'low_impact', 'allowed'],
    ['acknowledged', 'high', 'consequential', REASONS.acknowledgedConsequential],
    ['acknowledged', 'low', 'consequential', REASONS.acknowledgedConsequential],
  ];

  it.each(table)('%s / %s / %s → %s', (analysisStatus, confidence, tier, expected) => {
    const result = gate({ ...pendingReview, analysisStatus, confidence, tier });
    for (const action of ['approve', 'modify'] as const) {
      if (expected === 'allowed') expect(result[action].allowed).toBe(true);
      else expect(result[action]).toEqual({ allowed: false, reason: expected });
    }
  });
});

describe('gate(): Dismiss and Escalate', () => {
  it('are allowed in every analysis status except analyzing, regardless of tier and confidence', () => {
    for (const input of allInputs().filter((i) => i.recommendationStatus === 'pending')) {
      const r = gate(input);
      const expected = input.analysisStatus !== 'analyzing';
      expect(r.dismiss.allowed).toBe(expected);
      expect(r.escalate.allowed).toBe(expected);
    }
  });
});

describe('gate(): invariants', () => {
  const inputs = allInputs();

  it('1. acknowledged stale analysis never allows a consequential Approve or Modify', () => {
    for (const i of inputs.filter((i) => i.analysisStatus === 'acknowledged' && i.tier === 'consequential')) {
      const r = gate(i);
      expect(r.approve.allowed).toBe(false);
      expect(r.modify.allowed).toBe(false);
    }
  });

  it('2. only Ready with High or Medium confidence allows a consequential action', () => {
    for (const i of inputs.filter((i) => i.tier === 'consequential')) {
      const r = gate(i);
      if (r.approve.allowed) {
        expect(i.analysisStatus).toBe('ready');
        expect(['high', 'medium']).toContain(i.confidence);
      }
    }
  });

  it('3. a recommendation that is not pending allows nothing', () => {
    for (const i of inputs.filter((i) => i.recommendationStatus !== 'pending')) {
      const r = gate(i);
      for (const action of ['approve', 'modify', 'dismiss', 'escalate'] as const) {
        expect(r[action]).toEqual({ allowed: false, reason: REASONS.alreadyDecided });
      }
    }
  });

  it('4. every blocked result has a non-empty reason', () => {
    for (const i of inputs) {
      const r = gate(i);
      for (const action of ['approve', 'modify', 'dismiss', 'escalate'] as const) {
        if (!r[action].allowed) expect(r[action].reason?.length).toBeGreaterThan(0);
      }
    }
  });

  it('5. typed confirmation is required exactly when a consequential change is allowed', () => {
    for (const i of inputs) {
      const r = gate(i);
      expect(r.requiresTypedConfirm).toBe(i.tier === 'consequential' && r.approve.allowed);
    }
  });

  it('an escalated incident blocks Approve and Modify but not Dismiss or Escalate', () => {
    const r = gate({ ...pendingReview, incidentStatus: 'escalated', analysisStatus: 'ready', confidence: 'high', tier: 'low_impact' });
    expect(r.approve).toEqual({ allowed: false, reason: REASONS.incidentEscalated });
    expect(r.dismiss.allowed).toBe(true);
  });

  it('flags only Approve and Modify on acknowledged stale analysis, never Dismiss or Escalate', () => {
    for (const tier of ['read_only', 'low_impact'] as const) {
      const r = gate({ ...pendingReview, analysisStatus: 'acknowledged', confidence: 'high', tier });
      expect(r.approve.flag).toBe('acknowledged_stale');
      expect(r.modify.flag).toBe('acknowledged_stale');
      expect(r.dismiss.flag).toBeUndefined();
      expect(r.escalate.flag).toBeUndefined();
    }
  });

  it('never flags anything outside acknowledged status, and never flags a blocked action', () => {
    for (const i of inputs) {
      const r = gate(i);
      for (const action of ['approve', 'modify', 'dismiss', 'escalate'] as const) {
        if (r[action].flag) {
          expect(i.analysisStatus).toBe('acknowledged');
          expect(r[action].allowed).toBe(true);
          expect(['approve', 'modify']).toContain(action);
        }
      }
    }
  });

  it('warns on Medium confidence consequential actions', () => {
    const r = gate({ ...pendingReview, analysisStatus: 'ready', confidence: 'medium', tier: 'consequential' });
    expect(r.warning).toBeDefined();
    expect(r.requiresTypedConfirm).toBe(true);
  });
});
