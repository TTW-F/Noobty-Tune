import type {
  PitchTrackerConfig,
  PitchTrackingState,
  RawPitchCandidate,
  TrackingStage,
} from "../../types/pitchTracking";
import { DEFAULT_TRACKER_CONFIG } from "../../types/pitchTracking";
import { createScopedLogger } from "../logging/developerLogger";

const trackerLogger = createScopedLogger("stabilizer");

export class ContinuousPitchTracker {
  private state: PitchTrackingState;
  private readonly config: PitchTrackerConfig;
  private history: RawPitchCandidate[] = [];
  private lockStartTime: number | null = null;

  constructor(config: Partial<PitchTrackerConfig> = {}) {
    this.config = { ...DEFAULT_TRACKER_CONFIG, ...config };
    this.state = this.createIdleState();
  }

  update(candidate: RawPitchCandidate): PitchTrackingState {
    this.history.push(candidate);
    if (this.history.length > this.config.maxHistoryFrames) {
      this.history.shift();
    }

    const nextState = (() => {
      switch (this.state.stage) {
        case "idle":
          return this.handleIdle(candidate);
        case "acquiring":
          return this.handleAcquiring(candidate);
        case "tracking":
          return this.handleTracking(candidate);
        case "locked":
          return this.handleLocked(candidate);
        case "degraded":
          return this.handleDegraded(candidate);
        case "lost":
          return this.handleLost(candidate);
        default:
          return this.state;
      }
    })();

    this.state = nextState;
    return nextState;
  }

  reset(): void {
    trackerLogger.info("Tracker reset", "Pitch tracker was manually reset.");
    this.state = this.createIdleState();
    this.history = [];
    this.lockStartTime = null;
  }

  getState(): PitchTrackingState {
    return this.state;
  }

  private handleIdle(candidate: RawPitchCandidate): PitchTrackingState {
    if (candidate.frequencyHz === null) {
      return this.state;
    }

    // The detector reports marginal candidates with honest clarity; only
    // candidates that clear the hold floor may start an acquisition attempt.
    if (candidate.clarity < this.config.holdClarityThreshold) {
      return this.state;
    }

    return this.transitionTo("acquiring", {
      trackedFrequencyHz: candidate.frequencyHz,
      confidence: candidate.clarity,
      lastStableFrequencyHz: null,
      stableDurationMs: 0,
      holdRemainingMs: 0,
      mismatchCount: 0,
      timestampMs: candidate.timestampMs,
    });
  }

  private handleAcquiring(candidate: RawPitchCandidate): PitchTrackingState {
    if (candidate.frequencyHz === null) {
      return this.tolerateMissDuringAcquiring(candidate.timestampMs);
    }

    const referenceFrequency = this.state.trackedFrequencyHz ?? candidate.frequencyHz;
    const recentCandidates = this.getRecentContiguousCandidates(
      this.config.lockRequiredFrames,
      referenceFrequency,
    );
    const avgFreq = this.averageFrequency(recentCandidates.map((item) => item.frequencyHz ?? 0));
    const avgClarity = this.average(recentCandidates.map((item) => item.clarity));

    if (recentCandidates.length < this.config.lockRequiredFrames) {
      return {
        ...this.state,
        trackedFrequencyHz: candidate.frequencyHz,
        confidence: candidate.clarity,
        mismatchCount: 0,
        timestampMs: candidate.timestampMs,
      };
    }

    const centsSpread = this.getFrequencySpreadInCents(recentCandidates);
    if (centsSpread > this.config.maxFrequencyJumpCents) {
      return {
        ...this.state,
        trackedFrequencyHz: candidate.frequencyHz,
        confidence: candidate.clarity,
        mismatchCount: 0,
        holdRemainingMs: 0,
        timestampMs: candidate.timestampMs,
      };
    }

    if (avgClarity >= this.config.lockClarityThreshold) {
      this.lockStartTime = candidate.timestampMs;
      return this.transitionTo("locked", {
        trackedFrequencyHz: avgFreq,
        confidence: avgClarity,
        lastStableFrequencyHz: avgFreq,
        stableDurationMs: 0,
        holdRemainingMs: this.config.holdDurationMs,
        mismatchCount: 0,
        timestampMs: candidate.timestampMs,
      });
    }

    return this.transitionTo("tracking", {
      trackedFrequencyHz: avgFreq,
      confidence: avgClarity,
      lastStableFrequencyHz: this.state.lastStableFrequencyHz,
      stableDurationMs: 0,
      holdRemainingMs: this.config.holdDurationMs,
      mismatchCount: 0,
      timestampMs: candidate.timestampMs,
    });
  }

