import { useEffect, useRef } from "react";
import type { LiveAudioSample } from "../model/useTunerPrototype";

type StringLineProps = {
  liveRef: { readonly current: LiveAudioSample };
};

const WIDTH = 420;
const HEIGHT = 34;

/**
 * 一根待命的琴弦:麦克风收到声音时按输入能量"振动"。
 * 同时是"麦克风活着"的直觉反馈——用户拨弦,线就动。
 */
export function StringLine({ liveRef }: StringLineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const envelopeRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    context.scale(dpr, dpr);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let lastTime = performance.now();

    const draw = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const sample = liveRef.current;
      const live = sample.rms > 0;
      const targetEnvelope = Math.min(1, sample.rms * 42);
      envelopeRef.current += (targetEnvelope - envelopeRef.current) * Math.min(1, dt * 10);
      const envelope = envelopeRef.current;

      context.clearRect(0, 0, WIDTH, HEIGHT);
      const midY = HEIGHT / 2;

      if (!reducedMotion && live && envelope > 0.005) {
        // 拨弦后的驻波:主谐波 + 一点泛音,相位按检测频率推进
        phaseRef.current += dt * (6 + (sample.frequencyHz ?? 110) / 18);
        const amplitude = envelope * (HEIGHT / 2 - 4);
        context.beginPath();
        for (let x = 0; x <= WIDTH; x += 2) {
          const taper = Math.sin((x / WIDTH) * Math.PI);
          const wave =
            Math.sin((x / WIDTH) * Math.PI * 2 * 2 + phaseRef.current) * 0.8 +
            Math.sin((x / WIDTH) * Math.PI * 2 * 5 + phaseRef.current * 1.6) * 0.2;
          const y = midY + wave * amplitude * taper;
          if (x === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.strokeStyle = `rgba(255, 179, 71, ${0.3 + envelope * 0.55})`;
        context.lineWidth = 1.4;
        context.stroke();
      } else {
        // 静止的弦
        context.beginPath();
        context.moveTo(0, midY);
        context.lineTo(WIDTH, midY);
        context.strokeStyle = live
          ? "rgba(255, 179, 71, 0.35)"
          : "rgba(237, 232, 220, 0.14)";
        context.lineWidth = 1.2;
        context.stroke();
      }

      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(raf);
      context.setTransform(1, 0, 0, 1, 0, 0);
    };
  }, [liveRef]);

  return (
    <canvas
      ref={canvasRef}
      className="string-line"
      aria-hidden="true"
    />
  );
}
