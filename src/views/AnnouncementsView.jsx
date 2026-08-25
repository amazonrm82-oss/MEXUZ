import React, { useMemo, useState } from "react";
import { Megaphone, Pin, PinOff, Trash2, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { canActLikeManager } from "../lib/permissions";
import EmptyState from "../components/EmptyState";

// The app's post-login home screen. Everyone reads; only Eden/managers can post, pin, or delete.
export default function AnnouncementsView({ profile, profiles, t }) {
  const mgr = canActLikeManager(profile);
  const { rows: announcements } = useRealtimeList("announcements", { orderBy: "created_at", ascending: false });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  function authorName(id) { return profiles.find((p) => p.id === id)?.name || "—"; }

  const pinned = useMemo(() => announcements.filter((a) => a.pinned), [announcements]);
  const rest = useMemo(() => announcements.filter((a) => !a.pinned), [announcements]);

  async function post() {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      author_id: profile.id, title: title.trim(), body: body.trim() || null,
    });
    setSaving(false);
    if (!error) { setTitle(""); setBody(""); setOpen(false); }
  }

  async function togglePin(a) {
    await supabase.from("announcements").update({ pinned: !a.pinned }).eq("id", a.id);
  }
  async function remove(id) {
    await supabase.from("announcements").delete().eq("id", id);
  }

  const firstName = (profile.name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = t(hour < 5 ? "לילה טוב" : hour < 12 ? "בוקר טוב" : hour < 18 ? "צהריים טובים" : "ערב טוב");

  return (
    <div>
      <div style={{
        borderRadius: 18, padding: "34px 28px", marginBottom: 24, position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${colors.header} 0%, ${colors.accent} 100%)`, color: "#fff",
        boxShadow: "0 10px 30px rgba(198,113,57,.25)",
      }}>
        <Sparkles size={120} style={{ position: "absolute", insetInlineEnd: -20, top: -24, opacity: .15 }} />
        <div style={{ fontSize: 13, opacity: .85, fontWeight: 600 }}>{greeting}, {firstName} 👋</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
          <Megaphone size={26} /> {t("לוח המודעות של MEXUZ")}
        </div>
        <div style={{ fontSize: 13, opacity: .9, marginTop: 6 }}>{t("כל מה שחשוב שכולם ידעו, במקום אחד.")}</div>
      </div>

      {mgr && (
        <div style={{ ...panelStyle, marginBottom: 20 }}>
          {!open ? (
            <button onClick={() => setOpen(true)} style={{ ...buttonPrimary, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Megaphone size={15} /> {t("מודעה חדשה")}
            </button>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <input style={inputStyle} placeholder={t("כותרת")} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              <textarea style={{ ...inputStyle, minHeight: 80 }} placeholder={t("תוכן ההודעה (אופציונלי)")} value={body} onChange={(e) => setBody(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={post} disabled={saving || !title.trim()} style={buttonPrimary}>{saving ? t("מפרסם…") : t("פרסם")}</button>
                <button onClick={() => { setOpen(false); setTitle(""); setBody(""); }} style={buttonGhost}>{t("ביטול")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} text={t("אין עדיין מודעות")} />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {pinned.map((a) => (
            <AnnouncementCard key={a.id} a={a} authorName={authorName} mgr={mgr} onTogglePin={togglePin} onRemove={remove} featured t={t} />
          ))}
          {rest.map((a) => (
            <AnnouncementCard key={a.id} a={a} authorName={authorName} mgr={mgr} onTogglePin={togglePin} onRemove={remove} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ a, authorName, mgr, onTogglePin, onRemove, featured, t }) {
  return (
    <div style={{
      ...panelStyle, borderInlineStart: `4px solid ${featured ? "#c9a227" : colors.accent}`,
      background: featured ? "linear-gradient(135deg, #fffdf5, #ffffff)" : "#fff",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", background: `${colors.accent}22`, color: colors.accent,
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0,
          }}>
            {(authorName(a.author_id) || "?").slice(0, 1)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, display: "flex", alignItems: "center", gap: 6 }}>
              {featured && <Pin size={13} color="#c9a227" />}
              {a.title}
            </div>
            <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{authorName(a.author_id)} · {fmtDate(a.created_at)}</div>
          </div>
        </div>
        {mgr && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={() => onTogglePin(a)} title={a.pinned ? t("בטל נעיצה") : t("נעץ למעלה")} style={{ border: "none", background: "none", cursor: "pointer", color: a.pinned ? "#c9a227" : colors.muted }}>
              {a.pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
            <button onClick={() => onRemove(a.id)} title={t("מחק")} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted }}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
      {a.body && <div style={{ fontSize: 13.5, color: colors.text, marginTop: 10, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.body}</div>}
    </div>
  );
}
