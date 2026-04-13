# Guitar Tuner Web V1 分析草案

## 1. 项目目标

做一款聚焦 `Web` 端的 `guitar tuner`，优先验证以下能力：

- 浏览器内直接使用，无需下载安装
- 通过麦克风实时识别吉他单弦音高
- 用清晰、低学习成本的界面反馈当前弦音是否偏高或偏低
- 在核心体验稳定后，为桌面端和 App 复用同一套音高识别逻辑创造条件

这意味着当前阶段的目标不是“做一个功能很多的音乐工具箱”，而是先把“快、稳、准、易懂”的调音体验跑通。

## 2. 从已有实现里学到什么

### Fender Online Guitar Tuner

可借鉴点：

- 覆盖范围清晰，首页直接告诉用户支持 acoustic / electric / bass / ukulele，以及 `22` 种调弦选项。
- 面向新手很友好，不只给工具，也补了基础调音说明，比如标准调弦顺序、sharp/flat 的理解方式。
- “先让用户成功，再引导扩展能力”的路径很明确。

对我们的启发：

- Web V1 首页要非常直接，用户打开就知道“支持什么乐器/调弦”“下一步点哪里”。
- 即使主功能是调音，也应提供极轻量的新手提示，不必把用户扔给空白仪表盘。

来源：

- Fender Online Guitar Tuner: https://www.fender.com/online-guitar-tuner/

### GuitarTuna Online Guitar Tuner

可借鉴点：

- 交互文案非常直接，先 `Tap to tune`，再授权麦克风。
- 支持不同 string count，且会同步更新目标音高。
- 明确告诉用户影响准确率的外部因素：背景噪声、拨弦力度、设备距离、温湿度漂移。
- 提供“听音调弦”的后备路径，避免麦克风不可用时功能彻底失效。

对我们的启发：

- Web V1 需要把“开始调音”设计成一个明确的用户动作，不能页面加载就默默申请权限。
- 必须有异常/弱信号提示，而不是识别不到时只是界面不动。
- 最好在 V1 就预留参考音功能或至少预留交互位。

来源：

- GuitarTuna Online Guitar Tuner: https://guitartuna.com/online-guitar-tuner
- GuitarTuna 首页: https://guitartuna.com/

### 开源参考：PitchDetect

可借鉴点：

- 它证明了“浏览器 + Web Audio + 自动相关法”足以做出可运行的实时音高检测原型。
- 代码体量不大，适合拿来理解浏览器音高检测的最小闭环。

需要规避的坑：

- 该项目 README 明确提到，自动相关法在强泛音场景下会被干扰。
- 这类 demo 更适合作为原型起点，不适合直接当生产方案。

对我们的启发：

- 原型阶段可以先用成熟的自动相关/YIN 路线快速验证。
- 真正上线前必须补上信号门限、稳定化、异常值抑制和 UI 去抖。

来源：

- PitchDetect: https://github.com/cwilso/PitchDetect

## 3. 现阶段产品定义

### 产品定位

- 一个打开即用的浏览器吉他调音器
- 优先服务普通用户和初学者
- 默认场景是“给六弦吉他快速调到标准音”

### 建议的 V1 范围

建议 `只做`：

- 六弦吉他
- 标准调弦 `E2 A2 D3 G3 B3 E4`
- 麦克风输入
- 单弦实时识别
- 当前目标弦、当前检测音高、偏差方向、偏差幅度展示
- 授权失败 / 无输入 / 信号太弱 / 环境太吵时的明确提示
- 移动端和桌面浏览器可用

建议 `先不做`：

- 多乐器
- 大量 alternate tunings
- 多弦同时识别
- 账号系统
- 教学社区、歌曲库、节拍器等周边能力
- 云端音频上传分析

原因很简单：V1 的最大风险不在功能不够多，而在“低弦识别是否稳”“浏览器权限与延迟是否可控”“新手能否一次上手”。

## 4. 用户流程草案

建议主流程：

1. 用户进入页面
2. 页面直接说明“这是一个 Web 吉他调音器，点击开始后会请求麦克风权限”
3. 用户点击“开始调音”
4. 浏览器请求麦克风权限
5. 进入调音界面，默认显示标准调弦六根弦
6. 用户拨动某一根弦
7. 页面显示：
   - 当前识别到的音名
   - 目标音名
   - 当前偏高 / 偏低
   - 距离目标的 cents 偏差
   - 稳定度状态
8. 达到稳定命中后，高亮“已调准”

异常流程也要明确：

- 权限被拒绝：给出重新授权说明
- 浏览器不支持：给出兼容性说明
- 没有可识别输入：提示靠近麦克风、单独拨弦、降低环境噪声
- 信号不稳定：提示延长延音或减小杂音

