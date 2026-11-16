import { Button } from "antd";
import {
  ReloadOutlined,
  CloseOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { usePatrol } from "../state/PatrolContext";
import { phaseLabels } from "../domain/model";
import ExecutionControls from "./ExecutionControls";

/** Same domain state as TaskCard; stays mounted when the assistant is hidden. */
export default function CurrentTaskBar({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = usePatrol();
  if (!state.plan) return null;
  const failed = state.phase === "preparationFailed";
  const progress = ["running", "paused", "stopped", "completed"].includes(
    state.phase,
  );
  return (
    <div
      className={"current-task-bar " + (failed ? "failure-strip" : "")}
      data-testid="current-task-bar"
      aria-label="当前任务状态"
    >
      <div className="task-brief" role="status">
        {failed ? (
          <WarningOutlined />
        ) : (
          <i
            className={
              "status-dot " +
              (state.phase === "completed"
                ? "online"
                : state.phase === "paused"
                  ? "paused"
                  : state.phase === "stopped"
                    ? "offline"
                    : "blue")
            }
          />
        )}
        <strong>A 区巡检</strong>
        <span className="dot-divider">·</span>
        <span>
          {failed
            ? "准备失败 · 未开始"
            : state.phase === "running"
              ? "执行中"
              : state.phase === "completed"
                ? "已完成"
                : phaseLabels[state.phase]}
        </span>
        {progress && (
          <>
            <span className="dot-divider">·</span>
            <span className="tabular">{Math.round(state.progress)}%</span>
          </>
        )}
      </div>
      <div className="task-bar-actions">
        {failed && (
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => dispatch({ type: "RETRY", now: Date.now() })}
          >
            重新准备路线
          </Button>
        )}
        <ExecutionControls />
        <Button
          type="text"
          size="small"
          aria-label="关闭任务状态栏"
          title="隐藏当前阶段的任务提示"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </div>
    </div>
  );
}
