# ADR 0006: 调弦层收敛为一个 deep module(`Tuning` 值 + `resolveTargets` 推导)

## 状态

Accepted

## 背景

V1 的 MVP 只支持六弦标准调弦,"当前调弦"这个概念没有正牌归属地,以隐式全局的形式散布在多个消费点:

- `src/lib/music/standardTuning.ts` 是一个 **shallow module**:接口 4 个导出,实现只有一张常量表加一次 record 查找。删除测试:删掉它,没有任何复杂度随之消失——它不是在"藏复杂度",只是被当全局变量用。
- `TuningInterpreter.interpret(trackingState, selection)` 的 **interface 在撒谎**:类型签名里看不到调弦,行为却依赖全局表 `getStandardTuningTarget()`(`tuningInterpreter.ts` 两处、`tunerState.ts` 一处、`useTunerPrototype.ts` 两处)。调用方必须知道一个签名之外的隐含不变量——"全局表里必须有这个 targetId"。
- `noteMapping.findClosestTuningTarget(freq, tuning = STANDARD_GUITAR_TUNING)` 类型上留了缝(seam),但默认参数导致唯一的语义消费方从不传它——一条没人跨过的缝。
- UI 三处(`StringRail.tsx`、`TunerScreen.tsx`、`demo.ts`)直接 import 常量。

接下来要做的功能层(预设调弦、自定义调弦、7 弦、A4 参考音、未来贝斯/尤克里里)全都会撞在这堵隐式墙上,所以先把缝立正,再加数据。

## 决策

新建 `src/lib/music/tuning.ts`(取代 `standardTuning.ts`),把"当前调弦"收敛为一个 **deep module**。

### 接口(interface,调用方需要知道的全部)

```ts
type TuningId = string; // "builtin:standard-e" | "custom:<uuid>"

/** 弦规格:存音名,不存频率。频率是推导出来的。 */
interface TuningStringSpec {
  readonly number: number;      // 弦号,1 = 最细弦(与现有 label 语义一致)
  readonly note: NoteName;
  readonly octave: number;
}

interface Tuning {
  readonly id: TuningId;
  readonly name: string;        // 显示名:"标准 E" / "Drop D"
  readonly kind: "builtin" | "custom";
  readonly strings: readonly TuningStringSpec[];
}

/** 唯一的推导入口:A4 参考音是参数,不是接缝。 */
function resolveTargets(tuning: Tuning, referenceA4Hz?: number): readonly TuningTarget[];

/** 内置目录(M1 只有 standard-e;M2 起加预设)。 */
const BUILTIN_TUNINGS: readonly Tuning[];
function getTuning(id: TuningId): Tuning | null;
```

逐帧热路径类型 `TuningTarget`(含预计算频率)保持不变——它是 resolve 之后的形态,interpreter 和 UI 消费它。

### 三个落点

1. **`TuningStringId` 泛化**:`"string-6" | … | "string-1"` 封闭联合改为模板字面量类型 `` `string-${number}` ``。弦 ID 变成位置编号,在任一调弦内唯一——迟滞状态和已调集合只需要这个保证。7 弦、贝斯 4 弦、尤克里里不再需要改类型。`STANDARD_TUNING_BY_ID` 这张全局 record 随之删除,查找改为在当前目标列表内 `find`。
2. **`TuningInterpreter` 改构造注入**:`new TuningInterpreter(targets: readonly TuningTarget[])`。换调弦 = 重建实例(或等价的 setTargets),sticky target 随实例丢弃——换调弦自动清迟滞,这条规则不需要额外的代码来表达。接口从此诚实:解释所需的全部信息都在构造参数和调用参数里。
3. **状态归口**:`TunerSelection` 增加 `tuningId`,变成 `{ tuningId, mode, targetId }`(selection 是"用户意图",持久化恢复时也要一个完整对象)。hook 层用 `useMemo` 从 `(tuning, a4)` 推导 targets,下发给 interpreter 和 UI;`tunerState.ts` 的 `getSelectedTarget` / `resolveActiveTarget` 增加 `targets` 参数,删除全局读取。UI 侧 `StringRail` 增加 `targets` prop,轨道列数由 `targets.length` 驱动;`TunerScreen` 的检测音匹配同样改用 prop。

