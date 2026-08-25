import React, { useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { parseLeadsCsv } from "../lib/importCsv";
import PageHeader from "../components/PageHeader";

export default function ImportView({ leads, showToast, t }) {
  const { rows: sources, refetch } = useRealtimeList("import_sources", { orderBy: "label", ascending: true });
  const [newSource, setNewSource] = useState({ label: "", url: "", defaultCountry: "" });
  const [syncing, setSyncing] = useState(null);

  async function addSource(e) {
    e.preventDefault();
    if (!newSource.label.trim()) { showToast(t("יש להזין שם למקור")); return; }
    const { error } = await supabase.from("import_sources").insert({
      label: newSource.label.trim(), url: newSource.url.trim(), default_country: newSource.defaultCountry.trim(),
    });
    if (error) { showToast(t("שגיאה בהוספת מקור")); return; }
    setNewSource({ label: "", url: "", defaultCountry: "" });
    showToast(t("מקור הייבוא נוסף"));
  }

  async function updateSourceField(id, field, value) {
    await supabase.from("import_sources").update({ [field]: value }).eq("id", id);
  }
  async function removeSource(id) {
    await supabase.from("import_sources").delete().eq("id", id);
  }

  async function runImport(source) {
    if (!source.url) { showToast(t("יש להגדיר קישור לקובץ CSV")); return; }
    setSyncing(source.id);
    try {
      const res = await fetch(source.url);
      const text = await res.text();
      const rows = parseLeadsCsv(text, source.default_country);
      const existingPhones = new Set(leads.map((l) => (l.phone || "").replace(/\D/g, "")));
      const fresh = rows.filter((r) => r.phone && !existingPhones.has(r.phone.replace(/\D/g, "")));
      const duplicateCount = rows.length - fresh.length;
      if (fresh.length) {
        const { error } = await supabase.from("leads").insert(fresh.map((r) => ({ ...r, channel: source.label })));
        if (error) throw error;
      }
      await supabase.from("import_sources").update({ last_import_at: new Date().toISOString() }).eq("id", source.id);
      showToast(
        `${t("יובאו")} ${fresh.length} ${t("לידים חדשים מ")}${source.label}` +
        (duplicateCount > 0 ? ` · ${duplicateCount} ${t("דולגו (טלפון כבר קיים במערכת)")}` : "")
      );
    } catch (err) {
      showToast(t("הייבוא נכשל — בדוק את הקישור"));
    }
    setSyncing(null);
  }

  return (
    <div>
      <PageHeader icon={Upload} title={t("ייבוא לידים")} />
      <div style={{ fontSize: 12.5, color: colors.mutedText, marginBottom: 16 }}>
        {t("חבר קישור CSV ציבורי (למשל גיליון Google Sheets שפורסם) לכל מקור. הייבוא כאן הוא ידני — לחץ \"סנכרן עכשיו\" בכל פעם שרוצים למשוך לידים חדשים. קישור הגיליון אינו מוצפן — אל תשתף אותו מעבר לצוות.")}
      </div>

      <form onSubmit={addSource} style={{ ...panelStyle, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, width: 150 }} placeholder={t("שם המקור")} value={newSource.label} onChange={(e) => setNewSource({ ...newSource, label: e.target.value })} />
        <input style={{ ...inputStyle, width: 240 }} placeholder={t("קישור CSV")} value={newSource.url} onChange={(e) => setNewSource({ ...newSource, url: e.target.value })} />
        <input style={{ ...inputStyle, width: 120 }} placeholder={t("מדינת ברירת מחדל")} value={newSource.defaultCountry} onChange={(e) => setNewSource({ ...newSource, defaultCountry: e.target.value })} />
        <button type="submit" style={buttonPrimary}>{t("הוסף מקור")}</button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {sources.map((s) => (
          <div key={s.id} style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{s.label}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => runImport(s)} disabled={syncing === s.id} style={buttonPrimary}>{syncing === s.id ? t("מסנכרן…") : t("סנכרן עכשיו")}</button>
                <button onClick={() => removeSource(s.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>{t("מחק")}</button>
              </div>
            </div>
            <input style={{ ...inputStyle, marginBottom: 6 }} defaultValue={s.url || ""} placeholder={t("קישור CSV")} onBlur={(e) => updateSourceField(s.id, "url", e.target.value)} />
            <input style={inputStyle} defaultValue={s.default_country || ""} placeholder={t("מדינת ברירת מחדל")} onBlur={(e) => updateSourceField(s.id, "default_country", e.target.value)} />
            <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 6 }}>{t("סונכרן לאחרונה")}: {s.last_import_at ? fmtDate(s.last_import_at) : t("מעולם לא")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
