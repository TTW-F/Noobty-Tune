/**
 * TimeSeriesLogger - 时序数据记录器
 * 
 * 用于记录四层数据流的时序变化，便于后续分析和调参
 */

import type {
  RawPitchCandidate,
  PitchTrackingState,
  TuningInterpretation,
  TunerViewModel,
} from "../../types/pitchTracking";

export interface TimeSeriesEntry {
  readonly timestampMs: number;
  readonly frameNumber: number;
  
  // Layer 0: Audio Frame
  readonly frameRms: number | null;
  readonly framePeak: number | null;
  
  // Layer 1: Raw Candidate
  readonly rawFrequencyHz: number | null;
  readonly rawClarity: number | null;
  readonly rawAlgorithm: string | null;
  
  // Layer 2: Tracking State
  readonly trackingStage: string | null;
  readonly trackedFrequencyHz: number | null;
  readonly trackingConfidence: number | null;
  readonly mismatchCount: number | null;
  readonly stableDurationMs: number | null;
  readonly holdRemainingMs: number | null;
  
  // Layer 3: Interpretation
  readonly detectedNote: string | null;
  readonly targetId: string | null;
  readonly centsOffset: number | null;
  readonly direction: string | null;
  
  // Layer 4: View Model
  readonly uiStage: string | null;
  readonly showSuccess: boolean;
  readonly needlePosition: number | null;
}

export class TimeSeriesLogger {
  private entries: TimeSeriesEntry[] = [];
  private frameNumber = 0;
  private isRecording = false;

  /**
   * 开始记录
   */
  startRecording(): void {
    this.isRecording = true;
    this.frameNumber = 0;
    this.entries = [];
    console.log("[TimeSeriesLogger] Recording started");
  }

  /**
   * 停止记录
   */
  stopRecording(): void {
    this.isRecording = false;
    console.log(`[TimeSeriesLogger] Recording stopped. Total frames: ${this.entries.length}`);
  }

  /**
   * 记录一帧数据
   */
  log(
    rawCandidate: RawPitchCandidate | null,
    trackingState: PitchTrackingState | null,
    interpretation: TuningInterpretation | null,
    viewModel: TunerViewModel,
    frameRms?: number | null,
    framePeak?: number | null
  ): void {
    if (!this.isRecording) {
      return;
    }

    this.frameNumber++;

    const entry: TimeSeriesEntry = {
      timestampMs: Date.now(),
      frameNumber: this.frameNumber,
      
      // Layer 0
      frameRms: frameRms ?? null,
      framePeak: framePeak ?? null,
      
      // Layer 1
      rawFrequencyHz: rawCandidate?.frequencyHz ?? null,
      rawClarity: rawCandidate?.clarity ?? null,
      rawAlgorithm: rawCandidate?.algorithm ?? null,
      
      // Layer 2
      trackingStage: trackingState?.stage ?? null,
      trackedFrequencyHz: trackingState?.trackedFrequencyHz ?? null,
      trackingConfidence: trackingState?.confidence ?? null,
      mismatchCount: trackingState?.mismatchCount ?? null,
      stableDurationMs: trackingState?.stableDurationMs ?? null,
      holdRemainingMs: trackingState?.holdRemainingMs ?? null,
      
      // Layer 3
      detectedNote: interpretation?.detectedNote ?? null,
      targetId: interpretation?.targetId ?? null,
      centsOffset: interpretation?.centsOffset ?? null,
      direction: interpretation?.direction ?? null,
      
      // Layer 4
      uiStage: viewModel.uiStage,
      showSuccess: viewModel.showSuccess,
      needlePosition: viewModel.needlePosition,
    };

    this.entries.push(entry);
  }

  /**
   * 获取所有记录
   */
  getEntries(): readonly TimeSeriesEntry[] {
    return this.entries;
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.entries = [];
    this.frameNumber = 0;
    console.log("[TimeSeriesLogger] Cleared all entries");
  }

