import { Button, Popconfirm, type ButtonProps } from "antd";
import {
  CaretRightOutlined,
  PauseOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { usePatrol } from "../state/PatrolContext";

/** The task bar and current task card expose the same execution actions. */
export default function ExecutionControls({
  size = "small",
  primary = false,
  onAction,
}: {
  size?: ButtonProps["size"];
  primary?: boolean;
  onAction?: () => void;
}) {
  const { state, dispatch } = usePatrol();
  if (!["running", "paused"].includes(state.phase)) return null;
  const paused = state.phase === "paused";
  return (
    <>
      <Popconfirm
        title="停止本次巡检？"
        description="保留已走轨迹，停止后不能继续本次任务。"
        okText="停止巡检"
        cancelText="取消"
        onConfirm={() => {
          onAction?.();
          dispatch({ type: "STOP" });
        }}
      >
        <Button size={size} icon={<StopOutlined />}>
          停止
        </Button>
      </Popconfirm>
      <Button
        size={size}
        type={primary ? "primary" : "default"}
        icon={paused ? <CaretRightOutlined /> : <PauseOutlined />}
        onClick={() => {
          onAction?.();
          dispatch({ type: paused ? "RESUME" : "PAUSE" });
        }}
      >
        {paused ? "继续" : "暂停"}
      </Button>
    </>
  );
}
