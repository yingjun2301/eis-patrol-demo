import { useEffect, useState } from "react";
import { Button, Popconfirm, Popover, Switch, theme } from "antd";
import {
  ControlOutlined,
  FastForwardOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { usePatrol } from "./state/PatrolContext";
import { fmtTime } from "./domain/model";
import SituationMap from "./components/SituationMap";
import Conversation from "./components/Conversation";
export default function App() {
  const { state, dispatch } = usePatrol();
  const [collapsed, setCollapsed] = useState(false);
  const [assistantHidden, setAssistantHidden] = useState(false);
  useEffect(() => {
    if (state.focused) setCollapsed(false);
  }, [state.focusNonce]);
  useEffect(() => {
    if (state.context.length) setAssistantHidden(false);
  }, [state.context.length]);
  const { token } = theme.useToken();
  const faultEnabled = [
    "idle",
    "clarify",
    "preview",
    "preparationFailed",
  ].includes(state.phase);
  const style = {
    "--bg-layout": token.colorBgLayout,
    "--bg-panel": token.colorBgContainer,
    "--bg-elevated": token.colorBgElevated,
    "--text": token.colorText,
    "--text-secondary": token.colorTextSecondary,
    "--text-tertiary": token.colorTextTertiary,
    "--border": token.colorBorderSecondary,
    "--primary": token.colorPrimary,
    "--primary-text": token.colorPrimaryText,
    "--success": token.colorSuccess,
    "--warning": token.colorWarning,
    "--error": token.colorError,
    "--radius": token.borderRadius + "px",
  } as React.CSSProperties;
  return (
    <div
      className={
        "app " +
        (collapsed ? "devices-collapsed " : "") +
        (assistantHidden ? "assistant-collapsed" : "")
      }
      style={style}
    >
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <strong>EIS</strong>
          <span className="brand-divider" />
          <h1>巡检调度</h1>
        </div>
        <div className="header-actions">
          <Button
            className="toolbar-action"
            type="text"
            icon={<UnorderedListOutlined />}
          >
            任务列表
          </Button>
          <Popover
            arrow={false}
            placement="bottomRight"
            trigger="click"
            content={
              <div className="demo-controls">
                <strong>演示控制</strong>
                <div className="fault-switch">
                  <span>模拟一次路线准备失败</span>
                  <Switch
                    aria-label="模拟路线准备失败"
                    size="small"
                    checked={state.faultNext}
                    disabled={!faultEnabled}
                    onChange={(enabled) =>
                      dispatch({ type: "SET_FAULT", enabled })
                    }
                  />
                </div>
                <Button
                  block
                  icon={<FastForwardOutlined />}
                  disabled={state.phase !== "scheduled"}
                  onClick={() => dispatch({ type: "FAST_FORWARD" })}
                >
                  推进到预约时间
                </Button>
                <Popconfirm
                  title="重置本次演示？"
                  description="清除当前计划、对话和模拟进度。"
                  onConfirm={() =>
                    dispatch({ type: "RESET", now: Date.now() })
                  }
                  okText="重置"
                  cancelText="取消"
                >
                  <Button block icon={<ReloadOutlined />}>
                    重新演示
                  </Button>
                </Popconfirm>
                <div className="demo-audit">
                  <span>模拟时间 {fmtTime(state.now)}</span>
                  <span>下发 {state.dispatchCount} 次</span>
                </div>
              </div>
            }
          >
            <Button
              className="toolbar-action"
              type="text"
              icon={<ControlOutlined />}
            >
              演示控制
            </Button>
          </Popover>
        </div>
      </header>
      <main className="workspace">
        <SituationMap
          collapsed={collapsed}
          onToggleObjects={() => setCollapsed(!collapsed)}
          assistantHidden={assistantHidden}
          onShowAssistant={() => setAssistantHidden(false)}
        />
        <Conversation
          hidden={assistantHidden}
          onCollapse={() => setAssistantHidden(true)}
        />
      </main>
    </div>
  );
}