  private handleTracking(candidate: RawPitchCandidate): PitchTrackingState {
    if (candidate.frequencyHz === null) {
      return this.degradeOrHold(candidate.timestampMs, "no-candidate");
    }

    const referenceFrequency = this.state.trackedFrequencyHz ?? candidate.frequencyHz;
    const centsDelta = this.getCentsOffset(candidate.frequencyHz, referenceFrequency);
    if (Math.abs(centsDelta) > this.config.maxFrequencyJumpCents) {
      return this.degradeOrHold(candidate.timestampMs, "frequency-jump");
    }

    if (candidate.clarity < this.config.holdClarityThreshold) {
      return this.degradeOrHold(candidate.timestampMs, "clarity-drop");
    }

    const recentCandidates = this.getRecentContiguousCandidates(
      this.config.lockRequiredFrames,
      referenceFrequency,
    );
    const avgFreq = this.averageFrequency(recentCandidates.map((item) => item.frequencyHz ?? 0));
    const avgClarity = this.average(recentCandidates.map((item) => item.clarity));

    if (
      recentCandidates.length >= this.config.lockRequiredFrames &&
      this.getFrequencySpreadInCents(recentCandidates) <= this.config.maxFrequencyJumpCents &&
      avgClarity >= this.config.lockClarityThreshold
    ) {
      this.lockStartTime = candidate.timestampMs;
      return this.transitionTo("locked", {
        trackedFrequencyHz: avgFreq,
        confidence: avgClarity,
        lastStableFrequencyHz: avgFreq,
        stableDurationMs: 0,
        holdRemainingMs: this.config.holdDurationMs,
        mismatchCount: 0,
        timestampMs: candidate.timestampMs,
      });
    }

    return {
      ...this.state,
      trackedFrequencyHz: avgFreq,
      confidence: avgClarity,
      holdRemainingMs: this.config.holdDurationMs,
      mismatchCount: 0,
      timestampMs: candidate.timestampMs,
    };
  }

  private handleLocked(candidate: RawPitchCandidate): PitchTrackingState {
    const stableDuration = this.lockStartTime
      ? Math.max(candidate.timestampMs - this.lockStartTime, 0)
      : this.state.stableDurationMs;
    const nextState = this.maintainLock(candidate);

    return {
      ...nextState,
      stableDurationMs: stableDuration,
    };
  }

  private handleDegraded(candidate: RawPitchCandidate): PitchTrackingState {
    if (candidate.frequencyHz === null) {
      return this.advanceDegraded(candidate.timestampMs);
    }

    const referenceFrequency = this.state.trackedFrequencyHz ?? candidate.frequencyHz;
    const centsDelta = this.getCentsOffset(candidate.frequencyHz, referenceFrequency);

    if (
      Math.abs(centsDelta) <= this.config.maxFrequencyJumpCents &&
      candidate.clarity >= this.config.holdClarityThreshold
    ) {
      // Recover onto the recent window average instead of the raw candidate so
      // the tracked frequency stays smooth across the degraded episode.
      const recentCandidates = this.getRecentContiguousCandidates(
        this.config.lockRequiredFrames,
        this.state.trackedFrequencyHz ?? candidate.frequencyHz,
      );
      const recoveredFrequencyHz = recentCandidates.length > 0
        ? this.averageFrequency(recentCandidates.map((item) => item.frequencyHz ?? 0))
        : candidate.frequencyHz;

      return this.transitionTo("tracking", {
        ...this.state,
        trackedFrequencyHz: recoveredFrequencyHz,
        confidence: candidate.clarity,
        mismatchCount: 0,
        holdRemainingMs: this.config.holdDurationMs,
        timestampMs: candidate.timestampMs,
      });
    }

    return this.advanceDegraded(candidate.timestampMs);
  }

