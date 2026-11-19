import { describe, expect, it } from "vitest";
import {
  eligibility,
  currentTask,
  originalRequest,
  initialDevices,
  initialState,
  reducer,
  startLabel,
  type State,
} from "../src/domain/model";
import {
  patrolPoints,
  routePoints,
  routePosition,
} from "../src/domain/geometry";
const NOW = Date.parse("2026-11-15T06:00:00Z");
function filtered() {
  return reducer(initialState(NOW), {
    type: "FILTER",
    criteriaConfirmed: true,
  });
}
function preview() {
  return reducer(filtered(), {
    type: "UPDATE_PLAN",
    start: { kind: "immediate" },
    order: "forward",
  });
}
function confirm(s = preview()) {
  return reducer(s, { type: "CONFIRM", revision: s.plan!.revision, now: NOW });
}
function prepared(s: State, ok = true) {
  return reducer(s, {
    type: "PREPARED",
    session: s.session,
    revision: s.plan!.revision,
    ok,
  });
}
function taskMessage(s: State) {
  return s.messages.find((m) => m.id === s.activeTaskMessageId)!;
}
function taskUpdates(s: State) {
  return taskMessage(s).taskUpdates ?? [];
}
function expectTaskCardRetained(before: State, after: State) {
  expect(before.activeTaskMessageId).not.toBeNull();
  expect(after.activeTaskMessageId).toBe(before.activeTaskMessageId);
  for (const message of before.messages) {
    if (message.id !== before.activeTaskMessageId) {
      expect(after.messages.find((m) => m.id === message.id)).toEqual(message);
    }
  }
  const { taskUpdates: beforeUpdates, ...beforeReply } = taskMessage(before);
  const { taskUpdates: afterUpdates, ...afterReply } = taskMessage(after);
  expect(afterReply).toEqual(beforeReply);
  expect(afterUpdates?.slice(0, beforeUpdates?.length ?? 0)).toEqual(
    beforeUpdates,
  );
  expect(
    after.messages.findIndex((m) => m.id === after.activeTaskMessageId),
  ).toBe(before.messages.findIndex((m) => m.id === before.activeTaskMessageId));
}
describe("筛选与上下文", () => {
  it("仅 A 符合，B 与 C 的原因正确", () => {
    expect(initialDevices.map(eligibility).map((v) => v.eligible)).toEqual([
      true,
      false,
      false,
    ]);
    expect(eligibility(initialDevices[1]).reason).toContain("未超过 50%");
    expect(eligibility(initialDevices[2]).reason).toContain("离线");
  });
  it("50% 不满足严格大于条件", () =>
    expect(eligibility({ ...initialDevices[0], battery: 50 }).eligible).toBe(
      false,
    ));
  it("高电量离线仍排除", () =>
    expect(
      eligibility({ ...initialDevices[0], online: false, battery: 100 })
        .eligible,
    ).toBe(false));
  it("地图定位不改变任务，加入引用也不改变任务", () => {
    const s = preview(),
      n = reducer(reducer(s, { type: "FOCUS", id: "B" }), {
        type: "ADD_CONTEXT",
        id: "B",
      });
    expect(n.plan).toEqual(s.plan);
    expect(n.focused).toBe("B");
    expect(n.context).toEqual(["B"]);
  });
  it("发送消息消费引用并保留于该条消息", () => {
    const s = reducer(filtered(), { type: "ADD_CONTEXT", id: "C" }),
      n = reducer(s, { type: "SEND", text: "查看它的状态" });
    expect(n.context).toEqual([]);
    expect(n.messages.at(-2)?.refs).toEqual(["C"]);
    expect(n.messages.at(-1)?.text).toContain("时效未知");
  });
});
describe("从计划卡衔接对话修改", () => {
  it("入口只追加简短问答，保留原草稿和卡片位置，重复点击不刷屏", () => {
    const draft = filtered();
    const asked = reducer(draft, { type: "REQUEST_PLAN_CHANGE" });
    expect(asked.plan).toBe(draft.plan);
    expect(asked.activeTaskMessageId).toBe(draft.activeTaskMessageId);
    expect(asked.phase).toBe(draft.phase);
    expect(asked.messages.slice(0, draft.messages.length)).toEqual(
      draft.messages,
    );
    expect(asked.messages.slice(-2)).toMatchObject([
      { role: "user", text: "修改巡检计划" },
      { role: "agent", text: "想调整开始时间，还是巡检顺序？" },
    ]);
    expect(
      asked.messages.slice(-2).every((m) => !m.taskId && !m.planReceipt),
    ).toBe(true);
    expect(asked.confirmedRevision).toBeNull();
    expect(asked.dispatchCount).toBe(0);
    expect(reducer(asked, { type: "REQUEST_PLAN_CHANGE" })).toBe(asked);
    const typed = reducer(draft, { type: "SEND", text: "修改计划" });
    expect(typed.plan).toBe(draft.plan);
    expect(typed.activeTaskMessageId).toBe(draft.activeTaskMessageId);
    expect(typed.messages.at(-1)?.text).toBe(asked.messages.at(-1)?.text);
  });
  it("回答沿用已有时间与顺序解析，仍更新原卡并等待最终确认", () => {
    const draft = filtered();
    const asked = reducer(draft, { type: "REQUEST_PLAN_CHANGE" });
    const reverse = reducer(asked, { type: "SEND", text: "改为逆向巡检" });
    const timed = reducer(reverse, { type: "SEND", text: "明天 09:30 开始" });
    expect(timed.plan).toMatchObject({
      id: draft.plan!.id,
      order: "reverse",
      start: { kind: "scheduled", at: Date.parse("2026-11-16T09:30:00+08:00") },
    });
    expect(timed.activeTaskMessageId).toBe(draft.activeTaskMessageId);
    expect(
      timed.messages.find((m) => m.id === draft.activeTaskMessageId),
    ).toEqual(taskMessage(draft));
    expect(timed.confirmedRevision).toBeNull();
    expect(timed.dispatchCount).toBe(0);
    expect(timed.phase).toBe("preview");
    expect(prepared(confirm(timed)).phase).toBe("scheduled");
  });
  it("没有计划或已进入执行流程时不再接受卡片修改入口", () => {
    const confirmed = confirm();
    const dispatched = prepared(confirmed);
    const running = reducer(dispatched, {
      type: "ACK",
      session: dispatched.session,
      revision: dispatched.plan!.revision,
    });
    for (const state of [initialState(NOW), confirmed, dispatched, running]) {
      expect(reducer(state, { type: "REQUEST_PLAN_CHANGE" })).toBe(state);
    }
  });
});
describe("重置当前计划", () => {
  it("预约逆向恢复立即开始与顺向路线，保留对象、原卡和对话上下文", () => {
    const scheduled = reducer(filtered(), {
      type: "UPDATE_PLAN",
      start: { kind: "scheduled", at: NOW + 60000 },
      order: "reverse",
    });
    const referenced = reducer(scheduled, { type: "ADD_CONTEXT", id: "B" });
    const invalid = reducer(referenced, {
      type: "UPDATE_START",
      start: { kind: "scheduled", at: NOW - 1 },
    });
    expect(invalid.error).not.toBeNull();
    const reset = reducer(invalid, { type: "RESET_PLAN" });
    expect(reset.plan).toMatchObject({
      id: scheduled.plan!.id,
      deviceId: scheduled.plan!.deviceId,
      regionId: scheduled.plan!.regionId,
      start: { kind: "immediate" },
      order: "forward",
      revision: scheduled.plan!.revision + 1,
    });
    expect(routePoints(reset.plan!.order)).toEqual(routePoints("forward"));
    expect(routePoints(reset.plan!.order)).not.toEqual(routePoints(scheduled.plan!.order));
    expect(reset.activeTaskMessageId).toBe(invalid.activeTaskMessageId);
    expect(reset.messages).toBe(invalid.messages);
    expect(reset.context).toBe(invalid.context);
    expect(reset.devices).toBe(invalid.devices);
    expect(reset.session).toBe(invalid.session);
    expect(reset.error).toBeNull();
    expect(reset.confirmedRevision).toBeNull();
    expect(reset.preparedRevision).toBeNull();
    expect(reset.phase).toBe("preview");
    expect(reset.dispatchCount).toBe(0);
  });
  it("重置后的立即开始不绑定过期时刻，等待几分钟仍需确认才能执行", () => {
    const scheduled = reducer(filtered(), {
      type: "UPDATE_PLAN",
      start: { kind: "scheduled", at: NOW + 60000 },
      order: "reverse",
    });
    const reset = reducer(scheduled, { type: "RESET_PLAN" });
    const later = reducer(reset, { type: "TICK", now: NOW + 300000 });
    expect(later.plan?.start).toEqual({ kind: "immediate" });
    expect(later.phase).toBe("preview");
    expect(later.dispatchCount).toBe(0);
    const confirmed = confirm(later);
    expect(confirmed.phase).toBe("preparing");
    expect(confirmed.error).toBeNull();
    const dispatched = prepared(confirmed);
    expect(dispatched.phase).toBe("dispatching");
    expect(dispatched.dispatchCount).toBe(1);
  });
  it("默认计划也创建新版本以清除未提交的选择，执行期间与没有计划时不能重置", () => {
    const draft = filtered();
    const reset = reducer(draft, { type: "RESET_PLAN" });
    expect(reset.plan?.start).toEqual(draft.plan?.start);
    expect(reset.plan?.order).toBe(draft.plan?.order);
    expect(reset.plan?.revision).toBe(draft.plan!.revision + 1);
    expect(reset.messages).toBe(draft.messages);
    expect(reset.activeTaskMessageId).toBe(draft.activeTaskMessageId);
    const pending = confirm();
    const scheduled = prepared(confirm(reducer(filtered(), {
      type: "UPDATE_START",
      start: { kind: "scheduled", at: NOW + 60000 },
    })));
    for (const state of [initialState(NOW), pending, scheduled, running()]) {
      expect(reducer(state, { type: "RESET_PLAN" })).toBe(state);
    }
  });
  it("选择此刻保存立即开始语义，五分钟后确认仍有效", () => {
    const scheduled = reducer(filtered(), {
      type: "UPDATE_START",
      start: { kind: "scheduled", at: NOW + 60000 },
    });
    const immediate = reducer(scheduled, {
      type: "UPDATE_START", start: { kind: "immediate" },
    });
    const later = reducer(immediate, { type: "TICK", now: NOW + 300000 });
    expect(later.plan?.start).toEqual({ kind: "immediate" });
    expect(later.dispatchCount).toBe(0);
    const confirmed = confirm(later);
    expect(confirmed.phase).toBe("preparing");
    expect(confirmed.error).toBeNull();
    expect(prepared(confirmed).dispatchCount).toBe(1);
  });
  it("重置后旧版本确认、准备结果和下发回执均不能推进新计划", () => {
    const changed = reducer(filtered(), { type: "UPDATE_ORDER", order: "reverse" });
    const reset = reducer(changed, { type: "RESET_PLAN" });
    expect(reducer(reset, {
      type: "CONFIRM", revision: changed.plan!.revision, now: NOW,
    })).toBe(reset);
    const confirmed = confirm(reset);
    expect(reducer(confirmed, {
      type: "PREPARED", revision: changed.plan!.revision, session: confirmed.session, ok: true,
    })).toBe(confirmed);
    const dispatched = prepared(confirmed);
    expect(reducer(dispatched, {
      type: "ACK", revision: changed.plan!.revision, session: dispatched.session,
    })).toBe(dispatched);
  });
});
describe("澄清、版本和下发边界", () => {
  it("筛选后直接预览建议时间和路线，等待不等于接受或下发", () => {
    const draft = filtered();
    expect(draft.phase).toBe("preview");
    expect(draft.plan).toMatchObject({
      start: { kind: "immediate" },
      startSuggested: true,
      order: "forward",
    });
    expect(draft.confirmedRevision).toBeNull();
    expect(draft.preparedRevision).toBeNull();
    const later = reducer(draft, { type: "TICK", now: NOW + 60000 });
    expect(later.phase).toBe("preview");
    expect(later.dispatchCount).toBe(0);
    expect(later.plan).toEqual(draft.plan);
    expect(prepared(later)).toEqual(later);
  });
  it("一次确认接受建议时间并开始准备，成功准备后才下发", () => {
    const draft = filtered();
    const confirmed = confirm(draft);
    expect(confirmed.phase).toBe("preparing");
    expect(confirmed.plan?.start).toEqual({ kind: "immediate" });
    expect(confirmed.plan?.startSuggested).toBe(false);
    expect(confirmed.confirmedRevision).toBe(draft.plan!.revision);
    expect(confirmed.dispatchCount).toBe(0);
    expect(
      confirmed.messages.find((m) => m.id === draft.activeTaskMessageId)
        ?.planReceipt?.startSuggested,
    ).toBe(false);
    expect(draft.plan?.startSuggested).toBe(true);
    expect(prepared(confirmed).dispatchCount).toBe(1);
  });
  it("单独调整顺序即时更新空间数据，保留建议时间且不新增消息", () => {
    const draft = filtered();
    const reversed = reducer(draft, { type: "UPDATE_ORDER", order: "reverse" });
    expect(reversed.plan?.order).toBe("reverse");
    expect(reversed.plan?.start).toEqual(draft.plan?.start);
    expect(reversed.plan?.startSuggested).toBe(true);
    expect(reversed.plan?.revision).toBe(draft.plan!.revision + 1);
    expect(reversed.messages).toEqual(draft.messages);
    expect(reversed.activeTaskMessageId).toBe(draft.activeTaskMessageId);
    expect(routePoints(reversed.plan!.order)).not.toEqual(
      routePoints(draft.plan!.order),
    );
    expect(patrolPoints(reversed.plan!.order)[0]).toEqual(
      patrolPoints(draft.plan!.order).at(-1),
    );
    expect(reversed.confirmedRevision).toBeNull();
    expect(reversed.dispatchCount).toBe(0);
  });
  it("时间与顺序分项修改互不覆盖，最后确认只接受最新组合", () => {
    const draft = filtered();
    const reverse = reducer(draft, { type: "UPDATE_ORDER", order: "reverse" });
    const time = { kind: "scheduled" as const, at: NOW + 60000 };
    const scheduled = reducer(reverse, { type: "UPDATE_START", start: time });
    expect(scheduled.plan?.order).toBe("reverse");
    expect(scheduled.plan?.start).toEqual(time);
    expect(scheduled.plan?.startSuggested).toBe(false);
    const forward = reducer(scheduled, {
      type: "UPDATE_ORDER",
      order: "forward",
    });
    expect(forward.plan?.start).toEqual(time);
    expect(forward.plan?.startSuggested).toBe(false);
    expect(forward.plan?.revision).toBe(draft.plan!.revision + 3);
    expect(forward.messages).toEqual(draft.messages);
    expect(forward.confirmedRevision).toBeNull();
    expect(forward.preparedRevision).toBeNull();
    expect(forward.dispatchCount).toBe(0);
    expect(confirm(reverse).plan?.order).toBe("reverse");
    expect(
      reducer(forward, {
        type: "CONFIRM",
        revision: reverse.plan!.revision,
        now: NOW,
      }),
    ).toEqual(forward);
    const accepted = prepared(confirm(forward));
    expect(accepted.phase).toBe("scheduled");
    expect(accepted.plan).toMatchObject({ start: time, order: "forward" });
    expect(accepted.dispatchCount).toBe(0);
    const immediate = reducer(forward, {
      type: "UPDATE_START",
      start: { kind: "immediate" },
    });
    expect(immediate.plan?.order).toBe("forward");
    expect(immediate.plan?.startSuggested).toBe(false);
  });
  it("无效预约不会覆盖原草稿，确认后的任务不再接受分项编辑", () => {
    const draft = filtered();
    for (const at of [NOW - 1, Number.NaN]) {
      const invalid = reducer(draft, {
        type: "UPDATE_START",
        start: { kind: "scheduled", at },
      });
      expect(invalid.plan).toEqual(draft.plan);
      expect(invalid.messages).toEqual(draft.messages);
      expect(invalid.error).toContain("晚于当前时间");
      expect(invalid.dispatchCount).toBe(0);
    }
    for (const state of [initialState(NOW), confirm(draft), running()]) {
      expect(
        reducer(state, { type: "UPDATE_ORDER", order: "reverse" }),
      ).toEqual(state);
      expect(
        reducer(state, {
          type: "UPDATE_START",
          start: { kind: "scheduled", at: NOW + 60000 },
        }),
      ).toEqual(state);
    }
  });
  it("预约时间过期仍能独立预览顺序，但修正时间前不能确认", () => {
    const scheduled = reducer(filtered(), {
      type: "UPDATE_START",
      start: { kind: "scheduled", at: NOW + 60000 },
    });
    const expired = reducer(scheduled, { type: "TICK", now: NOW + 61000 });
    const changed = reducer(expired, {
      type: "UPDATE_ORDER",
      order: "reverse",
    });
    expect(changed.plan?.order).toBe("reverse");
    expect(changed.plan?.start).toEqual(scheduled.plan?.start);
    const rejected = confirm(changed);
    expect(rejected.phase).toBe("preview");
    expect(rejected.error).toContain("已过");
    expect(rejected.dispatchCount).toBe(0);
    const corrected = reducer(rejected, {
      type: "UPDATE_START",
      start: { kind: "immediate" },
    });
    expect(corrected.plan?.order).toBe("reverse");
    expect(prepared(confirm(corrected)).dispatchCount).toBe(1);
  });
  it("对话仅修改顺序不冒充时间选择，明确时间后取消建议标记", () => {
    const reverse = reducer(filtered(), { type: "SEND", text: "改为逆向巡检" });
    expect(reverse.plan?.order).toBe("reverse");
    expect(reverse.plan?.startSuggested).toBe(true);
    const time = reducer(reverse, { type: "SEND", text: "明天 09:30 开始" });
    expect(time.plan?.order).toBe("reverse");
    expect(time.plan?.startSuggested).toBe(false);
    expect(time.dispatchCount).toBe(0);
  });
  it("缺少开始时间时确认无效", () => {
    const s = reducer(filtered(), {
        type: "UPDATE_PLAN",
        start: null,
        order: "forward",
      }),
      n = reducer(s, { type: "CONFIRM", revision: s.plan!.revision, now: NOW });
    expect(n.phase).toBe("clarify");
    expect(n.dispatchCount).toBe(0);
  });
  it("预览与修改不下发，并且修改递增版本", () => {
    const s = preview(),
      n = reducer(s, {
        type: "UPDATE_PLAN",
        start: { kind: "scheduled", at: NOW + 60000 },
        order: "reverse",
      });
    expect(n.dispatchCount).toBe(0);
    expect(n.plan!.revision).toBe(s.plan!.revision + 1);
    expect(n.plan!.order).toBe("reverse");
    expect(startLabel(n.plan!.start)).toContain("14:01");
  });
  it("旧版本确认失效", () => {
    const s = preview(),
      n = reducer(s, {
        type: "UPDATE_PLAN",
        start: { kind: "immediate" },
        order: "reverse",
      });
    expect(
      reducer(n, { type: "CONFIRM", revision: s.plan!.revision, now: NOW }),
    ).toEqual(n);
  });
  it("输入“确认”只引导到任务卡，不下发", () =>
    expect(
      reducer(preview(), { type: "SEND", text: "确认" }).dispatchCount,
    ).toBe(0));
  it("重复确认只产生一次下发", () => {
    const s = confirm(),
      duplicate = reducer(s, {
        type: "CONFIRM",
        revision: s.plan!.revision,
        now: NOW,
      });
    expect(duplicate).toEqual(s);
    const n = prepared(duplicate);
    expect(n.dispatchCount).toBe(1);
    expect(prepared(n).dispatchCount).toBe(1);
  });
  it("没有确认的准备成功事件不能下发", () => {
    const s = preview();
    expect(prepared(s)).toEqual(s);
  });
  it("预约在到时前等待，到时只下发一次", () => {
    const s = reducer(filtered(), {
        type: "UPDATE_PLAN",
        start: { kind: "scheduled", at: NOW + 60000 },
        order: "forward",
      }),
      n = prepared(confirm(s));
    expect(n.phase).toBe("scheduled");
    expect(n.dispatchCount).toBe(0);
    expect(reducer(n, { type: "TICK", now: NOW + 59000 }).dispatchCount).toBe(
      0,
    );
    const due = reducer(n, { type: "TICK", now: NOW + 60000 });
    expect(due.dispatchCount).toBe(1);
    expect(reducer(due, { type: "TICK", now: NOW + 61000 }).dispatchCount).toBe(
      1,
    );
  });
  it("确认前时间已过会阻止确认", () => {
    const s = reducer(filtered(), {
        type: "UPDATE_PLAN",
        start: { kind: "scheduled", at: NOW + 60000 },
        order: "forward",
      }),
      n = reducer(s, {
        type: "CONFIRM",
        revision: s.plan!.revision,
        now: NOW + 61000,
      });
    expect(n.phase).toBe("preview");
    expect(n.error).toContain("已过");
    expect(n.dispatchCount).toBe(0);
  });
  it("时间文本使用北京时间，支持明天", () => {
    const s = reducer(filtered(), { type: "SEND", text: "明天 09:30 开始" });
    expect(s.plan!.start).toEqual({
      kind: "scheduled",
      at: Date.parse("2026-11-16T09:30:00+08:00"),
    });
  });
});
describe("异常恢复与异步事件", () => {
  it("路线准备失败未下发，未修改的已确认计划直接重试", () => {
    const confirmed = confirm();
    const failed = prepared(confirmed, false);
    expect(failed.phase).toBe("preparationFailed");
    expect(failed.dispatchCount).toBe(0);
    expect(failed.confirmedRevision).toBe(failed.plan!.revision);
    expectTaskCardRetained(confirmed, failed);
    const retrying = reducer(failed, { type: "RETRY", now: NOW });
    expectTaskCardRetained(failed, retrying);
    const ready = prepared(retrying);
    expectTaskCardRetained(retrying, ready);
    expect(ready.messages).toHaveLength(confirmed.messages.length);
    expect(taskUpdates(ready)).toEqual([
      expect.objectContaining({ kind: "failure", text: "路线准备未成功。" }),
      expect.objectContaining({
        kind: "progress",
        text: "正在重新准备巡检路线。",
      }),
      expect.objectContaining({
        kind: "progress",
        text: expect.stringContaining("继续下发已确认的计划"),
      }),
    ]);
    expect(ready.phase).toBe("dispatching");
    expect(ready.dispatchCount).toBe(1);
    expect(prepared(ready).dispatchCount).toBe(1);
    expect(reducer(ready, { type: "RETRY", now: NOW })).toEqual(ready);
  });
  it("重试后预约时间已过需重新澄清", () => {
    const s = reducer(filtered(), {
        type: "UPDATE_PLAN",
        start: { kind: "scheduled", at: NOW + 60000 },
        order: "forward",
      }),
      f = prepared(confirm(s), false),
      r = prepared(reducer(f, { type: "RETRY", now: NOW + 61000 }));
    expect(r.phase).toBe("clarify");
    expect(r.plan!.start).toBeNull();
    expect(r.dispatchCount).toBe(0);
  });
  it("重置后丢弃上一轮的异步回执", () => {
    const s = confirm(),
      fresh = reducer(s, { type: "RESET", now: NOW });
    expect(
      reducer(fresh, {
        type: "PREPARED",
        session: s.session,
        revision: s.plan!.revision,
        ok: true,
      }),
    ).toEqual(fresh);
    expect(
      reducer(fresh, { type: "PROGRESS", session: s.session, progress: 100 }),
    ).toEqual(fresh);
  });
  it("未收到执行回执不能凭进度事件开始任务", () => {
    const s = prepared(confirm());
    expect(s.phase).toBe("dispatching");
    expect(
      reducer(s, { type: "PROGRESS", session: s.session, progress: 100 }),
    ).toEqual(s);
  });
  it("执行回执、进度与完成形成完整流程", () => {
    const s = prepared(confirm()),
      r = reducer(s, {
        type: "ACK",
        session: s.session,
        revision: s.plan!.revision,
      }),
      n = reducer(r, { type: "PROGRESS", session: r.session, progress: 100 });
    expect(r.phase).toBe("running");
    expect(n.phase).toBe("completed");
    expect(n.progress).toBe(100);
    expect(taskUpdates(n).at(-1)?.kind).toBe("result");
    expect(taskUpdates(n).at(-1)?.text).toContain("未发现异常");
    expect(taskUpdates(n).at(-1)?.text).toContain("已恢复空闲");
  });
});
describe("空间数据", () => {
  it("逆向变更巡检顺序且保留设备出发位置", () => {
    const f = routePoints("forward"),
      r = routePoints("reverse");
    expect(r[0]).toEqual(f[0]);
    expect(patrolPoints("reverse")[0]).toEqual(patrolPoints("forward").at(-1));
    expect(r.at(-1)).toEqual(patrolPoints("forward")[0]);
  });
  it("已走轨迹按进度生成，预览不会产生完整轨迹", () => {
    const p = routePoints("forward"),
      zero = routePosition(p, 0),
      half = routePosition(p, 50),
      done = routePosition(p, 100);
    expect(zero.position).toEqual(p[0]);
    expect(half.trail.length).toBeLessThan(p.length);
    expect(done.position).toEqual(p.at(-1));
    expect(p).toEqual(routePoints("forward"));
  });
});

