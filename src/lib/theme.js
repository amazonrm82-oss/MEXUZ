export const colors = {
  bg: "#eef1f8",
  header: "#3548c7",
  accent: "#0ea5a5",
  danger: "#dc2626",
  text: "#1e2433",
  muted: "#6b7280",
  mutedText: "#4b5566",
  border: "#d7dcec",
  card: "#ffffff",
};

export const panelStyle = {
  background: colors.card,
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 1px 2px rgba(30,36,51,.04), 0 4px 14px rgba(30,36,51,.06)",
};

export const inputStyle = {
  width: "100%",
  padding: 9,
  borderRadius: 9,
  border: `1px solid ${colors.border}`,
  boxSizing: "border-box",
  fontSize: 14,
  background: "#fff",
};

export const buttonPrimary = {
  padding: "8px 16px",
  borderRadius: 9,
  border: "none",
  background: colors.accent,
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(14,165,165,.3)",
};

export const buttonDanger = {
  ...buttonPrimary,
  background: colors.danger,
  boxShadow: "0 2px 6px rgba(220,38,38,.3)",
};

export const buttonGhost = {
  padding: "8px 16px",
  borderRadius: 9,
  border: `1px solid ${colors.border}`,
  background: "#fff",
  color: colors.text,
  cursor: "pointer",
};
