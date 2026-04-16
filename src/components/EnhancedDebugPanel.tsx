/**
 * EnhancedDebugPanel - 增强调试面板
 * 
 * 显示四层数据流的完整信息：
 * 1. RawPitchCandidate - 原始候选
 * 2. PitchTrackingState - 跟踪状态
 * 3. TuningInterpretation - 调音解释
 * 4. TunerViewModel - 视图模型
 */

import "./EnhancedDebugPanel.css";
import type { RawPitchCandidate, PitchTrackingState, TuningInterpretation, TunerViewModel } from "../types/pitchTracking";

export interface EnhancedDebugPanelProps {
  readonly rawCandidate: RawPitchCandidate | null;
  readonly trackingState: PitchTrackingState | null;
  readonly interpretation: TuningInterpretation | null;
  readonly viewModel: TunerViewModel;
  readonly frameRms?: number | null;
  readonly framePeak?: number | null;
}

export function EnhancedDebugPanel({
  rawCandidate,
  trackingState,
  interpretation,
  viewModel,
  frameRms,
  framePeak,
}: EnhancedDebugPanelProps) {
  return (
    <div className="enhanced-debug-panel">
      <div className="debug-panel-header">
        <h3>增强调试面板</h3>
        <p className="debug-panel-subtitle">四层数据流实时监控</p>
      </div>

      <div className="debug-panel-grid">
        {/* 第一层：原始候选 */}
        <section className="debug-section">
          <h4 className="debug-section-title">
            <span className="debug-layer-badge debug-layer-badge--1">Layer 1</span>
            原始候选 (RawPitchCandidate)
          </h4>
          <div className="debug-metrics">
            <div className="debug-metric">
              <span className="debug-metric-label">频率 (Hz)</span>
              <strong className="debug-metric-value">
                {rawCandidate?.frequencyHz?.toFixed(2) ?? "null"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">清晰度</span>
              <strong className="debug-metric-value">
                {rawCandidate?.clarity.toFixed(3) ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">RMS</span>
              <strong className="debug-metric-value">
                {rawCandidate?.rms.toFixed(5) ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">Peak</span>
              <strong className="debug-metric-value">
                {rawCandidate?.peak.toFixed(5) ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">算法</span>
              <strong className="debug-metric-value">
                {rawCandidate?.algorithm ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">时间戳</span>
              <strong className="debug-metric-value debug-metric-value--small">
                {rawCandidate?.timestampMs ?? "---"}
              </strong>
            </div>
          </div>
          <div className="debug-status-bar">
            <span className={`debug-status-indicator ${rawCandidate?.frequencyHz ? "debug-status-indicator--active" : "debug-status-indicator--idle"}`}>
              {rawCandidate?.frequencyHz ? "有候选" : "无候选"}
            </span>
          </div>
        </section>

        {/* 第二层：跟踪状态 */}
        <section className="debug-section">
          <h4 className="debug-section-title">
            <span className="debug-layer-badge debug-layer-badge--2">Layer 2</span>
            跟踪状态 (PitchTrackingState)
          </h4>
          <div className="debug-metrics">
            <div className="debug-metric debug-metric--highlight">
              <span className="debug-metric-label">跟踪阶段</span>
              <strong className={`debug-metric-value debug-stage-badge debug-stage-badge--${trackingState?.stage ?? "idle"}`}>
                {trackingState?.stage ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">跟踪频率 (Hz)</span>
              <strong className="debug-metric-value">
                {trackingState?.trackedFrequencyHz?.toFixed(2) ?? "null"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">置信度</span>
              <strong className="debug-metric-value">
                {trackingState?.confidence.toFixed(3) ?? "---"}
              </strong>
              <div className="debug-metric-bar">
                <div 
                  className="debug-metric-bar-fill"
                  style={{ width: `${(trackingState?.confidence ?? 0) * 100}%` }}
                />
              </div>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">最后稳定频率 (Hz)</span>
              <strong className="debug-metric-value">
                {trackingState?.lastStableFrequencyHz?.toFixed(2) ?? "null"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">稳定持续时长 (ms)</span>
              <strong className="debug-metric-value">
                {trackingState?.stableDurationMs ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">剩余保持时间 (ms)</span>
              <strong className="debug-metric-value">
                {trackingState?.holdRemainingMs ?? "---"}
              </strong>
            </div>
            <div className="debug-metric debug-metric--warning">
              <span className="debug-metric-label">失配计数</span>
              <strong className="debug-metric-value">
                {trackingState?.mismatchCount ?? "---"}
              </strong>
            </div>
          </div>
          <div className="debug-status-bar">
            <span className={`debug-status-indicator debug-status-indicator--${getTrackingStatusColor(trackingState?.stage)}`}>
              {getTrackingStatusLabel(trackingState?.stage)}
            </span>
          </div>
        </section>

        {/* 第三层：调音解释 */}
        <section className="debug-section">
          <h4 className="debug-section-title">
            <span className="debug-layer-badge debug-layer-badge--3">Layer 3</span>
            调音解释 (TuningInterpretation)
          </h4>
          <div className="debug-metrics">
            <div className="debug-metric">
              <span className="debug-metric-label">检测频率 (Hz)</span>
              <strong className="debug-metric-value">
                {interpretation?.detectedFrequencyHz?.toFixed(2) ?? "null"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">检测音名</span>
              <strong className="debug-metric-value">
                {interpretation?.detectedNote ?? "---"}
              </strong>
            </div>
            <div className="debug-metric debug-metric--highlight">
              <span className="debug-metric-label">目标弦 ID</span>
              <strong className="debug-metric-value">
                {interpretation?.targetId ?? "null"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">目标频率 (Hz)</span>
              <strong className="debug-metric-value">
                {interpretation?.targetFrequencyHz?.toFixed(2) ?? "null"}
              </strong>
            </div>
            <div className="debug-metric debug-metric--highlight">
              <span className="debug-metric-label">偏差 (cents)</span>
              <strong className={`debug-metric-value ${getCentsColorClass(interpretation?.centsOffset)}`}>
                {interpretation?.centsOffset !== null && interpretation?.centsOffset !== undefined
                  ? `${interpretation.centsOffset > 0 ? "+" : ""}${interpretation.centsOffset.toFixed(1)}¢`
                  : "null"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">方向</span>
              <strong className={`debug-metric-value debug-direction-badge debug-direction-badge--${interpretation?.direction ?? "unknown"}`}>
                {interpretation?.direction ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">置信度</span>
              <strong className="debug-metric-value">
                {interpretation?.confidence.toFixed(3) ?? "---"}
              </strong>
            </div>
          </div>
          <div className="debug-status-bar">
            <span className={`debug-status-indicator debug-status-indicator--${getInterpretationStatusColor(interpretation)}`}>
              {getInterpretationStatusLabel(interpretation)}
            </span>
          </div>
        </section>

        {/* 第四层：视图模型 */}
        <section className="debug-section">
          <h4 className="debug-section-title">
            <span className="debug-layer-badge debug-layer-badge--4">Layer 4</span>
            视图模型 (TunerViewModel)
          </h4>
          <div className="debug-metrics">
            <div className="debug-metric debug-metric--highlight">
              <span className="debug-metric-label">UI 阶段</span>
              <strong className={`debug-metric-value debug-ui-stage-badge debug-ui-stage-badge--${viewModel.uiStage}`}>
                {viewModel.uiStage}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">显示频率</span>
              <strong className="debug-metric-value">
                {viewModel.displayFrequency}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">显示偏差</span>
              <strong className="debug-metric-value">
                {viewModel.displayCents}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">显示目标</span>
              <strong className="debug-metric-value">
                {viewModel.displayTarget ?? "null"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">Needle 位置</span>
              <strong className="debug-metric-value">
                {viewModel.needlePosition.toFixed(3)}
              </strong>
              <div className="debug-needle-preview">
                <div className="debug-needle-track">
                  <div 
                    className="debug-needle-indicator"
                    style={{ left: `${(viewModel.needlePosition + 1) * 50}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="debug-metric debug-metric--highlight">
              <span className="debug-metric-label">显示成功</span>
              <strong className={`debug-metric-value ${viewModel.showSuccess ? "debug-metric-value--success" : ""}`}>
                {viewModel.showSuccess ? "是" : "否"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">状态消息</span>
              <strong className="debug-metric-value debug-metric-value--small">
                {viewModel.statusMessage}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">置信度</span>
              <strong className="debug-metric-value">
                {viewModel.confidence.toFixed(3)}
              </strong>
            </div>
          </div>
          <div className="debug-status-bar">
            <span className={`debug-status-indicator ${viewModel.showSuccess ? "debug-status-indicator--success" : "debug-status-indicator--active"}`}>
              {viewModel.showSuccess ? "成功状态" : "正常状态"}
            </span>
          </div>
        </section>

        {/* 音频帧信息 */}
        <section className="debug-section debug-section--full">
          <h4 className="debug-section-title">
            <span className="debug-layer-badge debug-layer-badge--0">Layer 0</span>
            音频帧信息
          </h4>
          <div className="debug-metrics debug-metrics--horizontal">
            <div className="debug-metric">
              <span className="debug-metric-label">Frame RMS</span>
              <strong className="debug-metric-value">
                {frameRms?.toFixed(5) ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">Frame Peak</span>
              <strong className="debug-metric-value">
                {framePeak?.toFixed(5) ?? "---"}
              </strong>
            </div>
            <div className="debug-metric">
              <span className="debug-metric-label">信号强度</span>
              <div className="debug-signal-meter">
                <div 
                  className="debug-signal-meter-fill"
                  style={{ width: `${Math.min((frameRms ?? 0) / 0.03 * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 数据流图示 */}
      <section className="debug-flow-diagram">
        <h4 className="debug-section-title">数据流向</h4>
        <div className="debug-flow-chain">
          <div className={`debug-flow-node ${rawCandidate?.frequencyHz ? "debug-flow-node--active" : ""}`}>
            <span className="debug-flow-node-label">候选提取</span>
            <span className="debug-flow-node-value">
              {rawCandidate?.frequencyHz ? `${rawCandidate.frequencyHz.toFixed(1)} Hz` : "无候选"}
            </span>
          </div>
          <div className="debug-flow-arrow">→</div>
          <div className={`debug-flow-node ${trackingState?.stage !== "idle" && trackingState?.stage !== "lost" ? "debug-flow-node--active" : ""}`}>
            <span className="debug-flow-node-label">连续跟踪</span>
            <span className="debug-flow-node-value">{trackingState?.stage ?? "idle"}</span>
          </div>
          <div className="debug-flow-arrow">→</div>
          <div className={`debug-flow-node ${interpretation?.targetId ? "debug-flow-node--active" : ""}`}>
            <span className="debug-flow-node-label">调音解释</span>
            <span className="debug-flow-node-value">
              {interpretation?.targetId ?? "无目标"}
            </span>
          </div>
          <div className="debug-flow-arrow">→</div>
          <div className={`debug-flow-node ${viewModel.showSuccess ? "debug-flow-node--success" : "debug-flow-node--active"}`}>
            <span className="debug-flow-node-label">视图模型</span>
            <span className="debug-flow-node-value">{viewModel.uiStage}</span>
          </div>
        </div>
      </section>

      {/* 关键指标摘要 */}
      <section className="debug-summary">
        <h4 className="debug-section-title">关键指标摘要</h4>
        <div className="debug-summary-grid">
          <div className="debug-summary-card">
            <span className="debug-summary-label">当前阶段</span>
            <strong className="debug-summary-value">{trackingState?.stage ?? "---"}</strong>
          </div>
          <div className="debug-summary-card">
            <span className="debug-summary-label">跟踪频率</span>
            <strong className="debug-summary-value">
              {trackingState?.trackedFrequencyHz?.toFixed(2) ?? "---"} Hz
            </strong>
          </div>
          <div className="debug-summary-card">
            <span className="debug-summary-label">目标偏差</span>
            <strong className="debug-summary-value">
              {interpretation?.centsOffset !== null && interpretation?.centsOffset !== undefined
                ? `${interpretation.centsOffset > 0 ? "+" : ""}${interpretation.centsOffset.toFixed(1)}¢`
                : "---"}
            </strong>
          </div>
          <div className="debug-summary-card">
            <span className="debug-summary-label">失配计数</span>
            <strong className="debug-summary-value">{trackingState?.mismatchCount ?? "---"}</strong>
          </div>
          <div className="debug-summary-card">
            <span className="debug-summary-label">置信度</span>
            <strong className="debug-summary-value">
              {Math.round((trackingState?.confidence ?? 0) * 100)}%
            </strong>
          </div>
          <div className="debug-summary-card">
            <span className="debug-summary-label">UI 状态</span>
            <strong className="debug-summary-value">{viewModel.uiStage}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

// ===== 辅助函数 =====

function getTrackingStatusColor(stage?: PitchTrackingState["stage"]): string {
  switch (stage) {
    case "idle":
    case "lost":
      return "idle";
    case "acquiring":
      return "info";
    case "tracking":
      return "active";
    case "locked":
      return "success";
    case "degraded":
      return "warning";
    default:
      return "idle";
  }
}

function getTrackingStatusLabel(stage?: PitchTrackingState["stage"]): string {
  switch (stage) {
    case "idle":
      return "空闲状态";
    case "acquiring":
      return "正在获取";
    case "tracking":
      return "正在跟踪";
    case "locked":
      return "已锁定";
    case "degraded":
      return "信号降级";
    case "lost":
      return "已丢失";
    default:
      return "未知状态";
  }
}

function getInterpretationStatusColor(interpretation: TuningInterpretation | null): string {
  if (!interpretation) return "idle";
  
  if (interpretation.targetId && interpretation.direction === "in-tune") {
    return "success";
  }
  
  if (interpretation.targetId) {
    return "active";
  }
  
  return "info";
}

function getInterpretationStatusLabel(interpretation: TuningInterpretation | null): string {
  if (!interpretation) return "无解释";
  
  if (interpretation.targetId && interpretation.direction === "in-tune") {
    return "准确";
  }
  
  if (interpretation.targetId) {
    return `目标: ${interpretation.targetId}`;
  }
  
  return "检测中";
}

function getCentsColorClass(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  
  const absCents = Math.abs(cents);
  
  if (absCents <= 5) {
    return "debug-metric-value--success";
  }
  
  if (absCents <= 15) {
    return "debug-metric-value--warning";
  }
  
  return "debug-metric-value--error";
}
