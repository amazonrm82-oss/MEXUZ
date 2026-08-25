import React, { useState } from "react";
import { Check } from "lucide-react";
import { colors } from "../lib/theme";
import { useLanguage } from "../lib/LanguageContext";

// A small field that only writes to the DB when you explicitly click the save (✓) button that
// appears once you've changed the value — no silent auto-save on blur.
export default function InlineEdit({ value, onSave, type = "text", width = 70, step, style }) {
  const { t } = useLanguage();
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const dirty = String(val) !== String(value);

  async function save() {
    setSaving(true);
    await onSave(val);
    setSaving(false);
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <input
        type={type} step={step} value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && dirty && save()}
        style={{ width, border: `1px solid ${dirty ? colors.accent : colors.border}`, borderRadius: 5, padding: "2px 5px", ...style }}
      />
      {dirty && (
        <button
          onClick={save} disabled={saving} title={t("שמור")}
          style={{ border: "none", background: colors.accent, color: "#fff", borderRadius: 4, cursor: "pointer", padding: 2, display: "flex" }}
        >
          <Check size={12} />
        </button>
      )}
    </span>
  );
}