  private handleLost(candidate: RawPitchCandidate): PitchTrackingState {
    if (candidate.frequencyHz === null) {
      return this.state;
    }

    if (candidate.clarity < this.config.holdClarityThreshold) {
      return this.state;
    }

    return this.transitionTo("acquiring", {
      trackedFrequencyHz: candidate.frequencyHz,
      confidence: candidate.clarity,
      lastStableFrequencyHz: this.state.lastStableFrequencyHz,
      stableDurationMs: 0,
      holdRemainingMs: 0,
      mismatchCount: 0,
      timestampMs: candidate.timestampMs,
    });
  }

  private maintainLock(candidate: RawPitchCandidate): PitchTrackingState {
    if (candidate.frequencyHz === null) {
      return this.degradeOrHold(candidate.timestampMs, "no-candidate");
    }

    const referenceFrequency = this.state.trackedFrequencyHz ?? candidate.frequencyHz;
    const centsDelta = this.getCentsOffset(candidate.frequencyHz, referenceFrequency);

    if (Math.abs(centsDelta) > this.config.maxFrequencyJumpCents) {
      return this.degradeOrHold(candidate.timestampMs, "frequency-jump");
    }

    if (candidate.clarity < this.config.holdClarityThreshold) {
      return this.degradeOrHold(candidate.timestampMs, "clarity-drop");
    }

    const recentCandidates = this.getRecentContiguousCandidates(
      5,
      this.state.trackedFrequencyHz ?? candidate.frequencyHz,
    );
    const avgFreq = this.averageFrequency(recentCandidates.map((item) => item.frequencyHz ?? 0));
    const avgClarity = this.average(recentCandidates.map((item) => item.clarity));

    return {
      ...this.state,
      trackedFrequencyHz: avgFreq,
      confidence: avgClarity,
      lastStableFrequencyHz: avgFreq,
      mismatchCount: 0,
      holdRemainingMs: this.config.holdDurationMs,
      timestampMs: candidate.timestampMs,
    };
  }

  private tolerateMissDuringAcquiring(timestampMs: number): PitchTrackingState {
    const misses = this.state.mismatchCount + 1;

    if (misses <= this.config.acquiringGraceMisses) {
      // Brief dropouts are common during the pluck attack; keep the partial
      // window instead of discarding the whole acquisition attempt.
      return {
        ...this.state,
        mismatchCount: misses,
        holdRemainingMs: 0,
        timestampMs,
      };
    }

    return this.transitionTo("idle", this.createIdleState(timestampMs));
  }

  private degradeOrHold(
    timestampMs: number,
    reason: "no-candidate" | "frequency-jump" | "clarity-drop",
  ): PitchTrackingState {
    const newMismatchCount = this.state.mismatchCount + 1;
    const nextHoldRemainingMs = Math.max(
      this.state.holdRemainingMs - this.getFrameDurationMs(timestampMs),
      0,
    );
    // A single rejected frame must not flip the stage: tracking degrades only
    // after a couple of consecutive misses, locked releases on hold exhaustion
    // or its accumulated mismatch budget. Otherwise a marginal sustain makes
    // the stage flicker tracking <-> degraded every other frame.
    const mismatchLimit = this.state.stage === "tracking"
      ? this.config.trackingToleranceMisses
      : Math.ceil(this.config.releaseAfterMisses / 2);

    if (
      nextHoldRemainingMs <= 0 ||
      newMismatchCount >= mismatchLimit
    ) {
      return this.transitionTo("degraded", {
        ...this.state,
        mismatchCount: newMismatchCount,
        holdRemainingMs: nextHoldRemainingMs,
        timestampMs,
      });
    }

    trackerLogger.debug("Hold during mismatch", "Maintaining lock despite mismatch.", {
      throttleKey: "hold-mismatch",
      throttleMs: 1000,
      meta: {
        reason,
        mismatchCount: newMismatchCount,
      },
    });

    return {
      ...this.state,
      mismatchCount: newMismatchCount,
      holdRemainingMs: nextHoldRemainingMs,
      timestampMs,
    };
  }

