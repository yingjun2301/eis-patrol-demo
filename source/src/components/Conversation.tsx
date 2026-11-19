import { useEffect, useRef, useState } from "react";
import { Button, Dropdown, Input, Select, Tag, Tooltip } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import {
  ArrowUpOutlined,
  ArrowRightOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { usePatrol } from "../state/PatrolContext";
import {
  labelOf,
  phaseLabels,
  startLabel,
  type Message,
  type ObjectId,
} from "../domain/model";
import { ObjectIcon, ObjectLink } from "./Objects";
import TaskCard, { PlanReceipt } from "./TaskCard";
import MessageFeedback from "./MessageFeedback";
export default function Conversation({
  hidden,
  onCollapse,
}: {
  hidden: boolean;
  onCollapse: () => void;
}) {
  const { state, dispatch } = usePatrol();
  const [input, setInput] = useState("");
  const [region, setRegion] = useState<string>();
  const [preset, setPreset] = useState<string>();
  const historyRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<TextAreaRef>(null);
  const followTail = useRef(true);
  useEffect(() => {
    const history = historyRef.current;
    if (!history || hidden) return;
    const scroll = () => {
      if (followTail.current)
        history.scrollTo({ top: history.scrollHeight, behavior: "instant" });
    };
    const observer = new ResizeObserver(scroll);
    observer.observe(history);
    if (messagesRef.current) observer.observe(messagesRef.current);
    const frame = requestAnimationFrame(scroll);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [hidden, state.messages]);
  useEffect(() => {
    setInput("");
    setRegion(undefined);
    setPreset(undefined);
    followTail.current = true;
  }, [state.session]);
  const advance = () => {
    followTail.current = true;
  };
  function send() {
    if (!input.trim()) return;
    advance();
    dispatch({ type: "SEND", text: input });
    setInput("");
  }
  function modifyPlan() {
    advance();
    dispatch({ type: "REQUEST_PLAN_CHANGE" });
    requestAnimationFrame(() =>
      inputRef.current?.focus({ preventScroll: true }),
    );
  }
  function feedbackReady(m: Message) {
    if (m.role !== "agent") return false;
    if (!m.taskId && m.taskUpdates === undefined) return true;
    return (
      m.taskUpdates?.at(-1)?.kind === "result" &&
      (m.id !== state.activeTaskMessageId ||
        ["completed", "stopped"].includes(state.phase))
    );
  }
  function replyText(m: Message) {
    const active = m.id === state.activeTaskMessageId;
    const plan = active ? state.plan : m.planReceipt;
    const summary = plan
      ? [
          "A 区巡检",
          `执行设备：${labelOf(plan.deviceId)}`,
          `巡检区域：${labelOf(plan.regionId)}`,
          `开始时间：${startLabel(plan.start)}`,
          `巡检顺序：${plan.order === "forward" ? "顺向巡检" : "逆向巡检"}`,
          ...(active
            ? [
                phaseLabels[state.phase],
                ...(["completed", "stopped"].includes(state.phase)
                  ? [`进度：${Math.round(state.progress)}%`]
                  : []),
              ]
            : []),
        ].join("\n")
      : "";
    return [
      m.text,
      m.kind !== "filter" && m.taskUpdates === undefined
        ? m.refs?.map(labelOf).join(" · ")
        : "",
      summary,
      ...(m.taskUpdates?.map((update) => update.text) ?? []),
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  const contextMenuItem = (id: ObjectId) => ({
    key: id,
    icon: <ObjectIcon id={id} />,
    label: (
      <span className="context-menu-label">
        {labelOf(id)}
        {state.context.includes(id) && <span>已引用</span>}
      </span>
    ),
    disabled: state.context.includes(id),
    onClick: () => dispatch({ type: "ADD_CONTEXT", id }),
  });
  return (
    <aside
      className="conversation-panel"
      aria-label="AI 调度助手"
      hidden={hidden}
    >
      <div className="module-heading conversation-heading">
        <h2>AI 调度助手</h2>
        <Tooltip title="收起助手">
          <Button
            type="text"
            size="small"
            aria-label="收起助手"
            icon={<MenuUnfoldOutlined />}
            onClick={onCollapse}
          />
        </Tooltip>
      </div>
      <div
        className={
          "conversation-history" +
          (!state.messages.length ? " conversation-history-empty" : "")
        }
        ref={historyRef}
        aria-label="对话记录"
        onScroll={() => {
          const h = historyRef.current;
          if (h)
            followTail.current =
              h.scrollHeight - h.scrollTop - h.clientHeight < 48;
        }}
      >
        {!state.messages.length ? (
          <div className="chat-welcome">
            <h2>你好，有什么可以帮你？</h2>
            <button
              className="starter-prompt"
              onClick={() => {
                advance();
                dispatch({ type: "START_PLANNING" });
              }}
            >
              <span>
                <ObjectIcon id="A" />
                创建巡检任务
              </span>
              <p>选择巡检区域，检查可用设备，再安排执行。</p>
              <span className="starter-action">
                开始安排 <ArrowRightOutlined />
              </span>
            </button>
          </div>
        ) : (
          <div className="conversation-messages" ref={messagesRef}>
            {state.messages.map((m) => (
              <article
                key={m.id}
                tabIndex={-1}
                data-message-id={m.id}
                data-task-id={m.taskId}
                aria-label={m.taskId ? "巡检任务回复" : undefined}
                className={"message message-" + m.role}
              >
                {m.role === "agent" && (
                  <div className="message-label">
                    用时 {((m.simulatedDurationMs ?? 1200) / 1000).toFixed(1)}{" "}
                    秒<span className="duration-note">（模拟）</span>
                  </div>
                )}
                <div
                  className={
                    "message-text" +
                    (m.kind === "filter" ? " filter-summary" : "")
                  }
                >
                  {m.text}
                </div>
                {m.kind === "setup" &&
                  (!state.plan ? (
                    <div className="setup-region">
                      <label htmlFor="patrol-region">巡检区域</label>
                      <Select
                        id="patrol-region"
                        aria-label="巡检区域"
                        value={region}
                        placeholder="选择区域"
                        onChange={setRegion}
                        options={[
                          { value: "zone-a", label: "A 区 · 集装箱作业区" },
                        ]}
                      />
                      <label htmlFor="patrol-preset" className="preset-label">
                        设备筛选条件 <span>可选</span>
                      </label>
                      <Select
                        id="patrol-preset"
                        aria-label="设备筛选条件"
                        allowClear
                        value={preset}
                        placeholder="不使用预设条件"
                        onChange={setPreset}
                        options={[
                          {
                            value: "online-over-50",
                            label: "在线且电量 > 50%",
                          },
                        ]}
                      />
                      <Button
                        type="primary"
                        disabled={!region}
                        onClick={() => {
                          advance();
                          if (preset) {
                            dispatch({
                              type: "FILTER",
                              criteriaConfirmed: true,
                            });
                          } else {
                            dispatch({ type: "INSPECT_DEVICES" });
                            setInput((current) =>
                              current.trim() ? current : "在线且电量超过 50%",
                            );
                          }
                        }}
                      >
                        {preset ? "检查可用设备" : "查看设备状态"}
                      </Button>
                    </div>
                  ) : (
                    <div className="message-objects">
                      <ObjectLink id="zone-a" />
                    </div>
                  ))}
                {m.kind !== "filter" &&
                  m.taskUpdates === undefined &&
                  !!m.refs?.length && (
                    <div className="message-objects">
                      {m.refs.map((id) => (
                        <ObjectLink key={id} id={id} />
                      ))}
                    </div>
                  )}
                {m.id === state.activeTaskMessageId ? (
                  <TaskCard onAdvance={advance} onModify={modifyPlan} />
                ) : m.planReceipt ? (
                  <PlanReceipt plan={m.planReceipt} />
                ) : null}
                {m.taskUpdates !== undefined && (
                  <div
                    className="task-updates"
                    role="log"
                    aria-label="本次巡检进展"
                    aria-live="polite"
                    aria-relevant="additions"
                    aria-atomic="false"
                  >
                    {m.taskUpdates.map((update) => (
                      <p
                        key={update.id}
                        className={"task-update task-update-" + update.kind}
                        data-update-id={update.id}
                        data-update-kind={update.kind}
                      >
                        {update.text}
                      </p>
                    ))}
                  </div>
                )}
                {feedbackReady(m) && (
                  <MessageFeedback
                    key={`${state.session}-${m.id}`}
                    text={replyText(m)}
                    at={m.taskUpdates?.at(-1)?.at ?? m.at}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="composer">
        {!!state.context.length && (
          <div className="context-chips" aria-label="已选对话上下文">
            <span className="tiny muted">已引用</span>
            {state.context.map((id) => (
              <Tag
                key={id}
                closable
                onClose={(e) => {
                  e.preventDefault();
                  dispatch({ type: "REMOVE_CONTEXT", id });
                }}
              >
                <ObjectLink id={id} />
              </Tag>
            ))}
          </div>
        )}
        <div className="input-shell">
          <Input.TextArea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              state.context.length
                ? "关于已选对象，你想了解什么？"
                : "输入指令，或从地图引用对象…"
            }
            aria-label="对话输入"
            autoSize={{ minRows: 2, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="input-toolbar">
            <Dropdown
              placement="topLeft"
              arrow={false}
              trigger={["click"]}
              autoFocus
              classNames={{ root: "context-object-menu" }}
              menu={{
                selectable: false,
                items: [
                  {
                    type: "group",
                    key: "devices",
                    label: "设备",
                    children: state.devices.map(({ id }) =>
                      contextMenuItem(id),
                    ),
                  },
                  {
                    type: "group",
                    key: "zones",
                    label: "巡检区域",
                    children: [contextMenuItem("zone-a")],
                  },
                ],
              }}
            >
              <Button
                className="context-trigger"
                type="text"
                size="small"
                icon={<PlusOutlined />}
                aria-label="引用对象"
              >
                引用对象
              </Button>
            </Dropdown>
            <Button
              type="primary"
              shape="circle"
              icon={<ArrowUpOutlined />}
              disabled={!input.trim()}
              aria-label="发送消息"
              onClick={send}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
