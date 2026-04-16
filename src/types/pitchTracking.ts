/**
 * 音高跟踪数据类型定义
 * 
 * 四层数据流：
 * 1. RawPitchCandidate - 候选提取层
 * 2. PitchTrackingState - 连续跟踪层
 * 3. TuningInterpretation - 调音解释层
 * 4. TunerViewModel - UI 展示层
 */

// ===== 第一层：原始候选 =====

/**
 * 原始音高候选
 * 
 * 职责：记录检测器从音频帧中提取的候选频率
 * 不负责判断"是否该显示给用户"
 */
export interface RawPitchCandidate {
  readonly frequencyHz: number | null;
  readonly clarity: number;           // 算法内部质量指标 (0-1)
  readonly rms: number;
  readonly peak: number;
  readonly timestampMs: number;
  readonly algorithm: "yin" | "autocorrelation";
}

// ===== 第二层：跟踪状态 =====

/**
 * 跟踪阶段
 * 
 * idle: 还没有有效输入
 * acquiring: 听到了可能的单音，但还没形成连续目标
 * tracking: 已经形成连续轨迹，但还不够稳
 * locked: 已稳定锁定
 * degraded: 还在跟踪，但可信度下降
 * lost: 原本锁定过，但现在确认已丢失
 */
export type TrackingStage = 
  | "idle"
  | "acquiring"
  | "tracking"
  | "locked"
  | "degraded"
  | "lost";

/**
 * 音高跟踪状态
 * 
 * 职责：维护一次拨弦后的连续 pitch 轨迹
 */
export interface PitchTrackingState {
  readonly trackedFrequencyHz: number | null;
  readonly confidence: number;                    // 综合置信度 (0-1)
  readonly stage: TrackingStage;
  readonly lastStableFrequencyHz: number | null;  // 最后一次稳定的频率
  readonly stableDurationMs: number;              // 已稳定持续时长
  readonly holdRemainingMs: number;               // 剩余保持时间
  readonly mismatchCount: number;                 // 连续失配次数
  readonly timestampMs: number;
}

// ===== 第三层：调音解释 =====

/**
 * 调音解释
 * 
 * 职责：根据 tracking 结果决定当前目标弦，计算偏差
 */
export interface TuningInterpretation {
  readonly detectedFrequencyHz: number | null;
  readonly detectedNote: string | null;          // 检测到的音名（可能与目标不同）
  readonly targetId: TuningStringId | null;      // 目标弦ID
  readonly targetFrequencyHz: number | null;     // 目标频率
  readonly centsOffset: number | null;           // 偏差（cents）
  readonly direction: "flat" | "sharp" | "in-tune" | "unknown";
  readonly confidence: number;
  readonly trackingStage: TrackingStage;
}

// ===== 第四层：UI 视图模型 =====

/**
 * UI 状态
 * 
 * 从底层 tracking stage 派生
 */
export type TunerUiStage =
  | "idle"
  | "acquiring"
  | "tracking"
  | "locked"
  | "degraded"
  | "lost"
  | "permission-denied"
  | "error";

/**
 * 调音器视图模型
 * 
 * 职责：把调音语义翻译成 UI 需要的展示字段
 */
export interface TunerViewModel {
  readonly uiStage: TunerUiStage;
  readonly displayFrequency: string;             // "82.4 Hz" 或 "E2"
  readonly displayCents: string;                 // "+12¢" 或 "---"
  readonly displayTarget: string | null;         // "E2 (6弦)"
  readonly needlePosition: number;               // -1 到 1
  readonly showSuccess: boolean;                 // 是否显示成功状态
  readonly statusMessage: string;                // "正在跟踪..." / "信号变弱" / "请重新拨弦"
  readonly confidence: number;
}

// ===== 跟踪器配置 =====

/**
 * 跟踪器参数
 * 
 * 双阈值模型：锁定阶段严格，保持阶段宽松
 */
export interface PitchTrackerConfig {
  // 锁定阶段参数
  readonly lockClarityThreshold: number;         // 锁定所需的最低清晰度
  readonly lockRequiredFrames: number;           // 锁定所需的连续帧数
  readonly maxFrequencyJumpCents: number;        // 允许的最大频率跳变（cents）
  
  // 保持阶段参数
  readonly holdClarityThreshold: number;         // 保持所需的最低清晰度（更宽松）
  readonly holdDurationMs: number;               // 短时失配保持时间
  
  // 释放条件
  readonly releaseAfterMisses: number;           // 连续失配多少次后释放
  
  // 其他
  readonly maxHistoryFrames: number;             // 最大历史帧数
}

export const DEFAULT_TRACKER_CONFIG: PitchTrackerConfig = {
  lockClarityThreshold: 0.82,
  lockRequiredFrames: 3,
  maxFrequencyJumpCents: 50,
  
  holdClarityThreshold: 0.50,
  holdDurationMs: 600,
  
  releaseAfterMisses: 8,
  
  maxHistoryFrames: 12,
};
import type { TuningStringId } from "./tuner";
