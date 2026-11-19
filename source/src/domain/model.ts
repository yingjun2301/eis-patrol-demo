export type ObjectId = "A" | "B" | "C" | "zone-a";
export type Phase =
  | "idle"
  | "clarify"
  | "preview"
  | "preparing"
  | "preparationFailed"
  | "retrying"
  | "scheduled"
  | "dispatching"
  | "running"
  | "paused"
  | "stopped"
  | "completed";
export type RouteOrder = "forward" | "reverse";
export type StartTime =
  { kind: "immediate" } | { kind: "scheduled"; at: number };
export type Point = { x: number; y: number };
export type Device = {
  id: "A" | "B" | "C";
  online: boolean;
  battery: number;
  task: string;
  position: Point;
  location: string;
  freshness: "snapshot" | "unknown";
};
export const initialDevices: Device[] = [
  {
    id: "A",
    online: true,
    battery: 80,
    task: "空闲",
    position: { x: 225, y: 470 },
    location: "西侧集结点",
    freshness: "snapshot",
  },
  {
    id: "B",
    online: true,
    battery: 35,
    task: "空闲",
    position: { x: 710, y: 240 },
    location: "北侧仓储区",
    freshness: "snapshot",
  },
  {
    id: "C",
    online: false,
    battery: 90,
    task: "无法获取",
    position: { x: 770, y: 590 },
    location: "东侧码头 · 已知位置",
    freshness: "unknown",
  },
];
export const originalRequest =
  "帮我查看港区3台设备的状态，把在线且电量超过50%的设备安排去巡检A区。";
export const labelOf = (id: ObjectId) =>
  id === "zone-a" ? "A 区" : "设备 " + id;
export const eligibility = (d: Device) =>
  !d.online
    ? { eligible: false, reason: "离线，无法执行" }
    : d.battery <= 50
      ? { eligible: false, reason: "电量 " + d.battery + "%，未超过 50%" }
      : { eligible: true, reason: "在线，电量 " + d.battery + "% > 50%" };
