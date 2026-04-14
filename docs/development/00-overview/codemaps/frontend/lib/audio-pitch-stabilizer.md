# Audio Pitch Stabilizer Codemap

- Domain: `frontend`
- Subsystem: `lib`
- Modules: `1`

## Modules
### `lib/audio/pitchStabilizer.ts`
- Imports: `../../types/tuner`, `../music`
- Exports: `PitchStabilizerOptions`, `PlaceholderPitchStabilizer`, `RollingPitchStabilizer`
- Main API:
  - `push(reading, targetHint?)` -> `StabilizedPitchReading | null`
  - `reset()` -> `void`
- Options (with defaults):
  - `requiredSamples` (`3`)
  - `centsTolerance` (`10`)
  - `clarityThreshold` (`0.8`)
  - `maxHistory` (`5`, and always `>= requiredSamples`)
- Stabilization behavior:
  - `reading` 为空时立即清空历史并返回 `null`
  - `reading.clarity < clarityThreshold` 时立即清空历史并返回 `null`
  - 仅使用最近 `requiredSamples` 的窗口计算稳定性
  - 若存在 `targetHint`，优先以 `targetHint.frequencyHz` 计算 cents；否则使用就近标准音
  - `spreadInCents <= centsTolerance` 时标记 `stable=true`
  - 输出频率取窗口中位数，`clarity/rms` 取窗口平均值
