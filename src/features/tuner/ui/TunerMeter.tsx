import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { FeedbackTone } from "./feedback";

type TunerMeterProps = {
  tone: FeedbackTone;
  /** -50..50,线性音分满量程 */
  needlePercent: number;
  needleActive: boolean;
};

const TICKS = Array.from({ length: 21 }, (_, index) => (index - 10) * 5);

/**
 * 签名仪表:录音室刻度钢带。
 * 线性 ±50 音分,中央 ±5 音分为绿色准音门,
 * 指针由弹簧驱动(帧数据约 13Hz,视觉 60fps)。
 */
export function TunerMeter({ tone, needlePercent, needleActive }: TunerMeterProps) {
  const reducedMotion = useReducedMotion();
  const source = useMotionValue(needlePercent);
  const spring = useSpring(source, { stiffness: 170, damping: 22, mass: 0.55 });
  const left = useTransform(spring, (latest) => `${50 + latest}%`);

  useEffect(() => {
    source.set(needlePercent);
    if (reducedMotion) {
      spring.jump(needlePercent);
    }
  }, [needlePercent, source, spring, reducedMotion]);

  return (
    <div className="meter" data-tone={needleActive ? tone : "idle"} aria-hidden="true">
      <div className="meter-field">
        <div className="meter-gate" />
        <div className="meter-ticks">
          {TICKS.map((cents) => (
            <span key={cents} className="meter-tick" data-major={cents % 25 === 0} />
          ))}
        </div>
        <motion.div className="meter-needle" style={{ left }} />
      </div>

      <div className="meter-lamps">
        <span className="meter-lamp meter-lamp--left">
          <i />
          偏低
        </span>
        <span className="meter-lamp meter-lamp--center">
          <i />
          音准
        </span>
        <span className="meter-lamp meter-lamp--right">
          <i />
          偏高
        </span>
      </div>

      <div className="meter-scale" aria-hidden="true">
        <span>-50¢</span>
        <span>-25</span>
        <span>0</span>
        <span>+25</span>
        <span>+50¢</span>
      </div>
    </div>
  );
}
