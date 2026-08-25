import React from "react";
import { panelStyle } from "../lib/theme";

export default function CustomTabView({ tab }) {
  if (!tab) return null;
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{tab.title || tab.label}</div>
      <div style={{ ...panelStyle, whiteSpace: "pre-wrap" }}>{tab.content}</div>
    </div>
  );
}
