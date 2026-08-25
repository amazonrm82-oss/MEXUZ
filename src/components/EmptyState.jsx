import React from "react";
import { colors } from "../lib/theme";

export default function EmptyState({ icon, text }) {
  const Icon = icon;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "40px 20px", color: colors.muted, textAlign: "center",
    }}>
      {Icon && <Icon size={30} style={{ marginBottom: 8, opacity: .5 }} />}
      <div style={{ fontSize: 13.5 }}>{text}</div>
    </div>
  );
}