  /**
   * 导出为 CSV
   */
  exportToCSV(): string {
    if (this.entries.length === 0) {
      return "No data to export";
    }

    // CSV 表头
    const headers = [
      "timestampMs",
      "frameNumber",
      "frameRms",
      "framePeak",
      "rawFrequencyHz",
      "rawClarity",
      "rawAlgorithm",
      "trackingStage",
      "trackedFrequencyHz",
      "trackingConfidence",
      "mismatchCount",
      "stableDurationMs",
      "holdRemainingMs",
      "detectedNote",
      "targetId",
      "centsOffset",
      "direction",
      "uiStage",
      "showSuccess",
      "needlePosition",
    ];

    // CSV 数据行
    const rows = this.entries.map((entry) => [
      entry.timestampMs,
      entry.frameNumber,
      entry.frameRms,
      entry.framePeak,
      entry.rawFrequencyHz,
      entry.rawClarity,
      entry.rawAlgorithm,
      entry.trackingStage,
      entry.trackedFrequencyHz,
      entry.trackingConfidence,
      entry.mismatchCount,
      entry.stableDurationMs,
      entry.holdRemainingMs,
      entry.detectedNote,
      entry.targetId,
      entry.centsOffset,
      entry.direction,
      entry.uiStage,
      entry.showSuccess,
      entry.needlePosition,
    ]);

    // 组装 CSV
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => cell ?? "null").join(",")),
    ].join("\n");

    return csv;
  }

  /**
   * 下载为 CSV 文件
   */
  downloadCSV(filename = "tuner-timeseries.csv"): void {
    const csv = this.exportToCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`[TimeSeriesLogger] Downloaded ${filename}`);
  }

  /**
   * 导出到控制台
   */
  exportToConsole(): void {
    if (this.entries.length === 0) {
      console.log("[TimeSeriesLogger] No data to export");
      return;
    }

    console.group(`[TimeSeriesLogger] Time Series Data (${this.entries.length} frames)`);
    console.table(this.entries);
    console.groupEnd();
  }

  /**
   * 分析状态转换
   */
  analyzeStateTransitions(): void {
    if (this.entries.length === 0) {
      console.log("[TimeSeriesLogger] No data to analyze");
      return;
    }

    const transitions: Array<{
      frame: number;
      from: string | null;
      to: string | null;
      duration: number;
    }> = [];

    let lastStage: string | null = null;
    let lastTransitionFrame = 0;

    this.entries.forEach((entry) => {
      if (entry.trackingStage !== lastStage) {
        if (lastStage !== null) {
          transitions.push({
            frame: entry.frameNumber,
            from: lastStage,
            to: entry.trackingStage,
            duration: entry.frameNumber - lastTransitionFrame,
          });
        }
        lastStage = entry.trackingStage;
        lastTransitionFrame = entry.frameNumber;
      }
    });

    console.group("[TimeSeriesLogger] State Transitions Analysis");
    console.table(transitions);
    console.groupEnd();
  }

  /**
   * 分析失配点
   */
  analyzeMismatchPoints(): void {
    if (this.entries.length === 0) {
      console.log("[TimeSeriesLogger] No data to analyze");
      return;
    }

    const mismatchPoints = this.entries.filter(
      (entry) => entry.mismatchCount !== null && entry.mismatchCount > 0
    );

    console.group(`[TimeSeriesLogger] Mismatch Points (${mismatchPoints.length} frames)`);
    console.table(
      mismatchPoints.map((entry) => ({
        frame: entry.frameNumber,
        stage: entry.trackingStage,
        mismatchCount: entry.mismatchCount,
        rawFrequency: entry.rawFrequencyHz,
        trackedFrequency: entry.trackedFrequencyHz,
        clarity: entry.rawClarity,
      }))
    );
    console.groupEnd();
  }

  /**
   * 分析锁定持续时间
   */
  analyzeLockDuration(): void {
    if (this.entries.length === 0) {
      console.log("[TimeSeriesLogger] No data to analyze");
      return;
    }

    const lockedFrames = this.entries.filter((entry) => entry.trackingStage === "locked");

    if (lockedFrames.length === 0) {
      console.log("[TimeSeriesLogger] No locked frames found");
      return;
    }

    const firstLocked = lockedFrames[0];
    const lastLocked = lockedFrames[lockedFrames.length - 1];
    const durationMs = lastLocked.timestampMs - firstLocked.timestampMs;
    const durationFrames = lastLocked.frameNumber - firstLocked.frameNumber;

    console.group("[TimeSeriesLogger] Lock Duration Analysis");
    console.log(`First locked frame: ${firstLocked.frameNumber}`);
    console.log(`Last locked frame: ${lastLocked.frameNumber}`);
    console.log(`Duration: ${durationMs} ms (${durationFrames} frames)`);
    console.log(`Average confidence: ${(lockedFrames.reduce((sum, f) => sum + (f.trackingConfidence ?? 0), 0) / lockedFrames.length).toFixed(3)}`);
    console.groupEnd();
  }

  /**
   * 生成完整分析报告
   */
  generateReport(): void {
    if (this.entries.length === 0) {
      console.log("[TimeSeriesLogger] No data to analyze");
      return;
    }

    console.group("[TimeSeriesLogger] Complete Analysis Report");
    
    console.log(`Total frames: ${this.entries.length}`);
    console.log(`Recording duration: ${this.entries[this.entries.length - 1].timestampMs - this.entries[0].timestampMs} ms`);
    
    this.analyzeStateTransitions();
    this.analyzeMismatchPoints();
    this.analyzeLockDuration();
    
    console.groupEnd();
  }
}

// 全局单例
export const globalTimeSeriesLogger = new TimeSeriesLogger();
