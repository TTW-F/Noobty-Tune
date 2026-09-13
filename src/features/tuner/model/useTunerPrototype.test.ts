import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadStoredSelection } from "./useTunerPrototype";
import { INITIAL_TUNER_STATE } from "./tunerState";
import { getTuning } from "../../../lib/music";
import type { Tuning } from "../../../types/tuner";

/** 含一个自定义调弦的解析器,覆盖"选中自定义调弦后刷新"的恢复路径。 */
const CUSTOM: Tuning = {
  id: "custom:test-1",
  name: "我的调弦",
  kind: "custom",
  strings: [
    { number: 6, note: "C", octave: 2 },
    { number: 5, note: "G", octave: 2 },
    { number: 4, note: "D", octave: 3 },
    { number: 3, note: "G", octave: 3 },
    { number: 2, note: "C", octave: 4 },
  ],
};

function resolverWithCustom(id: string): Tuning | null {
  return getTuning(id) ?? (id === CUSTOM.id ? CUSTOM : null);
}

/** 极简 localStorage 替身,让 loadStoredSelection 走真实解析路径。 */
function installFakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const fakeStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  // loadStoredSelection 只探测 typeof window !== "undefined"
  (globalThis as { window?: unknown }).window = { localStorage: fakeStorage };
  return {
    get: (key: string) => store.get(key) ?? null,
    uninstall: () => {
      delete (globalThis as { window?: unknown }).window;
    },
  };
}

beforeEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

test("falls back to defaults without a window", () => {
  assert.deepEqual(loadStoredSelection(getTuning), INITIAL_TUNER_STATE.selection);
});

test("restores a faithful auto selection", () => {
  const storage = installFakeStorage({
    "noobty-tuner:selection": JSON.stringify({ tuningId: "builtin:open-g", mode: "auto" }),
  });

  const selection = loadStoredSelection(getTuning);

  assert.deepEqual(selection, { tuningId: "builtin:open-g", mode: "auto", targetId: null });
  storage.uninstall();
});

test("restores a selection pointing at a custom tuning via the resolver", () => {
  const storage = installFakeStorage({
    "noobty-tuner:selection": JSON.stringify({ tuningId: CUSTOM.id, mode: "auto" }),
  });

  const selection = loadStoredSelection(resolverWithCustom);

  assert.deepEqual(selection, { tuningId: CUSTOM.id, mode: "auto", targetId: null });
  storage.uninstall();

  // 没带自定义注册表时,同一份存储回落默认
  assert.deepEqual(loadStoredSelection(getTuning), INITIAL_TUNER_STATE.selection);
});

test("restores manual mode only with a target that exists in the tuning", () => {
  const storage = installFakeStorage({
    "noobty-tuner:selection": JSON.stringify({
      tuningId: "builtin:open-g",
      mode: "manual",
      targetId: "string-3",
    }),
  });

  const selection = loadStoredSelection(getTuning);

  assert.deepEqual(selection, {
    tuningId: "builtin:open-g",
    mode: "manual",
    targetId: "string-3",
  });
  storage.uninstall();
});

test("manual mode without a usable target falls back to auto", () => {
  const storage = installFakeStorage({
    "noobty-tuner:selection": JSON.stringify({
      tuningId: "builtin:open-g",
      mode: "manual",
      targetId: null,
    }),
  });

  const selection = loadStoredSelection(getTuning);

  assert.equal(selection.mode, "auto");
  assert.equal(selection.targetId, null);
  storage.uninstall();
});

test("a manual target absent from the active tuning falls back to auto", () => {
  const storage = installFakeStorage({
    "noobty-tuner:selection": JSON.stringify({
      tuningId: "builtin:standard-e",
      mode: "manual",
      targetId: "string-7",
    }),
  });

  const selection = loadStoredSelection(getTuning);

  assert.equal(selection.mode, "auto");
  storage.uninstall();
});

test("an unknown tuning or corrupt payload returns the defaults", () => {
  const storage = installFakeStorage({
    "noobty-tuner:selection": JSON.stringify({ tuningId: "builtin:nope", mode: "auto" }),
  });
  assert.deepEqual(loadStoredSelection(getTuning), INITIAL_TUNER_STATE.selection);
  storage.uninstall();

  const broken = installFakeStorage({ "noobty-tuner:selection": "{not json" });
  assert.deepEqual(loadStoredSelection(getTuning), INITIAL_TUNER_STATE.selection);
  broken.uninstall();
});
