import { useEffect, useRef, useState } from "react";
import { Alert, Button, DatePicker, Progress, Radio, Select } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { usePatrol } from "../state/PatrolContext";
import {
  phaseLabels,
  startLabel,
  type Plan,
  type RouteOrder,
  type StartTime,
} from "../domain/model";
import { ObjectLink } from "./Objects";
import ExecutionControls from "./ExecutionControls";

export function PlanReceipt({ plan }: { plan: Plan }) {
  return (
    <div className="plan-receipt" aria-label="已确认的历史计划">
      <span className="receipt-label">
        <CheckCircleOutlined />
        已确认的计划
      </span>
      <div>
        <ObjectLink id={plan.deviceId} />
        <span>→</span>
        <ObjectLink id={plan.regionId} />
      </div>
      <p>
        {startLabel(plan.start)} ·{" "}
        {plan.order === "forward" ? "顺向巡检" : "逆向巡检"}
      </p>
    </div>
  );
}

export default function TaskCard({ onAdvance }: { onAdvance: () => void }) {
  const { state, dispatch } = usePatrol();
  const cardRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"immediate" | "scheduled">("immediate");
  const [at, setAt] = useState<dayjs.Dayjs | null>(null);
  const [order, setOrder] = useState<RouteOrder>("forward");
  useEffect(() => setEditing(false), [state.session, state.plan?.revision]);
  const plan = state.plan;
  if (!plan) return null;
  const editable = ["preview", "clarify"].includes(state.phase);
  const busy = ["preparing", "retrying", "dispatching"].includes(state.phase);
  const failed = state.phase === "preparationFailed";
  const done = state.phase === "completed";
  const paused = state.phase === "paused";
  const stopped = state.phase === "stopped";
  const timeInvalid =
    mode === "scheduled" &&
    (!at || at.valueOf() <= Math.max(Date.now(), state.now));
  function openEdit(scheduledOnly = false) {
    setMode(
      scheduledOnly || plan!.start?.kind === "scheduled"
        ? "scheduled"
        : "immediate",
    );
    setAt(
      plan!.start?.kind === "scheduled"
        ? dayjs(plan!.start.at).tz("Asia/Shanghai")
        : dayjs(Math.max(Date.now(), state.now) + 15 * 60000)
            .tz("Asia/Shanghai")
            .second(0),
    );
    setOrder(plan!.order);
    setEditing(true);
    requestAnimationFrame(() =>
      cardRef.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
  }
  function save() {
    if (timeInvalid) return;
    const start: StartTime =
      mode === "immediate"
        ? { kind: "immediate" }
        : { kind: "scheduled", at: at!.valueOf() };
    dispatch({ type: "UPDATE_PLAN", start, order });
    setEditing(false);
  }
  return (
    <section
      ref={cardRef}
      className={"task-card " + (failed && !editing ? "task-failed" : "")}
      aria-label="当前巡检任务"
      data-testid="task-card"
      data-editing={editing}
    >
      <div className="task-card-heading">
        <strong>{editing ? "修改巡检计划" : "A 区巡检"}</strong>
        <span
          className={
            "task-phase " +
            (failed && !editing
              ? "error-text"
              : done
                ? "success-text"
                : paused
                  ? "warning-text"
                  : stopped
                    ? "muted"
                    : "")
          }
        >
          <i
            style={paused ? { background: "var(--warning-text)" } : undefined}
            className={
              "status-dot " +
              (failed && !editing
                ? "error"
                : done
                  ? "online"
                  : stopped
                    ? "offline"
                    : "blue")
            }
          />
          {editing ? "编辑中" : failed ? "准备失败" : phaseLabels[state.phase]}
        </span>
      </div>
      <div className="plan-body">
        {editing ? (
          <div className="inline-plan-editor">
            <div className="edit-summary">
              <ObjectLink id="A" />
              <span>→</span>
              <ObjectLink id="zone-a" />
            </div>
            <div className="editor-field">
              <label>开始时间</label>
              <Radio.Group
                aria-label="开始时间方式"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                options={[
                  { label: "立即开始", value: "immediate" },
                  { label: "指定时间", value: "scheduled" },
                ]}
              />
            </div>
            {mode === "scheduled" && (
              <div className="editor-field">
                <DatePicker
                  aria-label="巡检开始时间"
                  showTime={{ format: "HH:mm" }}
                  format="YYYY-MM-DD HH:mm"
                  value={at}
                  onChange={setAt}
                  allowClear={false}
                  disabledDate={(d) => d.endOf("day").valueOf() < state.now}
                />
                <small className={timeInvalid ? "warning-text" : "muted"}>
                  {timeInvalid
                    ? "请选择晚于当前时间的时间"
                    : "北京时间（UTC+8）"}
                </small>
              </div>
            )}
            <div className="editor-field">
              <label htmlFor="route-order">巡检顺序</label>
              <Select
                id="route-order"
                aria-label="巡检顺序"
                value={order}
                onChange={setOrder}
                options={[
                  { label: "顺向巡检", value: "forward" },
                  { label: "逆向巡检", value: "reverse" },
                ]}
              />
            </div>
            <p className="editor-hint">
              保存后更新地图预览，仍需确认计划才会执行。
            </p>
          </div>
        ) : (
          <>
            {editable ? (
              <dl className="plan-details">
                <div>
                  <dt>执行设备</dt>
                  <dd>
                    <ObjectLink id="A" />
                    <span className="tiny success-text">在线 · 80%</span>
                  </dd>
                </div>
                <div>
                  <dt>巡检区域</dt>
                  <dd>
                    <ObjectLink id="zone-a" />
                    <span className="tiny muted">集装箱作业区</span>
                  </dd>
                </div>
                <div>
                  <dt>开始时间</dt>
                  <dd className={!plan.start ? "warning-text" : ""}>
                    {startLabel(plan.start)}
                  </dd>
                </div>
                {plan.start && (
                  <div>
                    <dt>巡检顺序</dt>
                    <dd>
                      {plan.order === "forward" ? "顺向巡检" : "逆向巡检"}
                      <span className="tiny muted">6 个路线点</span>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="task-summary">
                <ObjectLink id="A" />
                <span>·</span>
                <ObjectLink id="zone-a" />
                <span>·</span>
                <span>{startLabel(plan.start)}</span>
              </div>
            )}
            {state.phase === "clarify" && (
              <div className="time-clarify">
                <p>
                  <ClockCircleOutlined />
                  你希望什么时候开始？
                </p>
                <div className="two-actions">
                  <Button
                    icon={<CalendarOutlined />}
                    onClick={() => openEdit(true)}
                  >
                    指定时间
                  </Button>
                  <Button
                    type="primary"
                    onClick={() =>
                      dispatch({
                        type: "UPDATE_PLAN",
                        start: { kind: "immediate" },
                        order: plan.order,
                      })
                    }
                  >
                    确认后立即开始
                  </Button>
                </div>
              </div>
            )}
            {state.phase === "preview" && (
              <p className="preview-note">
                <span className="mini-line" />
                核对地图路线后，确认执行
              </p>
            )}
            {failed && (
              <div className="failure-explanation">
                <p>模拟路线准备返回失败，任务尚未下发。</p>
                <p>原计划无需修改，可重新准备路线；成功后按已确认计划继续。</p>
              </div>
            )}
            {state.phase === "scheduled" && (
              <p className="scheduled-note">
                <ClockCircleOutlined />
                到预约时间自动下发
              </p>
            )}
            {busy && (
              <div className="busy-state">
                <span className="loading-ring" />
                {state.phase === "dispatching"
                  ? "等待设备接收任务"
                  : state.phase === "retrying"
                    ? "正在重新准备巡检路线，尚未下发"
                    : "正在准备巡检路线，尚未下发"}
              </div>
            )}
            {(state.phase === "running" || paused || stopped || done) && (
              <div className="execution-progress">
                <div>
                  <span>
                    {done
                      ? "全部路线点已完成"
                      : paused
                        ? "已暂停 · 位置与进度已保留"
                        : stopped
                          ? "已停止 · 保留已走轨迹"
                          : "设备正在沿路线巡检"}
                  </span>
                  <strong>{Math.round(state.progress)}%</strong>
                </div>
                <Progress
                  percent={state.progress}
                  showInfo={false}
                  strokeColor={
                    done
                      ? "#95de64"
                      : paused
                        ? "#ffd666"
                        : stopped
                          ? "#8c8c8c"
                          : "#69b1ff"
                  }
                  size="small"
                />
                {(done || stopped) && (
                  <p className="success-text">
                    <CheckCircleOutlined />
                    设备已恢复空闲
                  </p>
                )}
              </div>
            )}
            {(state.phase === "running" || paused) && (
              <div className="two-actions" style={{ marginTop: 16 }}>
                <ExecutionControls size="middle" primary onAction={onAdvance} />
              </div>
            )}
          </>
        )}
        {state.error && <Alert type="warning" showIcon title={state.error} />}
      </div>
      {(editing || state.phase === "preview" || failed) && (
        <div className={"task-actions" + (failed ? " single-action" : "")}>
          {editing ? (
            <>
              <Button onClick={() => setEditing(false)}>取消</Button>
              <Button type="primary" disabled={timeInvalid} onClick={save}>
                保存修改
              </Button>
            </>
          ) : failed ? (
            <>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                title="按已确认的原计划重新准备路线，成功后继续执行"
                onClick={() => {
                  onAdvance();
                  dispatch({ type: "RETRY", now: Date.now() });
                }}
              >
                重新准备路线
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => openEdit()}>修改计划</Button>
              <Button
                type="primary"
                onClick={() => {
                  onAdvance();
                  dispatch({
                    type: "CONFIRM",
                    revision: plan.revision,
                    now: Date.now(),
                  });
                }}
              >
                确认计划
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