## 5. 技术方案方向

### 浏览器能力边界

`getUserMedia()` 是 Web 端麦克风采集入口，但有两个硬条件：

- 必须在安全上下文里运行，通常意味着 `HTTPS` 或 `localhost`
- 必须由用户明确授权

这决定了我们从一开始就要围绕“用户触发后再初始化音频”来设计交互，而不是自动启动。

来源：

- MDN `getUserMedia()`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

### 音频处理模型

Web Audio API 现在更推荐 `AudioWorklet` 路线，而不是 `ScriptProcessorNode`。MDN 明确说明了：

- `AudioWorklet` 运行在音频渲染线程之外的专用环境
- `ScriptProcessorNode` 因为运行在主线程，性能较差，且已被标记为 deprecated

对我们的意义：

- 如果只是做最早期验证，可以先用简单处理链跑通
- 但正式实现最好从一开始就按 `AudioWorklet` 组织实时音频处理，避免后期返工

来源：

- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
- MDN AudioWorkletProcessor: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor

### 音高检测候选

建议优先考虑两条路线：

1. `YIN`
- `pitchfinder` 项目给出的经验是：YIN 在准确率和速度之间平衡最好
- 但也会偶尔给出明显错误值，所以不能裸用结果直接驱动 UI

2. 自动相关法
- `PitchDetect` 的实现简单、易懂，适合原型验证
- 但在强泛音、噪声和复杂波形下更容易抖动

来源：

- pitchfinder: https://github.com/peterkhayes/pitchfinder
- PitchDetect: https://github.com/cwilso/PitchDetect
- aubio pitch docs: https://aubio.org/doc/0.4.4/pitch_8h.html

### 推荐的 V1 技术判断

建议：

- 先做纯前端本地处理，不上传音频
- 先以单音、标准调弦为目标
- 检测算法优先尝试 `YIN`，并在 UI 层加稳定窗口和异常值过滤
- 保留后续切换到底层更强实现的空间，比如 `aubio` / `WASM`

## 6. 必须提前规避的坑

### 1. 权限和部署坑

- 不是 HTTPS 或 localhost 时，麦克风无法正常工作
- 用户可能长时间不做权限选择，因此“点击开始后无反应”必须有等待态提示

### 2. 低频识别坑

- 吉他的低 E 约 `82.41Hz`，比很多 demo 场景更难稳定识别
- 一些更快的算法会在低频段表现不稳，不能只拿高音弦测试

### 3. 泛音和噪声坑

- 拨弦初始瞬态、泛音、环境噪声都可能导致检测跳到错误音名
- 不能把每一帧检测值直接映射到 UI，否则指针会抖动得很难用

### 4. 主线程卡顿坑

- 如果音频处理和 UI 更新都堆在主线程，页面轻微卡顿都会影响识别稳定性
- 这也是为什么正式实现要优先考虑 `AudioWorklet`

### 5. “能检测”不等于“能调音”

- 用户真正关心的不是你识别出一个频率，而是“我现在该往哪边拧，还差多少”
- 所以产品上必须把结果翻译成非常直接的反馈：目标弦、偏高偏低、是否已稳定命中

## 7. 适合立刻产出的研发文档

接下来建议在这个项目里继续补齐这三份文档：

- `PRD / V1 范围文档`
- `技术设计草案`
- `验收标准与测试场景`

建议测试场景至少覆盖：

- 安静环境 / 嘈杂环境
- 手机浏览器 / 桌面浏览器
- 低 E / 高 E
- 快速短拨 / 正常延音
- 权限拒绝 / 无麦克风设备 / 不支持浏览器

## 8. 当前最务实的下一步

建议按这个顺序推进：

1. 锁定 V1 只做六弦吉他标准调弦
2. 明确一版交互草图和状态机
3. 做浏览器原型，先验证低 E 到高 E 的稳定识别
4. 通过实际测试再决定是否需要 `WASM` 或更强算法
5. 稳定后再扩展 alternate tunings、多乐器和多端

## 参考链接

- Fender Online Guitar Tuner: https://www.fender.com/online-guitar-tuner/
- GuitarTuna Online Guitar Tuner: https://guitartuna.com/online-guitar-tuner
- GuitarTuna: https://guitartuna.com/
- MDN getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- MDN AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
- MDN AudioWorkletProcessor: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor
- PitchDetect: https://github.com/cwilso/PitchDetect
- pitchfinder: https://github.com/peterkhayes/pitchfinder
- aubio pitch docs: https://aubio.org/doc/0.4.4/pitch_8h.html
