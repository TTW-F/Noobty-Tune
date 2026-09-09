import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { AudioInputDevice } from "../../../lib/audio";

type MicPopoverProps = {
  availableInputs: readonly AudioInputDevice[];
  selectedInputDeviceId: string | null;
  activeInputLabel: string | null;
  /** 0..1 输入电平 */
  level: number;
  micLive: boolean;
  onRefresh: () => void;
  onSelect: (deviceId: string) => void;
};

/**
 * 顶栏麦克风入口:输入设备切换 + 实时电平 + 本地处理说明。
 */
export function MicPopover({
  availableInputs,
  selectedInputDeviceId,
  activeInputLabel,
  level,
  micLive,
  onRefresh,
  onSelect,
}: MicPopoverProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!anchorRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const levelPercent = Math.round(Math.min(1, Math.max(0, level)) * 100);

  return (
    <div className="mic-popover-anchor" ref={anchorRef}>
      <button
        type="button"
        className="mic-button"
        data-live={micLive}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mic-button-dot" aria-hidden="true" />
        <span className="mic-button-label">
          {micLive ? (activeInputLabel ?? "麦克风已就绪") : "选择麦克风"}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="mic-popover"
            role="dialog"
            aria-label="麦克风设置"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <p className="mic-popover-title">输入设备</p>

            <select
              className="mic-popover-select"
              value={selectedInputDeviceId ?? ""}
              onChange={(event) => {
                void onSelect(event.target.value);
              }}
              disabled={availableInputs.length === 0}
            >
              {availableInputs.length === 0 ? (
                <option value="">尚未检测到麦克风</option>
              ) : null}
              {availableInputs.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>

            <div className="mic-popover-row">
              <span>
                输入电平 <strong>{levelPercent}%</strong>
              </span>
              <button
                type="button"
                className="mic-popover-refresh"
                onClick={() => {
                  onRefresh();
                }}
              >
                刷新列表
              </button>
            </div>

            <div className="level-track" aria-hidden="true">
              <span
                className="level-fill"
                style={{ width: `${Math.max(levelPercent, level > 0 ? 6 : 0)}%` }}
              />
            </div>

            <div className="mic-popover-row">
              <span>
                当前生效 <strong>{activeInputLabel ?? "未开始"}</strong>
              </span>
            </div>

            <p className="mic-popover-privacy">
              音频只在浏览器本地分析,不会上传;页面也不会在加载时自动请求权限。
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
