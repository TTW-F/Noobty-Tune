/**
 * Sustained Pitch Stabilizer - M2.5 整改版本
 * 
 * 核心改进：
 * 1. 区分"首次锁定"和"锁定后保持"两种模式
 * 2. 引入短时容错机制，不因单帧失效立即丢锁
 * 3. 增加 hold 机制，延音后期允许读数冻结
 * 4. 提供"跟踪中但可信度下降"的状态
 */

import type { PitchReading, PitchStabilizer, StabilizedPitchReading, TuningTarget } from "../../types/tuner";
import { createDeviationFromCents, findClosestTuningTarget, getCentsOffset } from "../music";

export interface SustainedPitchStabilizerOptions {
  // 首次锁定参数（严格）
  readonly initialRequiredSamples?: number;
  readonly initialCentsTolerance?: number;
  readonly initialClarityThreshold?: number;

  // 保持阶段参数（宽松）
  readonly sustainedClarityThreshold?: number;
  readonly sustainedCentsTolerance?: number;

  // 容错参数
  readonly maxConsecutiveFailures?: number; // 允许连续失败的帧数
  readonly holdFrames?: number; // 丢失后保持最后读数的帧数

  readonly maxHistory?: number;
}

type StabilizerMode = "seeking" | "locked" | "holding";

export class SustainedPitchStabilizer implements PitchStabilizer {
  private readonly options: SustainedPitchStabilizerOptions;
  private history: PitchReading[] = [];
  private mode: StabilizerMode = "seeking";
  private consecutiveFailures = 0;
  private holdCounter = 0;
  private lastValidReading: StabilizedPitchReading | null = null;

  constructor(options: SustainedPitchStabilizerOptions = {}) {
    this.options = {
      initialRequiredSamples: options.initialRequiredSamples ?? 3,
      initialCentsTolerance: options.initialCentsTolerance ?? 12,
      initialClarityThreshold: options.initialClarityThreshold ?? 0.82,
      sustainedClarityThreshold: options.sustainedClarityThreshold ?? 0.65, // 更宽松
      sustainedCentsTolerance: options.sustainedCentsTolerance ?? 18, // 更宽松
      maxConsecutiveFailures: options.maxConsecutiveFailures ?? 4, // 允许4帧失败
      holdFrames: options.holdFrames ?? 8, // 保持8帧（约600ms）
      maxHistory: options.maxHistory ?? 8,
    };
  }

  push(reading: PitchReading | null, targetHint: TuningTarget | null = null): StabilizedPitchReading | null {
    // 处理空读数
    if (!reading) {
      return this.handleNullReading();
    }

    const clarityThreshold =
      this.mode === "seeking"
        ? this.options.initialClarityThreshold!
        : this.options.sustainedClarityThreshold!;

    // 检查clarity是否足够
    if (reading.clarity < clarityThreshold) {
      return this.handleLowClarity(reading);
    }

    // 有效读数，重置失败计数
    this.consecutiveFailures = 0;
    this.holdCounter = 0;

    // 添加到历史
    this.history.push(reading);
    if (this.history.length > this.options.maxHistory!) {
      this.history.shift();
    }

    // 根据模式处理
    if (this.mode === "seeking") {
      return this.processSeekingMode(targetHint);
    } else {
      return this.processLockedMode(targetHint);
    }
  }

  private handleNullReading(): StabilizedPitchReading | null {
    this.consecutiveFailures++;

    // 如果在locked或holding模式，尝试保持
    if (this.mode === "locked" || this.mode === "holding") {
      if (this.consecutiveFailures <= this.options.maxConsecutiveFailures!) {
        // 进入holding模式，返回降级的读数
        this.mode = "holding";
        return this.createDegradedReading();
      }

      // 超过容错限制，开始hold倒计时
      if (this.holdCounter < this.options.holdFrames!) {
        this.holdCounter++;
        return this.createHoldReading();
      }

      // Hold期满，完全重置
      this.reset();
      return null;
    }

    // seeking模式下，直接重置
    this.reset();
    return null;
  }

  private handleLowClarity(reading: PitchReading): StabilizedPitchReading | null {
    this.consecutiveFailures++;

    // 如果已经locked，尝试容错
    if (this.mode === "locked" || this.mode === "holding") {
      if (this.consecutiveFailures <= this.options.maxConsecutiveFailures!) {
        // 仍然添加到历史，但标记为降级
        this.history.push(reading);
        if (this.history.length > this.options.maxHistory!) {
          this.history.shift();
        }
        this.mode = "holding";
        return this.createDegradedReading();
      }

      // 超过容错，进入hold
      if (this.holdCounter < this.options.holdFrames!) {
        this.holdCounter++;
        return this.createHoldReading();
      }

      this.reset();
      return null;
    }

    // seeking模式下，低clarity直接丢弃
    return null;
  }