  private advanceDegraded(timestampMs: number): PitchTrackingState {
    const newMismatchCount = this.state.mismatchCount + 1;
    if (newMismatchCount >= this.config.releaseAfterMisses) {
      return this.transitionTo("lost", {
        ...this.state,
        mismatchCount: newMismatchCount,
        holdRemainingMs: 0,
        timestampMs,
      });
    }

    return {
      ...this.state,
      mismatchCount: newMismatchCount,
      holdRemainingMs: Math.max(
        this.state.holdRemainingMs - this.getFrameDurationMs(timestampMs),
        0,
      ),
      timestampMs,
    };
  }

  private transitionTo(
    newStage: TrackingStage,
    updates: Partial<PitchTrackingState>,
  ): PitchTrackingState {
    if (this.state.stage !== newStage) {
      trackerLogger.info("Stage transition", "Tracking stage changed.", {
        throttleKey: `transition-${this.state.stage}-${newStage}`,
        throttleMs: 800,
        meta: {
          from: this.state.stage,
          to: newStage,
          frequency: this.state.trackedFrequencyHz?.toFixed(2) ?? "null",
        },
      });
    }

    return {
      ...this.state,
      ...updates,
      stage: newStage,
    };
  }

  private createIdleState(timestampMs = Date.now()): PitchTrackingState {
    return {
      trackedFrequencyHz: null,
      confidence: 0,
      stage: "idle",
      lastStableFrequencyHz: null,
      stableDurationMs: 0,
      holdRemainingMs: 0,
      mismatchCount: 0,
      timestampMs,
    };
  }

  private getRecentContiguousCandidates(
    count: number,
    referenceFrequencyHz: number | null = null,
  ): RawPitchCandidate[] {
    const recent: RawPitchCandidate[] = [];

    for (let index = this.history.length - 1; index >= 0 && recent.length < count; index -= 1) {
      const candidate = this.history[index];
      if (candidate.frequencyHz === null) {
        break;
      }

      // Jump-gated candidates still enter history; they must not re-enter the
      // smoothing window, or a single octave glitch drags the window mean far
      // enough to reject every following frame and cascade into a lost lock.
      if (
        referenceFrequencyHz !== null &&
        Math.abs(this.getCentsOffset(candidate.frequencyHz, referenceFrequencyHz)) >
          this.config.maxFrequencyJumpCents
      ) {
        break;
      }

      recent.unshift(candidate);
    }

    return recent;
  }

  private getFrequencySpreadInCents(candidates: RawPitchCandidate[]): number {
    const frequencies = candidates
      .map((candidate) => candidate.frequencyHz)
      .filter((frequency): frequency is number => frequency !== null);

    if (frequencies.length === 0) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.abs(this.getCentsOffset(Math.max(...frequencies), Math.min(...frequencies)));
  }

  private getCentsOffset(frequencyHz: number, referenceHz: number): number {
    if (referenceHz <= 0) {
      return 0;
    }

    return 1200 * Math.log2(frequencyHz / referenceHz);
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Pitch lives in the log domain: cents are ratios, not differences. Averaging
   * frequencies arithmetically biases the tracked pitch sharp inside the
   * allowed lock window, so the window mean is taken geometrically instead.
   */
  private averageFrequency(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    let logSum = 0;
    for (const value of values) {
      logSum += Math.log(value > 0 ? value : Number.EPSILON);
    }

    return Math.exp(logSum / values.length);
  }

  private getFrameDurationMs(timestampMs: number): number {
    const delta = timestampMs - this.state.timestampMs;
    if (!Number.isFinite(delta) || delta <= 0 || delta > 250) {
      return 50;
    }

    return delta;
  }
}
