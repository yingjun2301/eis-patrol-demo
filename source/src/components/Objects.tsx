import { useEffect, useState } from "react";
import {
  BorderOuterOutlined,
  DeploymentUnitOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { usePatrol } from "../state/PatrolContext";
import {
  currentTask,
  labelOf,
  type ObjectId,
  type Device,
} from "../domain/model";
export function ObjectIcon({ id }: { id: ObjectId }) {
  return id === "zone-a" ? <BorderOuterOutlined /> : <DeploymentUnitOutlined />;
}
export function ObjectLink({
  id,
  children,
}: {
  id: ObjectId;
  children?: React.ReactNode;
}) {
  const { dispatch } = usePatrol();
  return (
    <button
      className="object-link"
      onClick={() => dispatch({ type: "FOCUS", id })}
      title={"在地图定位" + labelOf(id)}
    >
      <ObjectIcon id={id} />
      {children || labelOf(id)}
    </button>
  );
}
export function Battery({ device }: { device: Device }) {
  return (
    <span
      className={
        "battery-reading " + (device.battery <= 50 ? "warning-text" : "")
      }
    >
      <span className="battery-icon">
        <span style={{ width: device.battery + "%" }} />
      </span>
      {device.battery}%
      {device.freshness === "unknown" && (
        <>
          <span className="muted tiny">时效未知</span>
          <Tooltip
            trigger={["hover", "focus"]}
            title="设备 C 已离线，90% 电量的更新时间未知，不能视为实时电量；地图位置为已知位置，仅供参考。"
          >
            <button
              className="info-button"
              aria-label="设备 C 离线数据说明"
              onClick={(e) => e.stopPropagation()}
            >
              <InfoCircleOutlined />
            </button>
          </Tooltip>
        </>
      )}
    </span>
  );
}
export function DeviceList({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { state, dispatch } = usePatrol();
  const [expanded, setExpanded] = useState<ObjectId | null>(null);
  useEffect(() => {
    if (state.focused) setExpanded(state.focused);
  }, [state.focused, state.focusNonce]);
  const addContext = (id: ObjectId) => (
    <Button
      className="object-context-action"
      block
      size="small"
      icon={<PlusOutlined />}
      disabled={state.context.includes(id)}
      onClick={(event) => {
        event.stopPropagation();
        dispatch({ type: "ADD_CONTEXT", id });
      }}
    >
      {state.context.includes(id) ? "已加入对话" : "加入对话"}
    </Button>
  );
  const toggle = (
    <Tooltip title={collapsed ? "展开对象栏" : "收起对象栏"}>
      <Button
        type="text"
        size="small"
        aria-label={collapsed ? "展开对象栏" : "收起对象栏"}
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={onToggle}
      />
    </Tooltip>
  );
  if (collapsed) {
    return (
      <aside
        className="device-panel device-panel-collapsed"
        aria-label="港区对象列表"
      >
        {toggle}
      </aside>
    );
  }
  return (
    <aside className="device-panel" aria-label="港区对象列表">
      <div className="device-scroll">
        <section aria-label="设备列表">
          <div className="section-label">
            <h3>设备</h3>
            {toggle}
          </div>
          <div className="device-list">
            {state.devices.map((d) => (
              <div
                key={d.id}
                className={
                  "device-row " + (state.focused === d.id ? "selected" : "")
                }
                onClick={() => {
                  if (state.focused === d.id) {
                    setExpanded((current) => (current === d.id ? null : d.id));
                  } else {
                    dispatch({ type: "FOCUS", id: d.id });
                  }
                }}
              >
                <div className="device-row-main">
                  <button
                    className="device-select"
                    aria-label={"查看设备 " + d.id + " 详情"}
                    aria-expanded={expanded === d.id}
                  >
                    <span className="object-icon-box">
                      <ObjectIcon id={d.id} />
                    </span>
                    <strong>设备 {d.id}</strong>
                    <span
                      className={
                        "connection " + (d.online ? "success-text" : "muted")
                      }
                    >
                      <i
                        className={
                          "status-dot " + (d.online ? "online" : "offline")
                        }
                      />
                      {d.online ? "在线" : "离线"}
                    </span>
                    <DownOutlined
                      className={
                        expanded === d.id
                          ? "device-chevron expanded"
                          : "device-chevron"
                      }
                    />
                  </button>
                  <div className="device-row-meta">
                    <Battery device={d} />
                  </div>
                </div>
                {expanded === d.id && (
                  <div className="device-expanded">
                    <dl>
                      <div>
                        <dt>当前任务</dt>
                        <dd>{currentTask(state, d.id)}</dd>
                      </div>
                      <div>
                        <dt>位置</dt>
                        <dd>
                          {d.id === "A" &&
                          [
                            "running",
                            "paused",
                            "stopped",
                            "completed",
                          ].includes(state.phase)
                            ? "A 区巡检路线"
                            : d.location}
                        </dd>
                      </div>
                    </dl>
                    {addContext(d.id)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="region-section" aria-label="巡检区域列表">
          <div className="section-label">
            <h3>巡检区域</h3>
          </div>
          <div
            className={
              "region-card " + (state.focused === "zone-a" ? "selected" : "")
            }
          >
            <button
              className="zone-row"
              onClick={() => dispatch({ type: "FOCUS", id: "zone-a" })}
            >
              <span className="object-icon-box">
                <ObjectIcon id="zone-a" />
              </span>
              <span>
                <strong>A 区</strong>
                <small>集装箱作业区</small>
              </span>
            </button>
            {expanded === "zone-a" && (
              <div className="region-expanded">
                <p>沿作业通道巡检</p>
                {addContext("zone-a")}
              </div>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
