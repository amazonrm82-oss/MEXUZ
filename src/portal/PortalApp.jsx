import React, { useEffect, useState, useCallback } from "react";
import { LogOut, CheckCircle2, LifeBuoy, CreditCard, Layers } from "lucide-react";
import { portalSupabase } from "../lib/portalSupabaseClient";
import { colors, inputStyle, buttonPrimary, buttonGhost, panelStyle } from "../lib/theme";
import { money } from "../lib/format";

const PRIORITY_LABELS = { low: "נמוכה", medium: "בינונית", high: "גבוהה", urgent: "דחוף" };
const PRIORITY_COLORS = { low: "#6b7280", medium: "#3548c7", high: "#d97706", urgent: "#dc2626" };
const STATUS_LABELS = { open: "פתוח", in_progress: "בטיפול", closed: "נסגר" };
const STATUS_COLORS = { active: "#0ea5a5", maintenance: "#d97706", inactive: "#6b7280" };
const SYSTEM_STATUS_LABELS = { active: "פעילה", maintenance: "בתחזוקה", inactive: "לא פעילה" };

// Customer-facing self-service portal — a completely separate surface from the internal CRM
// (own Supabase auth session via portalSupabaseClient.js, no shared session, no i18n system,
// Hebrew-only). A customer signs in with the email on file for their lead; RLS (migration
// 0015_customer_portal.sql) does the actual scoping to their own system(s), invoices, and
// tickets — this component just renders whatever comes back.
export default function PortalApp() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalSupabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = portalSupabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, fontFamily: "sans-serif", color: colors.text, direction: "rtl" }}>
      {loading ? (
        <CenterBox><div>טוען…</div></CenterBox>
      ) : !session ? (
        <PortalLogin />
      ) : (
        <PortalDashboard session={session} />
      )}
    </div>
  );
}

function CenterBox({ children }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>{children}</div>;
}

function PortalLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendLink() {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    const { error } = await portalSupabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/portal" },
    });
    setBusy(false);
    if (error) { setError("שגיאה בשליחת קישור ההתחברות. נסו שוב."); return; }
    setSent(true);
  }

  return (
    <CenterBox>
      <div style={{ ...panelStyle, width: 380, maxWidth: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>פורטל לקוחות MEXUZ</div>
        <div style={{ fontSize: 13, color: colors.mutedText, marginBottom: 18 }}>מעקב אחרי המערכת, החשבוניות והפניות שלכם</div>

        {sent ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: colors.accent }}>
            <CheckCircle2 size={28} />
            <div style={{ fontSize: 14, color: colors.text }}>
              נשלח קישור התחברות לכתובת <b>{email}</b>. לחצו עליו כדי להיכנס.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, textAlign: "start" }}>
            <input
              type="email" placeholder="כתובת המייל שלכם" value={email}
              onChange={(e) => setEmail(e.target.value)} style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
            />
            <button onClick={sendLink} disabled={busy} style={buttonPrimary}>{busy ? "שולח…" : "שלח קישור התחברות"}</button>
            {error && <div style={{ color: colors.danger, fontSize: 12.5 }}>{error}</div>}
          </div>
        )}
      </div>
    </CenterBox>
  );
}