### 考虑过并放弃的方案

- **全局 TuningCatalog 单例**(注册表 + 持久化 + 推导合一):interface 把纯计算和 I/O 混在一起,只想算目标频率的调用方被迫学会持久化——更浅,不是更深。
- **selection 携带完整 targets 列表**:逐帧热路径对象膨胀;selection 是意图,不是派生数据。
- **只给联合类型加一位 `"string-7"`**:每加一种乐器都要改类型和配套 record,模板字面量一次到位。

## 原因

- **深度即杠杆**:收敛后调用方只学 `Tuning` + `resolveTargets` 两个概念。M2 加预设 = 往 `BUILTIN_TUNINGS` 加数据;M3 转轮编辑器 = 改 `Tuning.strings` 的值;M4 的 7 弦 = 多一根弦的规格;贝斯/尤克里里 = 目录条目。全部不动检测管线和解释器。
- **局部性**:调弦知识(内置目录、推导数学、校验)集中一处;A4 参考音(440/432/415)因为"存规格、算频率"而免费获得。
- **接缝纪律**:调弦模块是依赖分类里的 in-process(纯计算),直接测接口,不需要 adapter。持久化(M3)是 local-substitutable,留在 hook 层,不进纯模块。十二平均律只有一种实现 = 假想接缝,不立 port。
- **可测性是这次重构的直接收益**:目前无法在不动全局的情况下测试"Open G 这类窄间隔调弦下迟滞是否成立";注入 targets 后,测试可以构造任意合成调弦过同一条缝。

## 影响

正面:

- 五个消费点的隐式全局依赖归零;`grep -r "getStandardTuningTarget\|STANDARD_GUITAR_TUNING" src` 在模块外零命中是 M1 的验收线。
- 换调弦清空迟滞与"已调"集合的行为有了单一、可推理的位置。

负面/成本:

- 一次性波及 `tuningInterpreter.ts`、`tunerState.ts`、`useTunerPrototype.ts`、`StringRail.tsx`、`TunerScreen.tsx`、`demo.ts` 及对应测试,行为必须保持不变(只挂 standard-e 一条目录)。
- `TUNING_INTERPRETER_CONTRACT.md` 中 "closest standard tuning target" 的措辞需同步更新。

## 测试策略(replace, don't layer)

- 新增:在 tuning 模块接口上测——`resolveTargets` 数学(E2@440 ≈ 82.41;A4=415 的整体平移)、目录健全性(每条内置的频率 ≈ 其音名+八度在 440 下的推导值)、同调弦内弦 ID 唯一。
- 保留:`tuningInterpreter.test.ts` 改为显式构造 targets 后过同一条缝,并补窄间隔合成调弦的迟滞边界用例。
- 删除:断言全局标准表形状的常量相等类测试,随 record 一起退役。

## 后续

- M2:目录扩充预设(Drop D、Eb、D Standard、Open G、Open D、DADGAD、B standard),预设条 UI 消费 `BUILTIN_TUNINGS`。换预设时按"目标频率未变的弦保留已调标记"做进度保留。
- M3:自定义调弦——**已完成**:`createCustomTuning` 工厂(完整校验)+ 编辑器(每弦一个密码锁式转轮,滚轮/↑↓/点击三种方式,↑ = 升高紧弦;4–8 弦增减;两弦同频高亮警示,unison 合法不阻止)+ 自定义 chip(选用/删除/＋新建)+ localStorage 注册表持久化,刷新恢复(选择校验回落)。真机待观察项:无。
- M4:7 弦低音弦检测专项——检测下限已从 70 Hz 降至 55 Hz(B1 ≈ 61.7 Hz 进入量程),合成拨弦管线测试(含基频衰减 16dB 变体)通过;**真机低音弦实测验收仍待做**,按 `docs/PITCH_TRACKER_CONFIG.md` 评估按频率自适应加长窗长。
