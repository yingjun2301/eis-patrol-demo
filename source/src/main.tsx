import React from "react";
import ReactDOM from "react-dom/client";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/zh-cn";
import { PatrolProvider } from "./state/PatrolProvider";
import App from "./App";
import { designTheme } from "./theme";
import "./tokens.css";
import "./styles.css";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("zh-cn");
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={designTheme}>
      <AntApp>
        <PatrolProvider>
          <App />
        </PatrolProvider>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