export const fmtDate = (at: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
export const fmtTime = (at: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(at);
export const startLabel = (s: StartTime | null) =>
  !s
    ? "待补充开始时间"
    : s.kind === "immediate"
      ? "确认后立即开始"
      : fmtDate(s.at) + "（北京时间）";
export type TaskUpdate = {
  id: number;
  text: string;
  at: number;
  kind: "progress" | "failure" | "question" | "result";
};
export type Message = {
  id: number;
  role: "user" | "agent";
  text: string;
  kind?: "filter" | "event" | "task" | "failure" | "setup" | "inventory";
  simulatedDurationMs?: number;
  planReceipt?: Plan;
  taskId?: string;
  taskUpdates?: TaskUpdate[];
  refs?: ObjectId[];
  at: number;
};
export type Plan = {
  id: string;
  revision: number;
  deviceId: "A";
  regionId: "zone-a";
  order: RouteOrder;
  start: StartTime | null;
};
export type State = {
  devices: Device[];
  phase: Phase;
  plan: Plan | null;
  messages: Message[];
  activeTaskMessageId: number | null;
  focused: ObjectId | null;
  focusNonce: number;
  context: ObjectId[];
  filtered: boolean;
  planningRegion: "zone-a" | null;
  confirmedRevision: number | null;
  preparedRevision: number | null;
  faultNext: boolean;
  progress: number;
  dispatchCount: number;
  now: number;
  session: number;
  error: string | null;
};
export function currentTask(s: State, id: Device["id"]): string {
  if (id === "A" && s.phase === "running") return "A 区巡检中";
  if (id === "A" && s.phase === "paused") return "A 区巡检已暂停";
  if (id === "A" && s.phase === "scheduled") return "等待巡检";
  return s.devices.find((d) => d.id === id)!.task;
}
export function initialState(now = Date.now(), session = 1): State {
  return {
    devices: initialDevices.map((d) => ({ ...d })),
    phase: "idle",
    plan: null,
    messages: [],
    activeTaskMessageId: null,
    focused: null,
    focusNonce: 0,
    context: [],
    filtered: false,
    planningRegion: null,
    confirmedRevision: null,
    preparedRevision: null,
    faultNext: false,
    progress: 0,
    dispatchCount: 0,
    now,
    session,
    error: null,
  };
}
export type Action =
  | { type: "SEND"; text: string }
  | { type: "FILTER"; criteriaConfirmed: true }
  | { type: "INSPECT_DEVICES" }
  | { type: "START_PLANNING" }
  | { type: "FOCUS"; id: ObjectId | null }
  | { type: "ADD_CONTEXT"; id: ObjectId }
  | { type: "REMOVE_CONTEXT"; id: ObjectId }
  | { type: "UPDATE_PLAN"; start: StartTime | null; order: RouteOrder }
  | { type: "CONFIRM"; revision: number; now: number }
  | { type: "PREPARED"; session: number; revision: number; ok: boolean }
  | { type: "RETRY"; now: number }
  | { type: "TICK"; now: number }
  | { type: "FAST_FORWARD" }
  | { type: "ACK"; session: number; revision: number }
  | { type: "PROGRESS"; session: number; progress: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "SET_FAULT"; enabled: boolean }
  | { type: "RESET"; now: number };
const add = (
  s: State,
  role: Message["role"],
  text: string,
  extra: Partial<Message> = {},
): State => ({
  ...s,
  messages: [
    ...s.messages,
    {
      id: (s.messages.at(-1)?.id ?? 0) + 1,
      role,
      text,
      at: s.now,
      ...(role === "agent"
        ? { simulatedDurationMs: 1200 + (s.messages.length % 3) * 400 }
        : {}),
      ...extra,
    },
  ],
});
// A confirmed task owns one assistant reply. Its card and ordered progress stay
// together, while user interruptions and their answers remain separate messages.
const taskReply = (
  s: State,
  text: string,
  extra: Partial<Message> = {},
  updateKind: TaskUpdate["kind"] = extra.kind === "failure"
    ? "failure"
    : "progress",
): State => {
  const active = s.messages.find(
    (m) =>
      m.id === s.activeTaskMessageId &&
      m.taskId === s.plan?.id &&
      m.taskUpdates !== undefined,
  );
  if (active) {
    const update: TaskUpdate = {
      id: (active.taskUpdates!.at(-1)?.id ?? 0) + 1,
      text,
      at: s.now,
      kind: updateKind,
    };
    return {
      ...s,
      messages: s.messages.map((m) =>
        m.id === active.id
          ? { ...m, taskUpdates: [...m.taskUpdates!, update] }
          : m,
      ),
    };
  }
  const next = add(s, "agent", text, extra);
  return {
    ...next,
    activeTaskMessageId: s.activeTaskMessageId ?? next.messages.at(-1)!.id,
  };
};
function startPlanning(s: State, text = "创建巡检任务"): State {
  if (s.plan)
    return add(s, "agent", "已有巡检计划，可以继续处理或修改当前计划。");
  const n = add({ ...s, context: [] }, "user", text, { refs: s.context });
  if (s.messages.some((m) => m.kind === "setup"))
    return add(
      n,
      "agent",
      "可以选择预设设备筛选条件，也可以先查看设备状态，再告诉我你的筛选要求。",
    );
  return add(n, "agent", "这次要巡检哪个区域？", {
    kind: "setup",
  });
}
const editable = (s: State) => s.phase === "clarify" || s.phase === "preview";
function begin(s: State, text = originalRequest): State {
  if (s.plan)
    return add(s, "agent", "当前已有巡检计划，请在任务卡中修改或继续。");
  let n = add(s, "user", text, { refs: s.context });
  n = {
    ...n,
    context: [],
    filtered: true,
    planningRegion: "zone-a",
    focused: null,
    focusNonce: n.focusNonce + 1,
    phase: "clarify",
    plan: {
      id: "PT-001",
      revision: 1,
      deviceId: "A",
      regionId: "zone-a",
      order: "forward",
      start: null,
    },
  };
  return taskReply(n, "仅设备 A 符合条件；B 未达电量要求，C 离线。", {
    kind: "filter",
    refs: ["A", "zone-a"],
  });
}
function updatePlan(
  s: State,
  start: StartTime | null,
  order: RouteOrder,
  fromConversation = false,
): State {
  if (!s.plan || !editable(s)) return s;
  if (start?.kind === "scheduled" && start.at <= s.now)
    return { ...s, error: "请选择晚于当前时间的开始时间。" };
  const n = {
    ...s,
    plan: { ...s.plan, start, order, revision: s.plan.revision + 1 },
    focused: null,
    phase: (start ? "preview" : "clarify") as Phase,
    confirmedRevision: null,
    preparedRevision: null,
    error: null,
  };
  if (!fromConversation) return n;
  return add(
    n,
    "agent",
    "计划已更新：" +
      startLabel(start) +
      "，" +
      (order === "forward" ? "顺向巡检" : "逆向巡检") +
      "。请核对地图与任务卡后确认。",
    { refs: ["A", "zone-a"], kind: "event" },
  );
}
function startDispatch(s: State): State {
  if (
    !s.plan ||
    s.confirmedRevision !== s.plan.revision ||
    s.preparedRevision !== s.plan.revision
  )
    return s;
  if (!eligibility(s.devices.find((d) => d.id === s.plan!.deviceId)!).eligible)
    return {
      ...s,
      phase: "preview",
      confirmedRevision: null,
      error: "设备状态已变化，请重新核对计划。",
    };
  return { ...s, phase: "dispatching", dispatchCount: s.dispatchCount + 1 };
}
function parseStart(text: string, now: number): StartTime | null {
  if (/立即|现在|马上/.test(text)) return { kind: "immediate" };
  const full = text.match(/(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/);
  if (full) {
    const at = Date.parse(
      full[1] + "T" + full[2].padStart(2, "0") + ":" + full[3] + ":00+08:00",
    );
    return Number.isFinite(at) ? { kind: "scheduled", at } : null;
  }
  const hm = text.match(/(今天|明天)\s*(\d{1,2})[:：点](\d{2})?/);
  if (hm && +hm[2] < 24 && +(hm[3] || 0) < 60) {
    const day = new Date(now + 8 * 3600000 + (hm[1] === "明天" ? 86400000 : 0))
      .toISOString()
      .slice(0, 10);
    return {
      kind: "scheduled",
      at: Date.parse(
        day +
          "T" +
          hm[2].padStart(2, "0") +
          ":" +
          (hm[3] || "00") +
          ":00+08:00",
      ),
    };
  }
  return null;
}
export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "RESET":
      return initialState(a.now, s.session + 1);
    case "FOCUS":
      return { ...s, focused: a.id, focusNonce: s.focusNonce + 1 };
    case "ADD_CONTEXT":
      return {
        ...s,
        context: s.context.includes(a.id) ? s.context : [...s.context, a.id],
      };
    case "REMOVE_CONTEXT":
      return { ...s, context: s.context.filter((id) => id !== a.id) };
    case "SET_FAULT":
      return { ...s, faultNext: a.enabled };
    case "START_PLANNING":
      return startPlanning(s);
    case "INSPECT_DEVICES": {
      if (s.plan) return s;
      const n = add(
        { ...s, planningRegion: "zone-a", context: [] },
        "user",
        "先查看港区设备状态，暂不使用预设条件。",
        { refs: ["zone-a"] },
      );
      const facts = s.devices
        .map(
          (d) =>
            `${labelOf(d.id)}：${d.online ? "在线" : "离线"}，电量 ${d.battery}%${d.freshness === "unknown" ? "（时效未知）" : ""}，${currentTask(s, d.id)}。`,
        )
        .join("\n");
      return add(n, "agent", facts + "\n你希望按什么条件安排 A 区巡检？", {
        kind: "inventory",
      });
    }
    case "FILTER":
      return a.criteriaConfirmed === true
        ? begin(s, "巡检 A 区，使用预设条件：在线且电量 > 50%。")
        : s;
    case "UPDATE_PLAN":
      return updatePlan(s, a.start, a.order);
    case "SEND": {
      const text = a.text.trim();
      if (!text) return s;
      if (
        !s.plan &&
        (/A\s*区/i.test(text) ||
          s.context.includes("zone-a") ||
          s.planningRegion === "zone-a") &&
        /在线/.test(text) &&
        /电量\s*(?:严格\s*)?(?:超过|大于|>)\s*50\s*[%％]/.test(text)
      )
        return begin(s, text);
      if (!s.plan && /巡检|安排/.test(text)) {
        return startPlanning(s, text);
      }
      let n = add({ ...s, context: [], error: null }, "user", text, {
        refs: s.context,
      });
      if (/确认/.test(text))
        return add(
          n,
          "agent",
          "请在当前任务卡中核对设备、区域、开始时间和路线，然后点击“确认计划”。",
        );
      const time = parseStart(text, s.now);
      if (time && editable(s)) return updatePlan(n, time, s.plan!.order, true);
      if (/逆向|反向|顺向/.test(text) && editable(s))
        return updatePlan(
          n,
          s.plan!.start,
          /逆向|反向/.test(text) ? "reverse" : "forward",
          true,
        );
      const refs = s.context.length
        ? s.context
        : (["A", "B", "C"].filter((id) =>
            new RegExp("设备\\s*" + id, "i").test(text),
          ) as ObjectId[]);
      if (refs.length || /状态|电量|查看/.test(text)) {
        const ids = refs.length ? refs : (["A", "B", "C"] as ObjectId[]);
        const info = ids
          .map((id) => {
            if (id === "zone-a")
              return "A 区为本次巡检区域，路线可在任务卡中预览和调整巡检顺序。";
            const d = s.devices.find((d) => d.id === id)!;
            return (
              labelOf(id) +
              "：" +
              (d.online ? "在线" : "离线") +
              "，电量 " +
              d.battery +
              "%" +
              (!d.online ? "（时效未知）" : "") +
              "，当前任务" +
              ("为" + currentTask(s, d.id)) +
              "。"
            );
          })
          .join("\n");
        return add(n, "agent", info, { refs: ids });
      }
      return add(
        n,
        "agent",
        "请告诉我想查看的设备，或补充巡检区域、设备筛选条件和开始时间。",
      );
    }
    case "CONFIRM": {
      if (
        s.phase !== "preview" ||
        !s.plan?.start ||
        a.revision !== s.plan.revision
      )
        return s;
      const now = Math.max(s.now, a.now);
      if (s.plan.start.kind === "scheduled" && s.plan.start.at <= now)
        return { ...s, now, error: "开始时间已过，请重新选择时间后确认。" };
      if (
        !eligibility(s.devices.find((d) => d.id === s.plan!.deviceId)!).eligible
      )
        return { ...s, error: "设备不满足条件，请重新核对。" };
      const continuingTask = s.messages.some(
        (m) =>
          m.id === s.activeTaskMessageId &&
          m.taskId === s.plan!.id &&
          m.taskUpdates !== undefined,
      );
      const n = add(
        {
          ...s,
          now,
          confirmedRevision: a.revision,
          error: null,
          activeTaskMessageId: continuingTask ? s.activeTaskMessageId : null,
          messages: s.messages.map((message) =>
            !continuingTask && message.id === s.activeTaskMessageId
              ? { ...message, planReceipt: { ...s.plan! } }
              : message,
          ),
        },
        "user",
        "确认计划：设备 A · A 区 · " + startLabel(s.plan.start) + "。",
        { refs: ["A", "zone-a"] },
      );
      const taskMessage: Partial<Message> = {
        kind: "task",
        taskId: n.plan!.id,
        taskUpdates: [],
      };
      const confirmation = continuingTask
        ? "更新后的计划已确认，正在准备巡检路线。"
        : "已收到你的确认。";
      if (n.preparedRevision === a.revision)
        return n.plan!.start!.kind === "scheduled"
          ? taskReply(
              { ...n, phase: "scheduled" },
              "计划已确认，等待预约时间。",
              taskMessage,
            )
          : taskReply(startDispatch(n), confirmation, taskMessage);
      return taskReply({ ...n, phase: "preparing" }, confirmation, taskMessage);
    }
    case "PREPARED": {
      if (
        a.session !== s.session ||
        a.revision !== s.plan?.revision ||
        !["preparing", "retrying"].includes(s.phase)
      )
        return s;
      if (!a.ok)
        return taskReply(
          {
            ...s,
            phase: "preparationFailed",
            faultNext: false,
            error: null,
          },
          "路线准备未成功。",
          { kind: "failure" },
        );
      const n = { ...s, preparedRevision: a.revision, error: null };
      if (s.confirmedRevision !== a.revision)
        return taskReply(
          { ...n, phase: "preview", preparedRevision: null },
          "当前计划尚未确认，请核对后确认。",
          { kind: "event" },
          "question",
        );
      if (s.phase === "retrying") {
        if (s.plan.start?.kind === "scheduled" && s.plan.start.at <= s.now)
          return taskReply(
            {
              ...n,
              phase: "clarify",
              plan: { ...s.plan, start: null, revision: s.plan.revision + 1 },
              preparedRevision: null,
              confirmedRevision: null,
            },
            "路线已恢复，但原预约时间已过。请重新选择开始时间并确认。",
            { kind: "event" },
            "question",
          );
        return s.plan.start?.kind === "scheduled"
          ? taskReply(
              { ...n, phase: "scheduled" },
              "路线已准备完成，按已确认计划等待预约时间。",
              { kind: "event" },
            )
          : taskReply(
              startDispatch(n),
              "路线已准备完成，继续下发已确认的计划。",
              { kind: "event" },
            );
      }
      return s.plan.start?.kind === "scheduled"
        ? taskReply(
            { ...n, phase: "scheduled" },
            "计划已确认，等待预约时间。",
            { kind: "event" },
          )
        : startDispatch(n);
    }
    case "RETRY":
      return s.phase === "preparationFailed" &&
        s.plan &&
        s.confirmedRevision === s.plan.revision
        ? taskReply(
            {
              ...s,
              phase: "retrying",
              now: Math.max(s.now, a.now),
              error: null,
            },
            "正在重新准备巡检路线。",
          )
        : s;
    case "TICK": {
      const n = { ...s, now: Math.max(s.now + 1000, a.now) };
      return n.phase === "scheduled" &&
        n.plan?.start?.kind === "scheduled" &&
        n.now >= n.plan.start.at
        ? startDispatch(n)
        : n;
    }
    case "FAST_FORWARD":
      return s.phase === "scheduled" && s.plan?.start?.kind === "scheduled"
        ? startDispatch({ ...s, now: s.plan.start.at })
        : s;
    case "ACK":
      return a.session === s.session &&
        a.revision === s.plan?.revision &&
        s.phase === "dispatching"
        ? taskReply(
            { ...s, phase: "running", progress: 0 },
            "设备 A 已接收任务，开始巡检 A 区。",
            { kind: "event" },
          )
        : s;
    case "PROGRESS":
      if (a.session !== s.session || s.phase !== "running") return s;
      return a.progress >= 100
        ? taskReply(
            { ...s, phase: "completed", progress: 100 },
            "A 区巡检完成，未发现异常。设备 A 已恢复空闲。",
            { kind: "event" },
            "result",
          )
        : { ...s, progress: Math.max(s.progress, a.progress) };
    case "PAUSE":
      return s.phase === "running"
        ? taskReply(
            { ...s, phase: "paused" },
            "巡检已暂停，设备位置与已走轨迹保持在当前进度。可继续巡检或停止任务。",
            { kind: "event" },
          )
        : s;
    case "RESUME":
      return s.phase === "paused"
        ? taskReply(
            { ...s, phase: "running" },
            "巡检已继续，将从暂停位置完成剩余路线。",
            { kind: "event" },
          )
        : s;
    case "STOP":
      return ["running", "paused"].includes(s.phase)
        ? taskReply(
            { ...s, phase: "stopped" },
            "巡检已停止，未完成的路线不再执行。已走轨迹保留，设备 A 恢复空闲。",
            { kind: "event" },
            "result",
          )
        : s;
    default:
      return s;
  }
}
export const phaseLabels: Record<Phase, string> = {
  idle: "态势总览",
  clarify: "待补充时间",
  preview: "待确认",
  preparing: "准备路线",
  preparationFailed: "路线准备失败",
  retrying: "重试准备中",
  scheduled: "等待开始",
  dispatching: "任务下发中",
  running: "巡检执行中",
  paused: "巡检已暂停",
  stopped: "巡检已停止",
  completed: "巡检已完成",
};
