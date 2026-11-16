import { theme, type ThemeConfig } from "antd";

/** Neutral dark surfaces; Ant Design owns all form/overlay interaction. */
export const designTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#1677ff",
    colorSuccess: "#52c41a",
    colorWarning: "#faad14",
    colorError: "#ff4d4f",
    colorBgLayout: "#141414",
    colorBgContainer: "#181818",
    colorBgElevated: "#242424",
    colorText: "#f1f1f1",
    colorTextSecondary: "#b4b4b4",
    colorTextTertiary: "#8c8c8c",
    colorBorder: "#414141",
    colorBorderSecondary: "#303030",
    borderRadius: 8,
    borderRadiusLG: 16,
    fontSize: 14,
    fontSizeSM: 12,
    controlHeight: 36,
    boxShadow: "var(--shadow-overlay)",
    boxShadowSecondary: "var(--shadow-overlay)",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Modal: { contentBg: "#242424", headerBg: "#242424" },
    Popover: { colorBgElevated: "#242424" },
    Input: { activeShadow: "0 0 0 2px #4096ff33" },
  },
};
