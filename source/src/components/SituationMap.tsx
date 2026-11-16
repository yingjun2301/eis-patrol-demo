import { useEffect, useRef, useState } from "react";
import {
  AimOutlined,
  MinusOutlined,
  PlusOutlined,
  ExpandOutlined,
  EnvironmentOutlined,
  MenuFoldOutlined,
} from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { usePatrol } from "../state/PatrolContext";
import { type Point } from "../domain/model";
import {
  patrolPoints,
  pointsAttr,
  region,
  routePoints,
  routePosition,
} from "../domain/geometry";
import { DeviceList, ObjectIcon } from "./Objects";
import CurrentTaskBar from "./CurrentTaskBar";
function PortBase({ scale }: { scale: number }) {
  return (
    <g className="port-base" aria-hidden="true">
      <defs>
        <pattern
          id="water-lines"
          width="38"
          height="38"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-30)"
        >
          <path d="M0 0H38" stroke="#212121" strokeWidth="1" />
        </pattern>
        <pattern
          id="container-lines"
          width="7"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path d="M1 0V8" stroke="#3c3c3c" strokeWidth=".7" />
        </pattern>
        <pattern
          id="land-grid"
          width="50"
          height="50"
          patternUnits="userSpaceOnUse"
        >
          <path d="M50 0H0V50" fill="none" stroke="#202020" strokeWidth=".8" />
        </pattern>
      </defs>
      <rect width="1000" height="800" fill="#111111" />
      <rect width="1000" height="800" fill="url(#water-lines)" />
      <path
        d="M-100-100H1100V210H900V330H850V440H755V610H650V690H-100Z"
        fill="#191919"
        stroke="#3b3b3b"
        strokeWidth="2"
      />
      <path
        d="M-100-100H1100V210H900V330H850V440H755V610H650V690H-100Z"
        fill="url(#land-grid)"
      />
      <g fill="#222" stroke="#3a3a3a">
        <path d="M650 605H850V650H650Z" />
        <path d="M745 465H950V510H745Z" />
        <path d="M840 350H975V390H840Z" />
      </g>
      <g fill="none" strokeLinecap="round">
        <path
          d="M-20 225H795M265 95V680M675 150V570M80 590H650M80 480H640M120 130V590"
          stroke="#101010"
          strokeWidth="24"
        />
        <path
          d="M-20 225H795M265 95V680M675 150V570M80 590H650M80 480H640M120 130V590"
          stroke="#383838"
          strokeWidth="1.5"
          strokeDasharray="9 9"
        />
        <path d="M330 125H610M90 640H590" stroke="#3c3c3c" strokeWidth="2" />
      </g>
      {[
        { x: 330, y: 140, w: 125, h: 45 },
        { x: 485, y: 140, w: 125, h: 45 },
        { x: 700, y: 145, w: 115, h: 46 },
        { x: 700, y: 280, w: 100, h: 60 },
        { x: 145, y: 300, w: 70, h: 110 },
        { x: 150, y: 520, w: 65, h: 40 },
      ].map((b, i) => (
        <g key={i}>
          <rect
            x={b.x + 4}
            y={b.y + 4}
            width={b.w}
            height={b.h}
            rx="3"
            fill="#101010"
          />
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="3"
            fill="#292929"
            stroke="#454545"
          />
          <path
            d={"M" + b.x + " " + (b.y + b.h / 2) + "h" + b.w}
            stroke="#3a3a3a"
          />
        </g>
      ))}
      {[350, 480].map((x) =>
        [330, 380, 430].map((y) => (
          <g key={x + "-" + y}>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <rect
                  x={x + i * 16}
                  y={y}
                  width="12"
                  height="33"
                  rx="1"
                  fill={i % 3 === 0 ? "#3b3b3b" : "#303030"}
                  stroke="#484848"
                />
                <rect
                  x={x + i * 16}
                  y={y}
                  width="12"
                  height="33"
                  fill="url(#container-lines)"
                />
              </g>
            ))}
          </g>
        )),
      )}
      <g fill="#282828" stroke="#454545">
        <path d="M790 540h112l17 18-17 18H790l-9-18Z" />
        <rect x="798" y="547" width="18" height="22" rx="2" />
        <rect x="830" y="547" width="50" height="22" />
        <path d="M695 676h108l16 18-16 18H695l-9-18Z" />
        <rect x="705" y="683" width="18" height="22" />
        <rect x="738" y="683" width="48" height="22" />
      </g>
      <g stroke="#555" fill="none" strokeWidth="2">
        {[710, 780, 850].map((x, i) => (
          <g key={x}>
            <path
              d={
                "M" +
                x +
                " " +
                (i === 2 ? 480 : 620) +
                "v-35h30v35m-15-35v-10h40"
              }
            />
          </g>
        ))}
      </g>
      <g
        fill="#717171"
        fontFamily="inherit"
        fontSize={Math.max(16, 12 / scale)}
        letterSpacing="2"
      >
        <text x="370" y="115">
          北 侧 仓 储 区
        </text>
        <text x="150" y="195">
          西 侧 集 结 点
        </text>
        <text x="790" y="435">
          02 泊位
        </text>
        <text x="700" y="598">
          01 泊位
        </text>
        <text x="80" y="740">
          港 区 作 业 岸 线
        </text>
      </g>
      <text
        x="805"
        y="735"
        fill="#555"
        fontSize={Math.max(23, 16 / scale)}
        letterSpacing="6"
      >
        港池
      </text>
    </g>
  );
}
export default function SituationMap({
  collapsed,
  onToggleObjects,
  assistantHidden,
  onShowAssistant,
}: {
  collapsed: boolean;
  onToggleObjects: () => void;
  assistantHidden: boolean;
  onShowAssistant: () => void;
}) {
  const { state, dispatch } = usePatrol();
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  const noticeKey = `${state.session}:${state.phase}`;
  const noticeVisible = !!state.plan && dismissedNotice !== noticeKey;
  const [view, setView] = useState({ x: 490, y: 420, zoom: 1.08 });
  const drag = useRef<{ start: Point; center: Point; moved: boolean } | null>(
    null,
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 700, height: 700 });
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const screenScale = Math.max(
    0.01,
    Math.min(size.width / 1000, size.height / 800) * view.zoom,
  );
  const labelScale = 1 / screenScale;
  const resetView = () => {
    setView({ x: 490, y: 420, zoom: 1.08 });
    dispatch({ type: "FOCUS", id: null });
  };
  const points = routePoints(state.plan?.order || "forward");
  const waypoints = patrolPoints(state.plan?.order || "forward");
  const movement = routePosition(points, state.progress);
  const hasRoute = !!state.plan?.start;
  const activeMotion = ["running", "paused", "stopped", "completed"].includes(
    state.phase,
  );
  useEffect(() => {
    if (!state.focused) return;
    const p =
      state.focused === "zone-a"
        ? { x: 465, y: 400 }
        : state.focused === "A" && activeMotion
          ? movement.position
          : state.devices.find((d) => d.id === state.focused)!.position;
    setView({ x: p.x, y: p.y, zoom: state.focused === "zone-a" ? 1.45 : 1.65 });
    // Focus is an explicit interaction; execution does not repeatedly steal the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.focusNonce, state.session]);
  useEffect(() => {
    setView({ x: 490, y: 420, zoom: 1.08 });
  }, [state.session]);
  useEffect(() => {
    // A new or edited plan must be fully visible, even after inspecting another device.
    if (state.plan) setView({ x: 490, y: 420, zoom: 1.2 });
  }, [state.plan?.revision]);
  const changeZoom = (delta: number) =>
    setView((v) => ({
      ...v,
      zoom: Math.max(0.8, Math.min(2.5, v.zoom + delta)),
    }));
  const viewBox = [
    view.x - 500 / view.zoom,
    view.y - 400 / view.zoom,
    1000 / view.zoom,
    800 / view.zoom,
  ].join(" ");
  const choose = (id: "A" | "B" | "C" | "zone-a") => {
    if (!drag.current?.moved) dispatch({ type: "FOCUS", id });
  };
  return (
    <section className="map-panel" aria-label="港区态势地图">
      <div className="module-heading map-heading">
        <div className="situation-title">
          <h2>港区态势</h2>
        </div>
        <div className="map-header-actions">
          {assistantHidden && (
            <Button
              className="toolbar-action toolbar-action-secondary"
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={onShowAssistant}
            >
              打开助手
            </Button>
          )}
        </div>
      </div>
      <div className={"situation-body " + (collapsed ? "objects-hidden" : "")}>
        <DeviceList collapsed={collapsed} onToggle={onToggleObjects} />
        <div className="map-stage">
          <div className="map-canvas" data-testid="map-canvas">
            <svg
              ref={svgRef}
              className="map-svg"
              viewBox={viewBox}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                drag.current = {
                  start: { x: e.clientX, y: e.clientY },
                  center: { x: view.x, y: view.y },
                  moved: false,
                };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || !svgRef.current || !(e.buttons & 1)) return;
                const scale = Math.min(
                  svgRef.current.clientWidth / (1000 / view.zoom),
                  svgRef.current.clientHeight / (800 / view.zoom),
                );
                const dx = (e.clientX - d.start.x) / scale,
                  dy = (e.clientY - d.start.y) / scale;
                if (Math.abs(dx) + Math.abs(dy) > 5) {
                  d.moved = true;
                  setView((v) => ({
                    ...v,
                    x: Math.max(0, Math.min(1000, d.center.x - dx)),
                    y: Math.max(0, Math.min(800, d.center.y - dy)),
                  }));
                }
              }}
              onPointerUp={() =>
                window.setTimeout(() => {
                  drag.current = null;
                }, 0)
              }
              onPointerLeave={() => {
                drag.current = null;
              }}
            >
              <PortBase scale={screenScale} />
              <g
                role="button"
                tabIndex={0}
                aria-label="地图上的 A 区"
                data-testid="map-zone"
                onClick={() => choose("zone-a")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose("zone-a");
                  }
                }}
                className="map-object"
              >
                <rect
                  x={region.x}
                  y={region.y}
                  width={region.width}
                  height={region.height}
                  rx="7"
                  fill={state.filtered ? "#1668dc20" : "#1668dc0c"}
                  stroke={state.filtered ? "#4096ff" : "#486991"}
                  strokeWidth={state.focused === "zone-a" ? 3 : 2}
                  strokeDasharray={state.filtered ? "none" : "8 5"}
                />
                <g
                  transform={`translate(${region.x + 12},${region.y}) scale(${labelScale})`}
                >
                  <rect
                    x="0"
                    y="-16"
                    width="152"
                    height="30"
                    rx="6"
                    fill="#1d2b3c"
                    stroke="#305b8c"
                  />
                  <text
                    x="12"
                    y="4"
                    fill="#91caff"
                    fontSize="14"
                    fontWeight="600"
                  >
                    A 区 · 巡检范围
                  </text>
                </g>
              </g>
              {hasRoute && (
                <g
                  data-testid="planned-route"
                  data-order={state.plan!.order}
                  aria-label="计划路线"
                >
                  <polyline
                    points={pointsAttr(points)}
                    fill="none"
                    stroke="#141414"
                    strokeWidth="9"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={pointsAttr(points)}
                    fill="none"
                    stroke="#4096ff"
                    strokeWidth="3"
                    strokeDasharray="8 7"
                    strokeLinejoin="round"
                  />
                  {waypoints.map((p, i) => (
                    <g
                      key={i}
                      transform={`translate(${p.x},${p.y}) scale(${labelScale})`}
                    >
                      <circle
                        cx="0"
                        cy="0"
                        r="11"
                        fill="#162337"
                        stroke="#4096ff"
                        strokeWidth="1.5"
                      />
                      <text
                        x="0"
                        y="4"
                        fill="#91caff"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="600"
                      >
                        {i + 1}
                      </text>
                    </g>
                  ))}
                  <text
                    x={waypoints[0].x + 15}
                    y={waypoints[0].y - 15}
                    fill="#91caff"
                    fontSize={12 / screenScale}
                  >
                    起点
                  </text>
                </g>
              )}
              {activeMotion && (
                <polyline
                  data-testid="actual-trail"
                  points={pointsAttr(movement.trail)}
                  fill="none"
                  stroke="#73d13d"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {state.devices.map((d) => {
                const p =
                  d.id === "A" && activeMotion ? movement.position : d.position;
                const selected = state.focused === d.id,
                  eligible = state.filtered && d.id === "A";
                const color = !d.online ? "#8c8c8c" : "#73d13d";
                const screenX = size.width / 2 + (p.x - view.x) * screenScale;
                const above = d.id === "A" && hasRoute;
                const labelX = above
                  ? -55
                  : d.id === "C" || screenX > size.width - 165
                    ? -177
                    : 23;
                const labelY = above ? -74 : -23;
                return (
                  <g
                    key={d.id}
                    className="map-object"
                    role="button"
                    tabIndex={0}
                    data-testid={"map-device-" + d.id}
                    aria-label={"地图上的设备 " + d.id}
                    transform={`translate(${p.x},${p.y}) scale(${labelScale})`}
                    onClick={() => choose(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        choose(d.id);
                      }
                    }}
                  >
                    {(selected || eligible) && (
                      <circle
                        r={selected ? 29 : 24}
                        fill="#1668dc20"
                        stroke={selected ? "#4096ff" : "#4096ff55"}
                        strokeWidth="1.5"
                      />
                    )}
                    <circle
                      r="15"
                      fill="#1f1f1f"
                      stroke={color}
                      strokeWidth="2"
                    />
                    <foreignObject
                      x="-8"
                      y="-8"
                      width="16"
                      height="16"
                      className="device-map-icon"
                      style={{ color }}
                    >
                      <ObjectIcon id={d.id} />
                    </foreignObject>
                    <rect
                      x={labelX}
                      y={labelY}
                      width={d.online ? 130 : 154}
                      height="48"
                      rx="6"
                      fill="#141414ef"
                      stroke={selected ? "#4096ff" : "#454545"}
                    />
                    <text
                      x={labelX + 12}
                      y={labelY + 19}
                      fill="#ececec"
                      fontSize="14"
                      fontWeight="600"
                    >
                      设备 {d.id}
                    </text>
                    <text
                      x={labelX + 12}
                      y={labelY + 37}
                      fill={d.online && d.battery <= 50 ? "#ffc53d" : color}
                      fontSize="12"
                    >
                      {d.online
                        ? activeMotion && d.id === "A"
                          ? state.phase === "completed"
                            ? "已完成"
                            : state.phase === "paused"
                              ? "已暂停"
                              : state.phase === "stopped"
                                ? "已停止"
                                : "巡检中"
                          : d.battery + "% · 在线"
                        : "离线 · 位置非实时"}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="map-overlay-top">
              <Button
                className="location-control"
                size="small"
                icon={<EnvironmentOutlined />}
                title="定位北港作业区，恢复全览"
                onClick={resetView}
              >
                北港作业区
              </Button>
            </div>
            <div className="north">
              <span>N</span>
              <svg width="20" height="29" viewBox="0 0 20 29">
                <path d="M10 2L18 24L10 19L2 24Z" fill="#bfbfbf" />
                <path d="M10 2V19L2 24Z" fill="#5c5c5c" />
              </svg>
            </div>
            <div className="map-controls">
              <Tooltip title="放大">
                <Button
                  icon={<PlusOutlined />}
                  aria-label="放大地图"
                  onClick={() => changeZoom(0.2)}
                />
              </Tooltip>
              <Tooltip title="缩小">
                <Button
                  icon={<MinusOutlined />}
                  aria-label="缩小地图"
                  onClick={() => changeZoom(-0.2)}
                />
              </Tooltip>
              <Tooltip title="恢复全览">
                <Button
                  icon={<ExpandOutlined />}
                  aria-label="恢复地图全览"
                  onClick={() => {
                    setView({ x: 490, y: 420, zoom: 1.08 });
                    dispatch({ type: "FOCUS", id: null });
                  }}
                />
              </Tooltip>
              <Tooltip title="定位 A 区">
                <Button
                  icon={<AimOutlined />}
                  aria-label="定位 A 区"
                  onClick={() => dispatch({ type: "FOCUS", id: "zone-a" })}
                />
              </Tooltip>
            </div>
            <div className="map-bottom-info">
              <div className="legend">
                <span>
                  <i className="legend-line" />
                  计划路线
                </span>
                <span>
                  <i className="legend-line actual" />
                  已走轨迹
                </span>
              </div>
            </div>
          </div>
          {noticeVisible && (
            <CurrentTaskBar onClose={() => setDismissedNotice(noticeKey)} />
          )}
        </div>
      </div>
    </section>
  );
}
