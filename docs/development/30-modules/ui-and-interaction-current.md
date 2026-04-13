# UI and Interaction Current

## 1. Scope

本文档描述当前 UI 组件、页面交互和状态展示的实际实现行为。

## 2. UI Composition

主要构成：

- 页面容器：`src/components/PageShell.tsx`
- 主按钮：`src/components/PrimaryButton.tsx`
- 状态卡片：`src/components/StatusCard.tsx`
- 调试读数：`src/components/DebugReadoutCard.tsx`
- 业务页面：`src/features/tuner/ui/TunerLandingScreen.tsx`

## 3. Interaction Entry

当前用户入口是 `TunerLandingScreen` 中的“开始调音”按钮：

- 点击后执行 `onStart`（来自 `useTunerPrototype.startTuning`）
- `isStarting=true` 时按钮禁用并显示“请求权限中...”
- 权限流程是显式触发，不在页面加载时自动请求

## 4. Status Rendering

页面通过 `getPromptFromState(state)` 将 `uiStatus` 映射为提示文案。

当前覆盖的状态文案：

- `idle`
- `requesting-permission`
- `permission-denied`
- `listening`
- `no-signal`
- `detecting`
- `unstable`
- `in-tune`
- `error`

说明：

- `no-signal` 在 UI 映射层已定义。
- 当前主 Hook 没有显式写入 `no-signal`，实际展示取决于上游状态机后续演进。

## 5. Debug Readout

`DebugReadoutCard` 目前分两块：

1. `Primary Tuner State`
   - `audioStatus`、`frequencyHz`、`noteLabel`、`cents`、`targetLabel`、`clarity`、`sampleCount`、`source`
2. `Detector Comparison`
   - `frameRms`
   - `primary` / `secondary` 算法频率与清晰度
   - `detectorDeltaHz`

注意：页面当前默认传入的是主链路数据；对比读数字段预留但未在主 Hook 中完整填充。

## 6. Error and Recovery

在 `permission-denied` 或 `error` 状态下会显示“重置状态”按钮：

- 点击后执行 `onReset`（`resetSession`）
- 重置会停止循环、释放音频资源，并回到 `INITIAL_TUNER_STATE`

## 7. Styling Status

当前真正生效的样式入口是：

- `src/main.tsx` -> `src/styles/globals.css`

仓库中仍存在 `src/index.css` 与 `src/App.css`，但当前入口未引入，属于遗留样式文件，不参与当前页面渲染。

## 8. UX Limits

- 目前没有手动选弦交互控件。
- 状态反馈依赖文字与 debug 卡片，尚未提供仪表化可视组件。
- 页面文案偏开发验证导向，产品化文案还未收敛。

## 9. Evidence Paths

- `src/features/tuner/ui/TunerLandingScreen.tsx`
- `src/components/PageShell.tsx`
- `src/components/PrimaryButton.tsx`
- `src/components/StatusCard.tsx`
- `src/components/DebugReadoutCard.tsx`
- `src/styles/globals.css`
- `src/main.tsx`
