/**
 * Frequency history tracker for debugging and visualization
 * Maintains a rolling window of pitch detection results
 */

import type { PitchReading } from "../../types/tuner";

export interface FrequencyHistoryEntry {
  readonly frequencyHz: number;
  readonly clarity: number;
  readonly timestampMs: number;
  readonly rms: number;
  readonly noteName?: string;
  readonly octave?: number;
}

export interface FrequencyHistory {
  push(reading: PitchReading): void;
  getRecent(count: number): readonly FrequencyHistoryEntry[];
  getAll(): readonly FrequencyHistoryEntry[];
  getTimeRange(startMs: number, endMs: number): readonly FrequencyHistoryEntry[];
  getStatistics(): FrequencyStatistics;
  clear(): void;
}

export interface FrequencyStatistics {
  readonly count: number;
  readonly averageFrequency: number;
  readonly medianFrequency: number;
  readonly frequencyStdDev: number;
  readonly averageClarity: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  readonly timeSpanMs: number;
}

export class RollingFrequencyHistory implements FrequencyHistory {
  private entries: FrequencyHistoryEntry[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  push(reading: PitchReading): void {
    this.entries.push({
      frequencyHz: reading.frequencyHz,
      clarity: reading.clarity,
      timestampMs: reading.timestampMs,
      rms: reading.rms ?? 0,
      noteName: reading.noteName,
      octave: reading.octave,
    });

    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  getRecent(count: number): readonly FrequencyHistoryEntry[] {
    return this.entries.slice(-count);
  }

  getAll(): readonly FrequencyHistoryEntry[] {
    return [...this.entries];
  }

  getTimeRange(startMs: number, endMs: number): readonly FrequencyHistoryEntry[] {
    return this.entries.filter(
      (entry) => entry.timestampMs >= startMs && entry.timestampMs <= endMs,
    );
  }

  getStatistics(): FrequencyStatistics {
    if (this.entries.length === 0) {
      return {
        count: 0,
        averageFrequency: 0,
        medianFrequency: 0,
        frequencyStdDev: 0,
        averageClarity: 0,
        minFrequency: 0,
        maxFrequency: 0,
        timeSpanMs: 0,
      };
    }

    const frequencies = this.entries.map((e) => e.frequencyHz);
    const clarities = this.entries.map((e) => e.clarity);
    const timestamps = this.entries.map((e) => e.timestampMs);

    const averageFrequency = frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length;
    const averageClarity = clarities.reduce((sum, c) => sum + c, 0) / clarities.length;

    const sortedFrequencies = [...frequencies].sort((a, b) => a - b);
    const medianIndex = Math.floor(sortedFrequencies.length / 2);
    const medianFrequency =
      sortedFrequencies.length % 2 === 0
        ? (sortedFrequencies[medianIndex - 1] + sortedFrequencies[medianIndex]) / 2
        : sortedFrequencies[medianIndex];

    const variance =
      frequencies.reduce((sum, f) => sum + Math.pow(f - averageFrequency, 2), 0) /
      frequencies.length;
    const frequencyStdDev = Math.sqrt(variance);

    const minFrequency = Math.min(...frequencies);
    const maxFrequency = Math.max(...frequencies);
    const timeSpanMs = Math.max(...timestamps) - Math.min(...timestamps);

    return {
      count: this.entries.length,
      averageFrequency,
      medianFrequency,
      frequencyStdDev,
      averageClarity,
      minFrequency,
      maxFrequency,
      timeSpanMs,
    };
  }

  clear(): void {
    this.entries = [];
  }
}