  private processSeekingMode(targetHint: TuningTarget | null): StabilizedPitchReading | null {
    const requiredSamples = this.options.initialRequiredSamples!;
    const centsTolerance = this.options.initialCentsTolerance!;

    if (this.history.length < requiredSamples) {
      return null;
    }

    const recentWindow = this.history.slice(-requiredSamples);
    const target = targetHint ?? findClosestTuningTarget(recentWindow[0].frequencyHz);
    const referenceFrequencyHz = target?.frequencyHz ?? recentWindow[0].frequencyHz;
    const centsValues = recentWindow.map((item) => getCentsOffset(item.frequencyHz, referenceFrequencyHz));
    const spread = getSpreadInCents(centsValues);

    if (spread > centsTolerance) {
      return null;
    }

    // 首次锁定成功
    this.mode = "locked";
    const result = this.createStabilizedReading(recentWindow, target, referenceFrequencyHz, true);
    this.lastValidReading = result;
    return result;
  }

  private processLockedMode(targetHint: TuningTarget | null): StabilizedPitchReading | null {
    const centsTolerance = this.options.sustainedCentsTolerance!;
    const recentWindow = this.history.slice(-3); // 保持模式用更少样本

    if (recentWindow.length === 0) {
      return null;
    }

    const target = targetHint ?? this.lastValidReading?.target ?? findClosestTuningTarget(recentWindow[0].frequencyHz);
    const referenceFrequencyHz = target?.frequencyHz ?? recentWindow[0].frequencyHz;
    const centsValues = recentWindow.map((item) => getCentsOffset(item.frequencyHz, referenceFrequencyHz));
    const spread = getSpreadInCents(centsValues);

    const stable = spread <= centsTolerance;
    const result = this.createStabilizedReading(recentWindow, target, referenceFrequencyHz, stable);
    this.lastValidReading = result;
    return result;
  }

  private createStabilizedReading(
    window: PitchReading[],
    target: TuningTarget | null,
    referenceFrequencyHz: number,
    stable: boolean,
  ): StabilizedPitchReading {
    const frequencyHz = median(window.map((item) => item.frequencyHz));
    const clarity = average(window.map((item) => item.clarity));
    const rms = average(window.map((item) => item.rms ?? 0));
    const deviation = createDeviationFromCents(getCentsOffset(frequencyHz, referenceFrequencyHz));

    return {
      frequencyHz,
      clarity,
      timestampMs: window[window.length - 1].timestampMs,
      source: window[window.length - 1].source,
      rms,
      noteName: target?.note ?? window[window.length - 1].noteName,
      octave: target?.octave ?? window[window.length - 1].octave,
      cents: deviation.cents,
      stable,
      sampleCount: window.length,
      target,
    };
  }

  private createDegradedReading(): StabilizedPitchReading | null {
    if (!this.lastValidReading) {
      return null;
    }

    // 返回最后有效读数，但标记为不稳定
    return {
      ...this.lastValidReading,
      stable: false,
      clarity: Math.max(0.5, this.lastValidReading.clarity * 0.8), // 降低clarity表示降级
    };
  }

  private createHoldReading(): StabilizedPitchReading | null {
    if (!this.lastValidReading) {
      return null;
    }

    // 冻结最后读数
    return {
      ...this.lastValidReading,
      stable: false,
      clarity: Math.max(0.3, this.lastValidReading.clarity * 0.6), // 进一步降低clarity
    };
  }

  reset(): void {
    this.history = [];
    this.mode = "seeking";
    this.consecutiveFailures = 0;
    this.holdCounter = 0;
    this.lastValidReading = null;
  }

  // 调试接口
  getDebugInfo() {
    return {
      mode: this.mode,
      historyLength: this.history.length,
      consecutiveFailures: this.consecutiveFailures,
      holdCounter: this.holdCounter,
      hasLastValid: this.lastValidReading !== null,
    };
  }
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

function getSpreadInCents(values: number[]): number {
  if (values.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const smallest = Math.min(...values);
  const largest = Math.max(...values);
  return largest - smallest;
}