describe("浏览器发现的问题回归", () => {
  it("正逆向接入路线均沿通道正交前进", () => {
    for (const order of ["forward", "reverse"] as const) {
      const points = routePoints(order);
      for (let i = 1; i < points.length; i++) {
        expect(
          points[i].x === points[i - 1].x || points[i].y === points[i - 1].y,
        ).toBe(true);
      }
      expect(patrolPoints(order)).toHaveLength(6);
    }
  });
  it("推进预约后，模拟时钟仍持续走时", () => {
    const s = reducer(filtered(), {
      type: "UPDATE_PLAN",
      start: { kind: "scheduled", at: NOW + 3600000 },
      order: "forward",
    });
    const waiting = prepared(confirm(s));
    const advanced = reducer(waiting, { type: "FAST_FORWARD" });
    expect(reducer(advanced, { type: "TICK", now: NOW + 1000 }).now).toBe(
      advanced.now + 1000,
    );
  });
});

describe("同一次任务持续更新一条助手回复", () => {
  it("确认建立唯一任务回复，回执归入进展，下发和数值进度不刷消息", () => {
    const plan = preview();
    const preparing = confirm(plan);
    expect(preparing.messages.length).toBe(plan.messages.length + 2);
    expect(preparing.messages.at(-2)?.role).toBe("user");
    expect(preparing.activeTaskMessageId).toBe(preparing.messages.at(-1)?.id);
    expect(taskMessage(preparing)).toMatchObject({
      role: "agent",
      kind: "task",
      taskId: preparing.plan!.id,
      taskUpdates: [],
    });
    const dispatching = prepared(preparing);
    expect(dispatching.phase).toBe("dispatching");
    expect(dispatching.messages).toEqual(preparing.messages);
    const running = reducer(dispatching, {
      type: "ACK",
      session: dispatching.session,
      revision: dispatching.plan!.revision,
    });
    expect(running.messages).toHaveLength(preparing.messages.length);
    expect(taskUpdates(running).at(-1)?.text).toContain("已接收任务");
    expectTaskCardRetained(preparing, running);
    const progress = reducer(running, {
      type: "PROGRESS",
      session: running.session,
      progress: 48,
    });
    expect(progress.messages).toEqual(running.messages);
    expectTaskCardRetained(running, progress);
  });
  it("任务进展按序追加到原回复，用户插话和助手答复保持独立", () => {
    const confirmed = confirm();
    const dispatching = prepared(confirmed);
    const acknowledged = reducer(dispatching, {
      type: "ACK",
      session: dispatching.session,
      revision: dispatching.plan!.revision,
    });
    const queried = reducer(acknowledged, {
      type: "SEND",
      text: "查看设备 A 状态",
    });
    const paused = reducer(queried, { type: "PAUSE" });
    const resumed = reducer(paused, { type: "RESUME" });
    const completed = reducer(resumed, {
      type: "PROGRESS",
      session: resumed.session,
      progress: 100,
    });
    const queriedAfterCompletion = reducer(completed, {
      type: "SEND",
      text: "查看设备 A 状态",
    });
    const states = [
      confirmed,
      dispatching,
      acknowledged,
      queried,
      paused,
      resumed,
      completed,
      queriedAfterCompletion,
    ];
    for (let i = 1; i < states.length; i++) {
      expectTaskCardRetained(states[i - 1], states[i]);
    }
    expect(
      queriedAfterCompletion.messages
        .slice(confirmed.messages.length)
        .map((message) => message.text),
    ).toEqual([
      "查看设备 A 状态",
      expect.stringContaining("当前任务为A 区巡检中"),
      "查看设备 A 状态",
      expect.stringContaining("当前任务为空闲"),
    ]);
    expect(
      taskUpdates(queriedAfterCompletion).map((update) => update.text),
    ).toEqual([
      expect.stringContaining("已接收任务"),
      expect.stringContaining("巡检已暂停"),
      expect.stringContaining("巡检已继续"),
      expect.stringContaining("A 区巡检完成"),
    ]);
    expect(taskMessage(queriedAfterCompletion).simulatedDurationMs).toBe(
      taskMessage(confirmed).simulatedDurationMs,
    );
    expect(
      queriedAfterCompletion.messages.filter(
        (message) => message.taskId === confirmed.plan!.id,
      ),
    ).toHaveLength(1);
    expect(taskMessage(queriedAfterCompletion).refs).toBeUndefined();
    for (const update of taskUpdates(queriedAfterCompletion)) {
      expect(update).not.toHaveProperty("refs");
      expect(update).not.toHaveProperty("simulatedDurationMs");
    }
  });
  it("独立澄清与对象查询不会被合并进任务进展，后续完成仍更新原回复", () => {
    const before = running();
    const unclear = reducer(before, { type: "SEND", text: "它怎么样？" });
    expect(unclear.messages.at(-1)?.text).toContain("请告诉我想查看的设备");
    expect(unclear.messages.at(-1)?.taskId).toBeUndefined();
    expect(taskUpdates(unclear)).toEqual(taskUpdates(before));
    const answered = reducer(
      reducer(unclear, { type: "ADD_CONTEXT", id: "C" }),
      { type: "SEND", text: "查看状态" },
    );
    expect(answered.messages.at(-2)?.refs).toEqual(["C"]);
    expect(answered.messages.at(-1)).toMatchObject({
      role: "agent",
      refs: ["C"],
      text: expect.stringContaining("时效未知"),
    });
    expect(taskUpdates(answered)).toEqual(taskUpdates(before));
    const completed = reducer(answered, {
      type: "PROGRESS",
      session: answered.session,
      progress: 100,
    });
    expectTaskCardRetained(answered, completed);
    expect(completed.messages.slice(before.messages.length)).toEqual(
      answered.messages.slice(before.messages.length),
    );
    expect(taskUpdates(completed).at(-1)?.kind).toBe("result");
  });
  it("重复准备回执、重试、执行回执和完成不会刷重复进展", () => {
    const confirmed = confirm();
    const failed = prepared(confirmed, false);
    expect(prepared(failed, false)).toEqual(failed);
    const retrying = reducer(failed, { type: "RETRY", now: NOW });
    expect(reducer(retrying, { type: "RETRY", now: NOW })).toEqual(retrying);
    const ready = prepared(retrying);
    expect(prepared(ready)).toEqual(ready);
    const ack = {
      type: "ACK" as const,
      session: ready.session,
      revision: ready.plan!.revision,
    };
    const acknowledged = reducer(ready, ack);
    expect(reducer(acknowledged, ack)).toEqual(acknowledged);
    let advancing = acknowledged;
    for (const progress of [12, 25, 48, 48]) {
      advancing = reducer(advancing, {
        type: "PROGRESS",
        session: advancing.session,
        progress,
      });
      expect(advancing.messages).toEqual(acknowledged.messages);
    }
    const completion = {
      type: "PROGRESS" as const,
      session: advancing.session,
      progress: 100,
    };
    const completed = reducer(advancing, completion);
    expect(reducer(completed, completion)).toEqual(completed);
    expect(completed.messages).toHaveLength(confirmed.messages.length);
    expect(taskUpdates(completed).map((update) => update.kind)).toEqual([
      "failure",
      "progress",
      "progress",
      "progress",
      "result",
    ]);
    expect(taskUpdates(completed).map((update) => update.id)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(taskMessage(completed).simulatedDurationMs).toBe(
      taskMessage(confirmed).simulatedDurationMs,
    );
  });
  it("等待预约与到时执行继续使用同一任务回复", () => {
    const plan = reducer(filtered(), {
      type: "UPDATE_PLAN",
      start: { kind: "scheduled", at: NOW + 60000 },
      order: "forward",
    });
    const confirmed = confirm(plan);
    const scheduled = prepared(confirmed);
    expectTaskCardRetained(confirmed, scheduled);
    expect(taskUpdates(scheduled).at(-1)?.text).toContain("等待预约时间");
    const waiting = reducer(scheduled, { type: "TICK", now: NOW + 30000 });
    expect(waiting.messages).toEqual(scheduled.messages);
    const due = reducer(waiting, { type: "TICK", now: NOW + 60000 });
    const acknowledged = reducer(due, {
      type: "ACK",
      session: due.session,
      revision: due.plan!.revision,
    });
    expectTaskCardRetained(confirmed, acknowledged);
    expect(acknowledged.messages).toHaveLength(confirmed.messages.length);
    expect(taskUpdates(acknowledged).map((update) => update.text)).toEqual([
      expect.stringContaining("等待预约时间"),
      expect.stringContaining("已接收任务"),
    ]);
  });
  it("重置后的新任务不继承上一任务进展，迟到回执不污染新回复", () => {
    const old = reducer(running(), { type: "PAUSE" });
    const reset = reducer(old, { type: "RESET", now: NOW });
    const plan = reducer(
      reducer(reset, { type: "FILTER", criteriaConfirmed: true }),
      { type: "UPDATE_PLAN", start: { kind: "immediate" }, order: "reverse" },
    );
    const fresh = prepared(confirm(plan));
    expect(taskUpdates(fresh)).toEqual([]);
    expect(
      reducer(fresh, {
        type: "ACK",
        session: old.session,
        revision: old.plan!.revision,
      }),
    ).toEqual(fresh);
    const acknowledged = reducer(fresh, {
      type: "ACK",
      session: fresh.session,
      revision: fresh.plan!.revision,
    });
    expect(taskUpdates(acknowledged)).toHaveLength(1);
    expect(
      reducer(acknowledged, {
        type: "PROGRESS",
        session: old.session,
        progress: 100,
      }),
    ).toEqual(acknowledged);
    expect(
      taskUpdates(acknowledged).some((update) => /暂停|完成/.test(update.text)),
    ).toBe(false);
    expect(
      acknowledged.messages.filter((message) => message.taskId),
    ).toHaveLength(1);
  });
});

describe("对话内计划与历史边界", () => {
  it("通用推荐先选区域，不擅自创建 A 区计划", () => {
    const setup = reducer(initialState(NOW), { type: "START_PLANNING" });
    expect(setup.plan).toBeNull();
    expect(setup.messages.at(-1)?.kind).toBe("setup");
    expect(setup.dispatchCount).toBe(0);
    const typed = reducer(initialState(NOW), {
      type: "SEND",
      text: "创建巡检任务",
    });
    expect(typed.plan).toBeNull();
    const chosen = reducer(setup, { type: "FILTER", criteriaConfirmed: true });
    expect(chosen.plan?.regionId).toBe("zone-a");
    expect(chosen.activeTaskMessageId).toBe(chosen.messages.at(-1)?.id);
  });
  it("卡片修改原位更新，不增加消息或下发", () => {
    const s = filtered();
    const next = reducer(s, {
      type: "UPDATE_PLAN",
      start: { kind: "immediate" },
      order: "reverse",
    });
    expect(next.messages).toEqual(s.messages);
    expect(next.activeTaskMessageId).toBe(s.activeTaskMessageId);
    expect(next.dispatchCount).toBe(0);
    expect(next.plan?.order).toBe("reverse");
  });
  it("确认后历史计划保留快照，新卡位于确认消息后", () => {
    const s = preview();
    const next = confirm(s);
    const receipt = next.messages.find(
      (m) => m.id === s.activeTaskMessageId,
    )?.planReceipt;
    expect(receipt).toEqual(s.plan);
    expect(next.activeTaskMessageId).not.toBe(s.activeTaskMessageId);
    expect(next.messages.at(-2)?.role).toBe("user");
    const failed = prepared(next, false);
    expect(taskUpdates(failed).at(-1)?.kind).toBe("failure");
    expectTaskCardRetained(next, failed);
    const changed = reducer(failed, {
      type: "UPDATE_PLAN",
      start: { kind: "immediate" },
      order: "reverse",
    });
    expect(
      changed.messages.find((m) => m.id === s.activeTaskMessageId)?.planReceipt,
    ).toEqual(receipt);
    expect(changed).toEqual(failed);
    expect(changed.plan?.order).toBe("forward");
    expect(changed.activeTaskMessageId).toBe(failed.activeTaskMessageId);
  });
  it("预约失效后澄清并再次确认，沿用任务回复且保留原始计划快照", () => {
    const original = reducer(filtered(), {
      type: "UPDATE_PLAN",
      start: { kind: "scheduled", at: NOW + 60000 },
      order: "forward",
    });
    const firstConfirmation = confirm(original);
    const originalReceipt = firstConfirmation.messages.find(
      (message) => message.id === original.activeTaskMessageId,
    )!;
    const failed = prepared(firstConfirmation, false);
    const expired = prepared(
      reducer(failed, { type: "RETRY", now: NOW + 61000 }),
    );
    expectTaskCardRetained(firstConfirmation, expired);
    expect(expired.phase).toBe("clarify");
    expect(taskUpdates(expired).at(-1)).toMatchObject({
      kind: "question",
      text: expect.stringContaining("请重新选择开始时间并确认"),
    });
    const answered = reducer(expired, { type: "SEND", text: "现在开始" });
    expect(answered.messages.at(-2)?.text).toBe("现在开始");
    expect(answered.messages.at(-1)?.text).toContain(
      "请核对地图与任务卡后确认",
    );
    expect(taskUpdates(answered)).toEqual(taskUpdates(expired));
    expect(answered.confirmedRevision).toBeNull();
    expect(answered.dispatchCount).toBe(0);
    const updated = reducer(answered, {
      type: "UPDATE_PLAN",
      start: { kind: "immediate" },
      order: "reverse",
    });
    expectTaskCardRetained(expired, updated);
    const reconfirmed = confirm(updated);
    expect(reconfirmed.messages.length).toBe(updated.messages.length + 1);
    expect(reconfirmed.messages.at(-1)?.role).toBe("user");
    expect(reconfirmed.activeTaskMessageId).toBe(
      firstConfirmation.activeTaskMessageId,
    );
    expectTaskCardRetained(updated, reconfirmed);
    expect(taskUpdates(reconfirmed).at(-1)?.text).toContain(
      "更新后的计划已确认",
    );
    expect(
      reconfirmed.messages.filter((message) => message.taskId),
    ).toHaveLength(1);
    expect(
      reconfirmed.messages.find(
        (message) => message.id === original.activeTaskMessageId,
      ),
    ).toEqual(originalReceipt);
    expect(originalReceipt.planReceipt).toEqual(original.plan);
    expect(confirm(reconfirmed)).toEqual(reconfirmed);
    const dispatching = prepared(reconfirmed);
    const acknowledged = reducer(dispatching, {
      type: "ACK",
      session: dispatching.session,
      revision: dispatching.plan!.revision,
    });
    expectTaskCardRetained(reconfirmed, acknowledged);
    expect(acknowledged.dispatchCount).toBe(1);
  });
});

describe("明确筛选条件来源", () => {
  it("只说区域或引用区域不会擅自采用电量条件", () => {
    const named = reducer(initialState(NOW), {
      type: "SEND",
      text: "安排 A 区巡检",
    });
    expect(named.plan).toBeNull();
    expect(named.messages[0].text).toBe("安排 A 区巡检");
    expect(named.messages.at(-1)?.kind).toBe("setup");
    const context = reducer(initialState(NOW), {
      type: "ADD_CONTEXT",
      id: "zone-a",
    });
    const referenced = reducer(context, { type: "SEND", text: "安排巡检" });
    expect(referenced.plan).toBeNull();
    expect(referenced.messages[0].refs).toEqual(["zone-a"]);
  });
  it("原题完整指令保留原文并直接应用用户给定规则", () => {
    const s = reducer(initialState(NOW), {
      type: "SEND",
      text: originalRequest,
    });
    expect(s.phase).toBe("preview");
    expect(s.messages[0].text).toBe(originalRequest);
    expect(s.dispatchCount).toBe(0);
  });
  it("规则确认后记录实际选择，不伪造题目原句", () => {
    const s = filtered();
    expect(s.messages[0].text).toContain("使用预设条件");
    expect(s.messages[0].text).toContain("电量 > 50%");
    expect(s.messages[0].text).not.toBe(originalRequest);
    // Invalid runtime payloads must not silently bypass UI confirmation.
    expect(
      reducer(initialState(NOW), {
        type: "FILTER",
        criteriaConfirmed: false,
      } as never).plan,
    ).toBeNull();
  });
  it("不使用预设只查看设备，不筛选、不建计划或下发", () => {
    const s = reducer(initialState(NOW), { type: "INSPECT_DEVICES" });
    expect(s.plan).toBeNull();
    expect(s.filtered).toBe(false);
    expect(s.dispatchCount).toBe(0);
    expect(s.planningRegion).toBe("zone-a");
    expect(s.messages.at(-1)?.kind).toBe("inventory");
    expect(s.messages.at(-1)?.text).toContain("设备 B：在线，电量 35%");
    expect(s.messages.at(-1)?.text).toContain(
      "设备 C：离线，电量 90%（时效未知）",
    );
    expect(s.messages.at(-1)?.text).not.toContain("未超过");
  });
  it("查看设备后可明确输入条件，保留真实输入并预览建议时间", () => {
    const inspected = reducer(initialState(NOW), { type: "INSPECT_DEVICES" });
    const s = reducer(inspected, {
      type: "SEND",
      text: "选择在线且电量超过50%的设备",
    });
    expect(s.plan?.regionId).toBe("zone-a");
    expect(s.phase).toBe("preview");
    expect(s.messages.at(-2)?.text).toBe("选择在线且电量超过50%的设备");
    expect(s.dispatchCount).toBe(0);
    const reset = reducer(s, { type: "RESET", now: NOW });
    expect(reset.planningRegion).toBeNull();
  });
});
function running() {
  const s = prepared(confirm());
  return reducer(s, {
    type: "ACK",
    session: s.session,
    revision: s.plan!.revision,
  });
}
describe("暂停、继续与停止", () => {
  it("暂停冻结进度，继续从原位置推进且不再次下发", () => {
    const before = reducer(running(), {
      type: "PROGRESS",
      session: 1,
      progress: 48,
    });
    const paused = reducer(before, { type: "PAUSE" });
    expectTaskCardRetained(before, paused);
    expect(paused.phase).toBe("paused");
    expect(currentTask(paused, "A")).toContain("已暂停");
    expect(paused.progress).toBe(48);
    expect(
      reducer(paused, { type: "PROGRESS", session: 1, progress: 90 }),
    ).toEqual(paused);
    const resumed = reducer(paused, { type: "RESUME" });
    expect(resumed.phase).toBe("running");
    expect(resumed.progress).toBe(48);
    expect(resumed.dispatchCount).toBe(1);
    expect(
      reducer(resumed, { type: "PROGRESS", session: 1, progress: 50.5 })
        .progress,
    ).toBe(50.5);
    expectTaskCardRetained(paused, resumed);
  });
  it("执行和暂停均可停止，停止保留进度和轨迹且拒绝迟到事件", () => {
    const progress = reducer(running(), {
      type: "PROGRESS",
      session: 1,
      progress: 48,
    });
    for (const s of [progress, reducer(progress, { type: "PAUSE" })]) {
      const stopped = reducer(s, { type: "STOP" });
      expect(stopped.phase).toBe("stopped");
      expect(stopped.progress).toBe(48);
      expect(currentTask(stopped, "A")).toBe("空闲");
      expect(routePosition(routePoints("forward"), stopped.progress)).toEqual(
        routePosition(routePoints("forward"), progress.progress),
      );
      expect(
        reducer(stopped, { type: "PROGRESS", session: 1, progress: 100 }),
      ).toEqual(stopped);
      expect(reducer(stopped, { type: "RESUME" })).toEqual(stopped);
      expect(
        reducer(stopped, {
          type: "ACK",
          session: 1,
          revision: stopped.plan!.revision,
        }),
      ).toEqual(stopped);
      expect(stopped.dispatchCount).toBe(1);
      expectTaskCardRetained(s, stopped);
      expect(taskUpdates(stopped).at(-1)?.text).toContain("巡检已停止");
      expect(taskUpdates(stopped).at(-1)?.kind).toBe("result");
    }
  });
  it("无执行任务时控制无效，重复暂停不会追加消息", () => {
    for (const s of [initialState(NOW), preview(), prepared(confirm())]) {
      expect(reducer(s, { type: "PAUSE" })).toEqual(s);
      expect(reducer(s, { type: "RESUME" })).toEqual(s);
      expect(reducer(s, { type: "STOP" })).toEqual(s);
    }
    const paused = reducer(running(), { type: "PAUSE" });
    expect(reducer(paused, { type: "PAUSE" })).toEqual(paused);
  });
  it("未来预约重试继续等待，预约过期则清除旧确认", () => {
    const scheduled = reducer(filtered(), {
      type: "UPDATE_PLAN",
      start: { kind: "scheduled", at: NOW + 60000 },
      order: "forward",
    });
    const failed = prepared(confirm(scheduled), false);
    const retrying = reducer(failed, { type: "RETRY", now: NOW + 10000 });
    expect(reducer(retrying, { type: "RETRY", now: NOW + 10000 })).toEqual(
      retrying,
    );
    const ready = prepared(retrying);
    expect(ready.phase).toBe("scheduled");
    expect(ready.dispatchCount).toBe(0);
    expect(ready.confirmedRevision).toBe(ready.plan!.revision);
    const expired = prepared(
      reducer(failed, { type: "RETRY", now: NOW + 61000 }),
    );
    expect(expired.phase).toBe("clarify");
    expect(expired.confirmedRevision).toBeNull();
    expect(expired.dispatchCount).toBe(0);
  });
});
