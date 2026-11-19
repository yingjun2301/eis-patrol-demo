import { useEffect, useMemo, useState } from "react";
import { Alert, Button, DatePicker, Progress, Select } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { usePatrol } from "../state/PatrolContext";
import { phaseLabels, startLabel, type Plan } from "../domain/model";
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

/** The calendar commits a scheduled time or an explicit start-after-confirmation mode. */
function StartTimeField({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, dispatch } = usePatrol();
  const start = state.plan?.start;
  const now = Math.max(Date.now(), state.now);
  const timestamp = start?.kind === "scheduled" ? start.at : null;
  // Keep uncommitted calendar selections stable across simulation clock ticks.
  const selectedDate = useMemo(
    () =>
      timestamp === null
        ? null
        : dayjs(
            dayjs(timestamp).tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm"),
          ),
    [timestamp],
  );
  // Replace the picker shortcut itself: do not translate a timestamp into a mode.
  const components = useMemo(
    () => ({
      nowButton: function ImmediateStartButton({
        className,
      }: {
        className?: string;
      }) {
        return (
          <Button
            type="link"
            size="small"
            className={className}
            onClick={() => {
              dispatch({ type: "UPDATE_START", start: { kind: "immediate" } });
              onOpenChange(false);
            }}
          >
            确认后立即开始
          </Button>
        );
      },
    }),
    [dispatch, onOpenChange],
  );
  return (
    <DatePicker
      key={state.plan?.revision}
      components={components}
      popupAlign={{
        offset: [0, 0],
        overflow: { adjustX: true, adjustY: true, shiftY: true },
      }}
      className="plan-time-picker"
      aria-label="修改开始时间"
      placeholder="确认后立即开始"
      variant="borderless"
      size="small"
      showTime={{ format: "HH:mm" }}
      format="YYYY/MM/DD HH:mm"
      value={selectedDate}
      open={open}
      onOpenChange={onOpenChange}
      onChange={(value) => {
        if (!value) return;
        const at = dayjs
          .tz(value.format("YYYY-MM-DD HH:mm"), "Asia/Shanghai")
          .valueOf();
        if (at <= now) return;
        dispatch({ type: "UPDATE_START", start: { kind: "scheduled", at } });
        onOpenChange(false);
      }}
      needConfirm
      previewValue={false}
      inputReadOnly
      allowClear={false}
      showNow
      disabledDate={(date) =>
        date.format("YYYY-MM-DD") <
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
  );
}

export default function TaskCard({ onAdvance }: { onAdvance: () => void }) {
  const { state, dispatch } = usePatrol();
  const [pickerOpen, setPickerOpen] = useState(false);
  const editable = ["preview", "clarify"].includes(state.phase);
  useEffect(() => {
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
                </dd>
              </div>
              <div>
                <dt>开始时间</dt>
                <dd>
                  <StartTimeField
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                  />
                </dd>
              </div>
              <div>
                <dt>
                  <label htmlFor="route-order">巡检顺序</label>
                </dt>
                <dd>
                  <Select
                    id="route-order"
                    aria-label="巡检顺序"
                    className="plan-order-select"
                    size="small"
                    variant="borderless"
                    value={plan.order}
                    onChange={(order) =>
                      dispatch({ type: "UPDATE_ORDER", order })
                    }
                    options={[
                      { label: "顺向巡检", value: "forward" },
                      { label: "逆向巡检", value: "reverse" },
                    ]}
                  />
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
          {editable && timeInvalid && (
            <p className="preview-note warning-text">
              请选择晚于当前时间的时间
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
                  setPickerOpen(false);
                  dispatch({ type: "RESET_PLAN" });
                }}
              >
                重置
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