function PortalDashboard({ session }) {
  const [systems, setSystems] = useState([]);
  const [charges, setCharges] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSystemId, setActiveSystemId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: sysRows } = await portalSupabase.from("company_systems").select("*").order("created_at", { ascending: true });
    const list = sysRows || [];
    setSystems(list);
    setActiveSystemId((prev) => prev || list[0]?.id || null);
    if (list.length) {
      const ids = list.map((s) => s.id);
      const [{ data: chargeRows }, { data: ticketRows }] = await Promise.all([
        portalSupabase.from("system_charges").select("*").in("system_id", ids).order("due_date", { ascending: false }),
        portalSupabase.from("support_tickets").select("*").in("system_id", ids).order("created_at", { ascending: false }),
      ]);
      setCharges(chargeRows || []);
      setTickets(ticketRows || []);
    } else {
      setCharges([]); setTickets([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function logout() {
    await portalSupabase.auth.signOut();
  }

  if (loading) return <CenterBox><div>טוען…</div></CenterBox>;

  if (systems.length === 0) {
    return (
      <CenterBox>
        <div style={{ ...panelStyle, width: 420, maxWidth: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>לא נמצאה מערכת פעילה עבור החשבון הזה</div>
          <div style={{ fontSize: 13, color: colors.mutedText, marginBottom: 14 }}>
            אם אתם בטוחים שאתם אמורים לראות משהו כאן, צרו קשר עם הצוות שלנו.
          </div>
          <button onClick={logout} style={buttonGhost}>יציאה</button>
        </div>
      </CenterBox>
    );
  }

  const activeSystem = systems.find((s) => s.id === activeSystemId) || systems[0];
  const systemCharges = charges.filter((c) => c.system_id === activeSystem.id).sort((a, b) => (a.due_date < b.due_date ? 1 : -1));
  const systemTickets = tickets.filter((tk) => tk.system_id === activeSystem.id);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 19, fontWeight: 800 }}>פורטל לקוחות MEXUZ</div>
        <button onClick={logout} style={{ ...buttonGhost, display: "flex", alignItems: "center", gap: 6 }}><LogOut size={15} /> יציאה</button>
      </div>

      {systems.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {systems.map((s) => (
            <button
              key={s.id} onClick={() => setActiveSystemId(s.id)}
              style={s.id === activeSystem.id ? buttonPrimary : buttonGhost}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <Section icon={Layers} title="המערכת שלכם">
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{activeSystem.name}</div>
        {activeSystem.description && <div style={{ fontSize: 13.5, color: colors.mutedText, marginBottom: 8 }}>{activeSystem.description}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
          <span style={{
            background: `${STATUS_COLORS[activeSystem.status] || colors.muted}22`, color: STATUS_COLORS[activeSystem.status] || colors.muted,
            borderRadius: 8, padding: "3px 10px", fontWeight: 700,
          }}>
            {SYSTEM_STATUS_LABELS[activeSystem.status] || activeSystem.status}
          </span>
          {activeSystem.url && (
            <a href={activeSystem.url} target="_blank" rel="noreferrer" style={{ color: colors.accent }}>{activeSystem.url}</a>
          )}
        </div>
      </Section>

      <Section icon={CreditCard} title="חיובים ותשלומים">
        {systemCharges.length === 0 ? (
          <Empty text="אין עדיין חיובים רשומים" />
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {systemCharges.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, padding: "8px 10px", borderRadius: 8, background: colors.bg }}>
                <span>{c.due_date}</span>
                <span style={{ fontWeight: 700 }}>{money(c.amount)}</span>
                <span style={{ color: c.paid ? colors.accent : colors.danger, fontWeight: 700, fontSize: 12 }}>
                  {c.paid ? "שולם" : "ממתין לתשלום"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={LifeBuoy} title="פניות תמיכה">
        <NewTicketForm systemId={activeSystem.id} contact={session.user.email} onCreated={load} />
        {systemTickets.length === 0 ? (
          <Empty text="אין פניות תמיכה עדיין" />
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {systemTickets.map((tk) => (
              <div key={tk.id} style={{ ...panelStyle, padding: "10px 12px", borderInlineStart: `4px solid ${PRIORITY_COLORS[tk.priority] || colors.muted}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{tk.title}</div>
                  <span style={{ fontSize: 11, color: colors.mutedText, flexShrink: 0 }}>{STATUS_LABELS[tk.status] || tk.status}</span>
                </div>
                {tk.description && <div style={{ fontSize: 12.5, color: colors.mutedText, marginTop: 4 }}>{tk.description}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function NewTicketForm({ systemId, contact, onCreated }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    const { error } = await portalSupabase.from("support_tickets").insert({
      system_id: systemId, title: title.trim(), description: description.trim() || null,
      priority, reporter_contact: contact,
    });
    setBusy(false);
    if (!error) {
      setTitle(""); setDescription(""); setPriority("medium"); setOpen(false);
      onCreated();
    }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} style={{ ...buttonGhost, marginBottom: 12 }}>+ פנייה חדשה</button>;
  }

  return (
    <div style={{ ...panelStyle, display: "grid", gap: 8, marginBottom: 12 }}>
      <input style={inputStyle} placeholder="נושא הפנייה" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <textarea style={{ ...inputStyle, minHeight: 70 }} placeholder="פרטים (אופציונלי)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <select style={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="low">{PRIORITY_LABELS.low}</option>
        <option value="medium">{PRIORITY_LABELS.medium}</option>
        <option value="high">{PRIORITY_LABELS.high}</option>
        <option value="urgent">{PRIORITY_LABELS.urgent}</option>
      </select>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => setOpen(false)} style={buttonGhost}>ביטול</button>
        <button onClick={submit} disabled={busy} style={buttonPrimary}>{busy ? "שולח…" : "שליחה"}</button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon size={17} color={colors.accent} />
        <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ fontSize: 13, color: colors.muted }}>{text}</div>;
}
