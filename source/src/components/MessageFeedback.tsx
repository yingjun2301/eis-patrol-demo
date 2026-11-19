import { useState } from "react";
import { App, Button, Dropdown, Tooltip } from "antd";
import {
  CopyOutlined,
  DislikeOutlined,
  EllipsisOutlined,
  LikeOutlined,
} from "@ant-design/icons";
import "./message-feedback.css";

const completionTime = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Mounted only after this reply has finished producing content. */
export default function MessageFeedback({
  text,
  at,
}: {
  text: string;
  at: number;
}) {
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const { message } = App.useApp();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      message.success("已复制");
    } catch {
      message.error("复制失败，请选中文字复制");
    }
  }

  return (
    <div className="message-feedback" role="group" aria-label="回复反馈">
      <Tooltip title="复制">
        <Button
          type="text"
          size="small"
          aria-label="复制回复"
          icon={<CopyOutlined />}
          onClick={copy}
        />
      </Tooltip>
      <Tooltip title="有帮助">
        <Button
          type="text"
          size="small"
          aria-label="点赞"
          aria-pressed={vote === "like"}
          className={vote === "like" ? "feedback-selected" : undefined}
          icon={<LikeOutlined />}
          onClick={() => setVote(vote === "like" ? null : "like")}
        />
      </Tooltip>
      <Tooltip title="没有帮助">
        <Button
          type="text"
          size="small"
          aria-label="点踩"
          aria-pressed={vote === "dislike"}
          className={vote === "dislike" ? "feedback-selected" : undefined}
          icon={<DislikeOutlined />}
          onClick={() => setVote(vote === "dislike" ? null : "dislike")}
        />
      </Tooltip>
      <Dropdown
        trigger={["click"]}
        arrow={false}
        menu={{ items: [{ key: "copy", label: "复制文本", onClick: copy }] }}
      >
        <Button
          type="text"
          size="small"
          aria-label="更多回复操作"
          icon={<EllipsisOutlined />}
        />
      </Dropdown>
      <time dateTime={new Date(at).toISOString()} title="回复完成时间">
        {completionTime.format(at)}
      </time>
    </div>
  );
}
