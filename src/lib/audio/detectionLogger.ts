/**
 * Detection timeline logger for debugging sustained note tracking
 * Records complete detection pipeline state for analysis
 */

export interface DetectionLogEntry {
  readonly timestampMs: number;
  readonly frameRms: number;
  readonly framePeak: number;
  readonly detectedFrequencyHz: number | null;
  readonly detectedClarity: number | null;
  readonly comparisonFrequencyHz: number | null;
  readonly stabilizedFrequencyHz: number | null;
  readonly stabilizedStable: boolean | null;
  readonly uiStatus: string;
  readonly note: string;
}

export class DetectionTimelineLogger {
  private entries: DetectionLogEntry[] = [];
  private readonly maxEntries: number;
  private isRecording = false;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  startRecording(): void {
    this.isRecording = true;
    this.entries = [];
    console.log("🎙️ Detection timeline recording started");
  }

  stopRecording(): void {
    this.isRecording = false;
    console.log("⏹️ Detection timeline recording stopped");
  }

  log(entry: DetectionLogEntry): void {
    if (!this.isRecording) {
      return;
    }

    this.entries.push(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  getEntries(): readonly DetectionLogEntry[] {
    return [...this.entries];
  }

  exportToConsole(): void {
    console.log("📊 Detection Timeline Export");
    console.log("Total entries:", this.entries.length);
    console.table(
      this.entries.map((entry) => ({
        time: `${((entry.timestampMs - this.entries[0].timestampMs) / 1000).toFixed(2)}s`,
        rms: entry.frameRms.toFixed(4),
        peak: entry.framePeak.toFixed(3),
        detectedHz: entry.detectedFrequencyHz?.toFixed(2) ?? "null",
        clarity: entry.detectedClarity?.toFixed(3) ?? "null",
        comparisonHz: entry.comparisonFrequencyHz?.toFixed(2) ?? "null",
        stabilizedHz: entry.stabilizedFrequencyHz?.toFixed(2) ?? "null",
        stable: entry.stabilizedStable ?? "null",
        status: entry.uiStatus,
        note: entry.note,
      })),
    );
  }

  exportToCSV(): string {
    const headers = [
      "timestampMs",
      "relativeTimeS",
      "frameRms",
      "framePeak",
      "detectedFrequencyHz",
      "detectedClarity",
      "comparisonFrequencyHz",
      "stabilizedFrequencyHz",
      "stabilizedStable",
      "uiStatus",
      "note",
    ];

    const rows = this.entries.map((entry) => [
      entry.timestampMs,
      ((entry.timestampMs - this.entries[0].timestampMs) / 1000).toFixed(3),
      entry.frameRms.toFixed(6),
      entry.framePeak.toFixed(6),
      entry.detectedFrequencyHz?.toFixed(2) ?? "",
      entry.detectedClarity?.toFixed(4) ?? "",
      entry.comparisonFrequencyHz?.toFixed(2) ?? "",
      entry.stabilizedFrequencyHz?.toFixed(2) ?? "",
      entry.stabilizedStable ?? "",
      entry.uiStatus,
      entry.note,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  analyzeDropoutPoint(): void {
    if (this.entries.length === 0) {
      console.log("No entries to analyze");
      return;
    }

    console.log("\n🔍 Dropout Analysis");

    // Find where detection was lost
    let lastValidIndex = -1;
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].detectedFrequencyHz !== null) {
        lastValidIndex = i;
      }
    }

    if (lastValidIndex === -1) {
      console.log("No valid detection found in timeline");
      return;
    }

    const lastValid = this.entries[lastValidIndex];
    const timeFromStart = (lastValid.timestampMs - this.entries[0].timestampMs) / 1000;

    console.log(`Last valid detection at: ${timeFromStart.toFixed(2)}s`);
    console.log(`Last valid frequency: ${lastValid.detectedFrequencyHz?.toFixed(2)} Hz`);
    console.log(`Last valid clarity: ${lastValid.detectedClarity?.toFixed(3)}`);
    console.log(`Frame RMS at dropout: ${lastValid.frameRms.toFixed(4)}`);

    // Check what happened in next few frames
    const nextFrames = this.entries.slice(lastValidIndex + 1, lastValidIndex + 6);
    if (nextFrames.length > 0) {
      console.log("\nNext 5 frames after dropout:");
      console.table(
        nextFrames.map((entry, idx) => ({
          frame: idx + 1,
          rms: entry.frameRms.toFixed(4),
          detected: entry.detectedFrequencyHz !== null ? "yes" : "NO",
          stabilized: entry.stabilizedFrequencyHz !== null ? "yes" : "NO",
          status: entry.uiStatus,
        })),
      );
    }

    // Identify dropout cause
    console.log("\n🎯 Likely dropout cause:");
    if (lastValid.frameRms < 0.008) {
      console.log("❌ RMS dropped below detector threshold (0.008)");
    }
    if (lastValid.detectedClarity !== null && lastValid.detectedClarity < 0.82) {
      console.log("❌ Clarity dropped below detector threshold (0.82)");
    }
    if (nextFrames.length > 0 && nextFrames[0].frameRms > 0.008) {
      console.log("⚠️ RMS still healthy but detector returned null - algorithm issue");
    }
  }

  clear(): void {
    this.entries = [];
  }
}

// Global singleton for easy access
export const globalDetectionLogger = new DetectionTimelineLogger();
