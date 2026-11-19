import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Popover,
  Progress,
  Radio,
  Select,
} from "antd";
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

/** Both the field shortcut and expanded card edit the same draft time. */
function StartTimeEditor({
  onSelected,
  onPickerOpenChange,
}: {
  onSelected?: () => void;
  onPickerOpenChange: (open: boolean) => void;
}) {
  const { state, dispatch } = usePatrol();
  const start = state.plan?.start;
  const now = Math.max(Date.now(), state.now);
  const timestamp = start?.kind === "scheduled" ? start.at : null;
  // Clock ticks must not reset a calendar selection that has not been accepted yet.
  const selectedDate = useMemo(
    // The picker edits wall-clock fields; convert the chosen fields to Beijing
    // time on commit instead of letting its internal parser handle a TZ object.
    () =>
      timestamp === null
        ? null
        : dayjs(
            dayjs(timestamp).tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm"),
          ),
    [timestamp],
  );
  const choose = (value: StartTime) => {
    if (value.kind === "scheduled" && value.at <= now) return;
    onPickerOpenChange(false);
    dispatch({ type: "UPDATE_START", start: value });
    onSelected?.();
  };
  return (
    <div className="start-time-editor">
      <Radio.Group
        aria-label="开始时间方式"
        value={start?.kind}
        onChange={(e) => {
          if (e.target.value === "immediate") choose({ kind: "immediate" });
          else
            dispatch({
              type: "UPDATE_START",
              start: {
                kind: "scheduled",
                at: dayjs(now + 15 * 60000)
                  .second(0)
                  .millisecond(0)
                  .valueOf(),
              },
            });
        }}
        options={[
          { label: "确认后立即开始", value: "immediate" },
          { label: "指定时间", value: "scheduled" },
        ]}
      />
      {start?.kind === "scheduled" && (
        <>
          <DatePicker
            aria-label="巡检开始时间"
            showTime={{ format: "HH:mm" }}
            format="YYYY-MM-DD HH:mm"
            value={selectedDate}
            onChange={(value) => {
              if (value)
                choose({
                  kind: "scheduled",
                  at: dayjs
                    .tz(value.format("YYYY-MM-DD HH:mm"), "Asia/Shanghai")
                    .valueOf(),
                });
            }}
            onOpenChange={onPickerOpenChange}
            needConfirm
            previewValue={false}
            allowClear={false}
            showNow={false}
            disabledDate={(d) =>
              d.format("YYYY-MM-DD") <
              dayjs(now).tz("Asia/Shanghai").format("YYYY-MM-DD")
            }
            disabledTime={(date) => {
              const current = dayjs(now).tz("Asia/Shanghai");
              if (date?.format("YYYY-MM-DD") !== current.format("YYYY-MM-DD"))
                return {};
              return {
                disabledHours: () =>
                  Array.from({ length: current.hour() }, (_, i) => i),
                disabledMinutes: (hour) =>
                  hour === current.hour()
                    ? Array.from({ length: current.minute() + 1 }, (_, i) => i)
                    : [],
              };
            }}
          />
          <small className={start.at <= now ? "warning-text" : "muted"}>
            {start.at <= now ? "请选择晚于当前时间的时间" : "北京时间（UTC+8）"}
          </small>
        </>
      )}
    </div>
  );
}

export default function TaskCard({ onAdvance }: { onAdvance: () => void }) {
  const { state, dispatch } = usePatrol();
  const [editing, setEditing] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const editable = ["preview", "clarify"].includes(state.phase);
  useEffect(() => {
    setEditing(false);
    setTimeOpen(false);
    setPickerOpen(false);
  }, [state.session, editable]);
  const plan = state.plan;
  if (!plan) return null;
  const busy = ["preparing", "retrying", "dispatching"].includes(state.phase);
  const failed = state.phase === "preparationFailed";
  const done = state.phase === "completed";
  const paused = state.phase === "paused";
  const stopped = state.phase === "stopped";
  const timeInvalid =
    !plan.start ||
    (plan.start.kind === "scheduled" &&
      plan.start.at <= Math.max(Date.now(), state.now));
  return (
    <section
      className={"task-card " + (failed ? "task-failed" : "")}
      aria-label="当前巡检任务"
      data-testid="task-card"
      data-editing={editing}
    >
      <div className="task-card-heading">
        <strong>A 区巡检</strong>
        <span
          className={
            "task-phase " +
            (failed
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
              (failed
                ? "error"
                : done
                  ? "online"
                  : stopped
                    ? "offline"
                    : "blue")
            }
          />
          {failed ? "准备失败" : phaseLabels[state.phase]}
        </span>
      </div>
      <div className="plan-body">
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
              <div className={editing ? "plan-setting-expanded" : ""}>
                <dt>开始时间</dt>
                <dd>
                  {editing ? (
                    <StartTimeEditor onPickerOpenChange={setPickerOpen} />
                  ) : (
                    <>
                      <Popover
                        title="开始时间"
                        trigger="click"
                        arrow={false}
                        placement="bottomRight"
                        open={timeOpen}
                        onOpenChange={(open) => {
                          setTimeOpen(open);
                          if (!open) setPickerOpen(false);
                        }}
                        destroyOnHidden
                        content={
                          <StartTimeEditor
                            onPickerOpenChange={setPickerOpen}
                            onSelected={() => {
                              setTimeOpen(false);
                              setPickerOpen(false);
                            }}
                          />
                        }
                      >
                        <Button
                          type="text"
                          size="small"
                          className="plan-time-trigger"
                          aria-label="修改开始时间"
                        >
                          <span className={timeInvalid ? "warning-text" : ""}>
                            {startLabel(plan.start)}
                          </span>
                          <CalendarOutlined />
                        </Button>
                      </Popover>
                      {plan.startSuggested && (
                        <span className="tiny muted">建议</span>
                      )}
                    </>
                  )}
                </dd>
              </div>
              <div className={editing ? "plan-setting-expanded" : ""}>
                <dt>
                  <label htmlFor="route-order">巡检顺序</label>
                </dt>
                <dd>
                  <Select
                    id="route-order"
                    aria-label="巡检顺序"
                    className="plan-order-select"
                    size="small"
                    variant={editing ? "outlined" : "borderless"}
                    value={plan.order}
                    onChange={(order) =>
                      dispatch({ type: "UPDATE_ORDER", order })
                    }
                    options={[
                      { label: "顺向巡检", value: "forward" },
                      { label: "逆向巡检", value: "reverse" },
                    ]}
                  />
                  <span className="tiny muted">6 个路线点</span>
                </dd>
              </div>
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
          {editable && (
            <p className="preview-note">
              {plan.startSuggested
                ? "建议确认后立即开始，是否按此安排？"
                : !plan.start
                  ? "请选择开始时间，再确认计划。"
                  : "核对时间与地图路线后，确认执行。"}
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
        {state.error && <Alert type="warning" showIcon title={state.error} />}
      </div>
      {(editable || failed) && (
        <div className={"task-actions" + (failed ? " single-action" : "")}>
          {failed ? (
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
          ) : (
            <>
              <Button
                onClick={() => {
                  setTimeOpen(false);
                  setPickerOpen(false);
                  setEditing(!editing);
                }}
              >
                {editing ? "收起设置" : "修改计划"}
              </Button>
              <Button
                type="primary"
                disabled={timeInvalid || pickerOpen}
                onClick={() => {
                  onAdvance();
                  dispatch({
                    type: "CONFIRM",
                    revision: plan.revision,
                    now: Date.now(),
                  });
                }}
              >
                {plan.start?.kind === "immediate"
                  ? "确认并立即开始"
                  : "确认预约"}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
