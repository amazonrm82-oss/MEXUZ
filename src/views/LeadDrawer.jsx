import React, { useState, useMemo } from "react";
import { X, MessageCircle, CalendarPlus, Paperclip, FileText, Trash2, Flame } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { colors, inputStyle, buttonPrimary, buttonGhost, buttonDanger } from "../lib/theme";
import { fmtDate, waPhoneFor, money } from "../lib/format";
import { LEAD_STATUS_BASE, PROCESS_STATUS_OPTIONS, OPS_STATUS_OPTIONS, REMIND_BEFORE_OPTIONS } from "../lib/constants";
import { canActLikeManager, canResetSystem } from "../lib/permissions";
import { useRealtimeList } from "../lib/useTable";
import DealItemCalculator from "../components/DealItemCalculator";
import AppointmentPickerModal from "../components/AppointmentPickerModal";

export default function LeadDrawer({ lead, profile, profiles, catalog, actions, showToast, onClose, readOnly, t, tStatus }) {
  const mgr = canActLikeManager(profile);
  const canDelete = canResetSystem(profile);
  const { rows: notes } = useRealtimeList("lead_notes", { filterColumn: "lead_id", filterValue: lead.id, orderBy: "created_at", ascending: true });
  const { rows: orderLines } = useRealtimeList("order_lines", { filterColumn: "lead_id", filterValue: lead.id, orderBy: "created_at", ascending: true });
  const { rows: messages } = useRealtimeList("lead_messages", { filterColumn: "lead_id", filterValue: lead.id, orderBy: "created_at", ascending: true });
  const { rows: files } = useRealtimeList("lead_files", { filterColumn: "lead_id", filterValue: lead.id, orderBy: "created_at", ascending: false });
  const { rows: templates } = useRealtimeList("message_templates", { orderBy: "sort_order", ascending: true });
  const { rows: activityLog } = useRealtimeList("lead_activity_log", { filterColumn: "lead_id", filterValue: lead.id, orderBy: "created_at", ascending: false });
  const { rows: linkedSystems } = useRealtimeList("company_systems", { filterColumn: "source_lead_id", filterValue: lead.id });
  const linkedSystem = linkedSystems[0] || null;

  const [noteText, setNoteText] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [msgText, setMsgText] = useState("");
  const [dealItems, setDealItems] = useState([]);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [showApptPicker, setShowApptPicker] = useState(false);

  const isClosed = !!lead.closed_at;
  const revenue = useMemo(() => orderLines.reduce((s, o) => s + Number(o.amount || 0), 0), [orderLines]);
  const hasPriceMismatch = useMemo(() => orderLines.some((o) => o.given_amount != null && Number(o.given_amount) !== Number(o.amount)), [orderLines]);

  function repName(id) { return profiles.find((p) => p.id === id)?.name || "—"; }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    await actions.addNote(lead.id, noteText, followUp || null);
    setNoteText(""); setFollowUp("");
  }

  async function handleAddMessage() {
    if (!msgText.trim()) return;
    await actions.addMessage(lead.id, msgText);
    setMsgText("");
  }

  async function handleCloseDeal() {
    await actions.closeLeadWithItems(lead, profile.id, profile.name, dealItems);
    setDealItems([]);
    setShowCloseForm(false);
  }

  async function handleDeleteLead() {
    if (!window.confirm(`${t("למחוק את הליד")} "${lead.name}"? ${t("הפעולה בלתי הפיכה.")}`)) return;
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) { showToast(t("שגיאה במחיקת הליד")); return; }
    showToast(t("הליד נמחק"));
    onClose();
  }

  async function convertToSystem() {
    const { error } = await supabase.from("company_systems").insert({
      name: lead.product || lead.name,
      client_name: lead.business_name || lead.name,
      description: `${t("נוצר מהעסקה של")} ${lead.name}`,
      status: "active",
      source_lead_id: lead.id,
    });
    if (error) { showToast(t("שגיאה ביצירת המערכת")); return; }
    showToast(t('המערכת נוספה ל"המערכות שלנו" — יש להשלים דמי תחזוקה ותאריך חידוש'));
  }

  const waLink = `https://wa.me/${waPhoneFor(lead.phone)}`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 900, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div style={{ width: 480, maxWidth: "100%", background: "#fff", height: "100vh", overflowY: "auto", padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            {lead.is_hot && (
              <span title={t("ליד חם — מערכת CRM/ERP מעל 50 משתמשים")} style={{ display: "flex", marginTop: 2 }}>
                <Flame size={19} color="#e6641f" fill="#e6641f" />
              </span>
            )}
            <div>
              <div style={{ fontSize: 19, fontWeight: 800 }}>{lead.name}</div>
              <div style={{ fontSize: 13, color: colors.muted }}>{lead.business_name} {lead.contact_role ? `· ${lead.contact_role}` : ""}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <a href={waLink} target="_blank" rel="noreferrer" style={{ ...buttonPrimary, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 8 }}>
          <MessageCircle size={16} /> {t("וואטסאפ")} · {lead.phone}
        </a>

        {templates.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {templates.map((tpl) => (
              <a
                key={tpl.id}
                href={`https://wa.me/${waPhoneFor(lead.phone)}?text=${encodeURIComponent(tpl.body.replaceAll("{שם}", lead.name || ""))}`}
                target="_blank" rel="noreferrer"
                style={{ ...buttonGhost, fontSize: 11.5, padding: "4px 9px", textDecoration: "none" }}
              >
                {tpl.title}
              </a>
            ))}
          </div>
        )}

        <Section title={t("פרטי ליד")}>
          {lead.email && <Row label={t("אימייל")} value={lead.email} />}
          <Row label={t("מוצר")} value={`${lead.product || "—"} · ${lead.quantity || 0} ${t("יח'")}`} />
          <Row label={t("ערוץ")} value={`${tStatus(lead.channel) || "—"}${lead.ad_name ? " · " + lead.ad_name : ""}`} />
          <Row label={t("כתובת")} value={lead.address || "—"} />
          <Row label={t("עיר")} value={lead.city || "—"} />
          <Row label={t("מדינה")} value={lead.country || "—"} />
          <Row label={t("התקבל")} value={fmtDate(lead.received_at)} />
        </Section>

        <Section title={t("אנשי קשר")}>
          <ContactsList leadId={lead.id} readOnly={readOnly} showToast={showToast} t={t} />
        </Section>

        {!readOnly && (
          <Section title={t("שיוך")}>
            {!lead.claimed_by ? (
              <button onClick={() => actions.claimLead(lead.id)} style={buttonPrimary}>{t("שייך אליי")}</button>
            ) : (
              <div style={{ fontSize: 13.5 }}>
                {t("שויך ל")}<b>{repName(lead.claimed_by)}</b>
                {mgr && (
                  <select style={{ ...inputStyle, marginTop: 6 }} value={lead.claimed_by} onChange={(e) => actions.reassignLead(lead.id, e.target.value, repName(e.target.value))}>
                    {profiles.filter((p) => !p.is_super_admin).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => actions.releaseLead(lead.id)} style={buttonGhost}>{t("שחרור ליד")}</button>
                </div>
              </div>
            )}
          </Section>
        )}

        {!readOnly && !isClosed && (
          <Section title={t("סטטוס")}>
            <select style={{ ...inputStyle, marginBottom: 6 }} value={lead.lead_status} onChange={(e) => actions.updateLead(lead.id, { lead_status: e.target.value })}>
              {LEAD_STATUS_BASE.map((s) => <option key={s} value={s}>{tStatus(s)}</option>)}
            </select>
            <select style={inputStyle} value={lead.process_status} onChange={(e) => actions.updateLead(lead.id, { process_status: e.target.value })}>
              {PROCESS_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{tStatus(s)}</option>)}
            </select>
          </Section>
        )}

        <Section title={t("הערות")}>
          {notes.map((n) => (
            <div key={n.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
              <div>{n.text}</div>
              <div style={{ color: colors.muted, fontSize: 11 }}>{fmtDate(n.created_at)}{n.follow_up ? ` · ${t("מעקב")}: ${n.follow_up}` : ""}</div>
            </div>
          ))}
          {!readOnly && (
            <div style={{ marginTop: 8 }}>
              <textarea style={{ ...inputStyle, minHeight: 60, marginBottom: 6 }} placeholder={t("הערה חדשה…")} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <input type="date" style={{ ...inputStyle, marginBottom: 6 }} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
              <button onClick={handleAddNote} style={buttonGhost}>{t("הוסף הערה")}</button>
            </div>
          )}
        </Section>

        {!isClosed && !readOnly && !lead.canceled && (
          <Section title={t("סגירת עסקה")}>
            {!showCloseForm ? (
              <button onClick={() => setShowCloseForm(true)} style={buttonPrimary}>{t("סגירת עסקה")}</button>
            ) : (
              <DealItemCalculator catalog={catalog} items={dealItems} setItems={setDealItems} onSubmit={handleCloseDeal} submitLabel={t("שלח לאישור ההנהלה")} t={t} />
            )}
          </Section>
        )}

        {isClosed && (
          <Section title={t("פרטי עסקה")}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>{tStatus(lead.lead_status)}</div>
            {orderLines.map((o) => {
              const mismatch = o.given_amount != null && Number(o.given_amount) !== Number(o.amount);
              return (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 13, padding: "4px 0" }}>
                  <span>{o.product} · {o.qty} {t("יח'")}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {mismatch ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
                        <span style={{ fontSize: 11, color: colors.muted }}>{t("מחיר מערכת")}: {money(o.amount)}</span>
                        <span style={{ fontWeight: 700, color: colors.header }}>{t("מחיר שניתן ללקוח")}: {money(o.given_amount)}</span>
                      </div>
                    ) : (
                      money(o.amount)
                    )}
                    {mgr && !readOnly && <button onClick={() => actions.removeOrderLine(o.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>{t("הסר")}</button>}
                  </span>
                </div>
              );
            })}
            <div style={{ fontWeight: 800, marginTop: 6 }}>{t('סה"כ')}: {money(revenue)}</div>
            {lead.pending_approval && <div style={{ color: colors.header, fontWeight: 700, marginTop: 6 }}>{t("ממתין לאישור ההנהלה")}{hasPriceMismatch ? ` (${t("יש הבדל ממחיר המערכת")})` : ""}</div>}
            {mgr && lead.pending_approval && !readOnly && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => actions.approveDeal(lead.id, false, orderLines)} style={buttonPrimary}>{t("אשר לפי מחיר המערכת")}</button>
                {hasPriceMismatch && <button onClick={() => actions.approveDeal(lead.id, true, orderLines)} style={buttonGhost}>{t("אשר לפי המחיר שניתן")}</button>}
              </div>
            )}
            {!lead.pending_approval && lead.ops_status && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13 }}>{t("סטטוס תפעול")}: <b>{tStatus(lead.ops_status)}</b></div>
                {!readOnly && (() => {
                  const idx = OPS_STATUS_OPTIONS.indexOf(lead.ops_status);
                  const isLastStep = idx < 0 || idx >= OPS_STATUS_OPTIONS.length - 1;
                  const nextIsDelivery = idx === OPS_STATUS_OPTIONS.length - 2;
                  if (isLastStep) return null;
                  if (nextIsDelivery && !mgr) return null;
                  return <button onClick={() => actions.advanceOps(lead)} style={{ ...buttonGhost, marginTop: 6 }}>{t("קדם שלב")}</button>;
                })()}
                {mgr && lead.ops_status === "נמסר ללקוח" && (
                  linkedSystem ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: colors.accent, fontWeight: 700 }}>
                      ✓ {t("כבר מקושר למערכת")}: "{linkedSystem.name}"
                    </div>
                  ) : (
                    <button onClick={convertToSystem} style={{ ...buttonPrimary, marginTop: 8 }}>{t("הפוך למערכת פעילה")}</button>
                  )
                )}
              </div>
            )}
            {mgr && !readOnly && <SupplierLinkMini leadId={lead.id} showToast={showToast} t={t} />}
          </Section>
        )}

        {!readOnly && (
          <Section title={t("קביעת פגישה")}>
            <button onClick={() => setShowApptPicker(true)} style={{ ...buttonGhost, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CalendarPlus size={16} /> {t("פתח יומן וקבע פגישה")}
            </button>
          </Section>
        )}

        <Section title={t("הודעות ללקוח")}>
          {messages.map((m) => (
            <div key={m.id} style={{ fontSize: 13, padding: "4px 0" }}>{m.text}</div>
          ))}
          {!readOnly && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input style={inputStyle} placeholder={t("הודעה…")} value={msgText} onChange={(e) => setMsgText(e.target.value)} />
              <button onClick={handleAddMessage} style={buttonGhost}>{t("שלח")}</button>
            </div>
          )}
        </Section>

        <Section title={t("קבצים מצורפים")}>
          <LeadFiles lead={lead} files={files} profile={profile} mgr={mgr} readOnly={readOnly} showToast={showToast} t={t} />
        </Section>

        {mgr && activityLog.length > 0 && (
          <Section title={t("יומן פעילות")}>
            {activityLog.map((a) => (
              <div key={a.id} style={{ fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${colors.border}`, color: colors.mutedText }}>
                <span style={{ color: colors.text }}>{describeActivity(a, repName, t, tStatus)}</span>
                {" · "}{repName(a.actor_id)} · {fmtDate(a.created_at)}
              </div>
            ))}
          </Section>
        )}

        {!readOnly && (
          <Section title={t("משימה / תזכורת אישית")}>
            <LeadTaskMini lead={lead} profile={profile} showToast={showToast} t={t} />
          </Section>
        )}

        {!readOnly && !lead.canceled && !lead.archived && (
          <button onClick={() => actions.cancelLead(lead.id)} style={{ ...buttonDanger, marginTop: 10 }}>{t("ביטול ליד")}</button>
        )}
        {mgr && lead.canceled && !readOnly && (
          <button onClick={() => actions.restoreLead(lead.id)} style={{ ...buttonGhost, marginTop: 10 }}>{t("שחזור ליד")}</button>
        )}
        {canDelete && !readOnly && (
          <button onClick={handleDeleteLead} style={{ ...buttonGhost, marginTop: 10, color: colors.danger, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Trash2 size={14} /> {t("מחק ליד לצמיתות")}
          </button>
        )}
      </div>

      {showApptPicker && (
        <AppointmentPickerModal lead={lead} profile={profile} showToast={showToast} onClose={() => setShowApptPicker(false)} />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: colors.mutedText, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function describeActivity(a, repName, t, tStatus) {
  if (a.action === "process_status") return `${t("סטטוס תהליך שונה מ")}"${tStatus(a.old_value) || "—"}" ${t("ל")}"${tStatus(a.new_value) || "—"}"`;
  if (a.action === "lead_status") return `${t("סטטוס ליד שונה מ")}"${tStatus(a.old_value) || "—"}" ${t("ל")}"${tStatus(a.new_value) || "—"}"`;
  if (a.action === "claimed_by") {
    if (!a.old_value && a.new_value) return `${t("שויך ל")}${repName(a.new_value)}`;
    if (a.old_value && !a.new_value) return `${t("שוחרר מ")}${repName(a.old_value)}`;
    return `${t("הועבר מ")}${repName(a.old_value)} ${t("ל")}${repName(a.new_value)}`;
  }
  if (a.action === "canceled") return a.new_value === "true" ? t("הליד בוטל") : t("הליד שוחזר");
  return a.action;
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}>
      <span style={{ color: colors.muted }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Small, unobtrusive by design (per the request): lets a manager attach a supplier charge to
// this already-closed deal without leaving the drawer, without competing visually with the
// main deal info above it.
function SupplierLinkMini({ leadId, showToast, t }) {
  const { rows: charges } = useRealtimeList("supplier_charges", { filterColumn: "lead_id", filterValue: leadId, orderBy: "created_at", ascending: true });
  const { rows: supplierNames } = useRealtimeList("suppliers_master", { orderBy: "name", ascending: true });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ supplierId: "", amount: "", dueDate: "" });

  function supplierName(id) { return supplierNames.find((s) => s.id === id)?.name || "—"; }
  async function togglePaid(c) { await supabase.from("supplier_charges").update({ paid: !c.paid }).eq("id", c.id); }

  async function addCharge(e) {
    e.preventDefault();
    if (!form.supplierId || !form.amount) { showToast(t("יש לבחור ספק ולהזין סכום")); return; }
    const { error } = await supabase.from("supplier_charges").insert({
      supplier_id: form.supplierId, amount: Number(form.amount), due_date: form.dueDate || null, lead_id: leadId,
    });
    if (error) { showToast(t("שגיאה בשיוך הספק")); return; }
    setForm({ supplierId: "", amount: "", dueDate: "" });
    setOpen(false);
    showToast(t("הספק שויך לעסקה"));
  }

  const smallInput = { fontSize: 11, padding: "3px 5px", borderRadius: 5, border: `1px solid ${colors.border}` };

  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${colors.border}` }}>
      {charges.length > 0 && (
        <div style={{ display: "grid", gap: 3, marginBottom: 4 }}>
          {charges.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: colors.muted }}>
              <span>{supplierName(c.supplier_id)} · {money(c.amount)}{c.paid ? ` · ${t("שולם")}` : ""}</span>
              {!c.paid && (
                <button onClick={() => togglePaid(c)} style={{ border: "none", background: "none", color: colors.accent, cursor: "pointer", fontSize: 10.5 }}>
                  {t("סמן כשולם")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ border: "none", background: "none", color: colors.muted, fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
          + {t("קשר ספק לעסקה")}
        </button>
      ) : (
        <form onSubmit={addCharge} style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
          <select style={{ ...smallInput, width: 90 }} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">{t("ספק…")}</option>
            {supplierNames.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="number" placeholder={t("סכום")} style={{ ...smallInput, width: 60 }} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input type="date" style={{ ...smallInput, width: 110 }} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <button type="submit" style={{ ...smallInput, background: colors.accent, color: "#fff", border: "none", cursor: "pointer" }}>{t("שייך")}</button>
          <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "none", color: colors.muted, cursor: "pointer", fontSize: 11 }}>{t("ביטול")}</button>
        </form>
      )}
    </div>
  );
}

const CONTACT_EMPTY = { name: "", role: "", phone: "", email: "" };

function ContactsList({ leadId, readOnly, showToast, t }) {
  const { rows: contacts } = useRealtimeList("lead_contacts", { filterColumn: "lead_id", filterValue: leadId, orderBy: "created_at", ascending: true });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(CONTACT_EMPTY);

  async function addContact(e) {
    e.preventDefault();
    if (!form.name.trim()) { showToast(t("יש להזין שם")); return; }
    const { error } = await supabase.from("lead_contacts").insert({
      lead_id: leadId, name: form.name.trim(), role: form.role.trim() || null,
      phone: form.phone.trim() || null, email: form.email.trim() || null,
    });
    if (error) { showToast(t("שגיאה בהוספת איש קשר")); return; }
    setForm(CONTACT_EMPTY);
    setOpen(false);
    showToast(t("איש הקשר נוסף"));
  }

  async function removeContact(id) {
    await supabase.from("lead_contacts").delete().eq("id", id);
  }

  const smallInput = { fontSize: 11, padding: "3px 5px", borderRadius: 5, border: `1px solid ${colors.border}` };

  return (
    <div>
      {contacts.length === 0 && <div style={{ fontSize: 12.5, color: colors.muted }}>{t("אין עדיין אנשי קשר נוספים")}</div>}
      {contacts.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginBottom: 6 }}>
          {contacts.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
              <span>
                <b>{c.name}</b>{c.role ? ` · ${c.role}` : ""}{c.phone ? ` · ${c.phone}` : ""}{c.email ? ` · ${c.email}` : ""}
              </span>
              {!readOnly && (
                <button onClick={() => removeContact(c.id)} style={{ border: "none", background: "none", color: colors.muted, cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        !open ? (
          <button onClick={() => setOpen(true)} style={{ border: "none", background: "none", color: colors.muted, fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            + {t("הוסף איש קשר")}
          </button>
        ) : (
          <form onSubmit={addContact} style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder={t("שם")} style={{ ...smallInput, width: 90 }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <input placeholder={t("תפקיד")} style={{ ...smallInput, width: 90 }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <input placeholder={t("טלפון")} style={{ ...smallInput, width: 90 }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder={t("אימייל")} style={{ ...smallInput, width: 110 }} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <button type="submit" style={{ ...smallInput, background: colors.accent, color: "#fff", border: "none", cursor: "pointer" }}>{t("שמור")}</button>
            <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "none", color: colors.muted, cursor: "pointer", fontSize: 11 }}>{t("ביטול")}</button>
          </form>
        )
      )}
    </div>
  );
}

function LeadFiles({ lead, files, profile, mgr, readOnly, showToast, t }) {
  const [uploading, setUploading] = useState(false);

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const path = `${lead.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("lead-files").upload(path, file);
    if (upErr) { setUploading(false); showToast(t("שגיאה בהעלאת הקובץ")); return; }
    const { data } = supabase.storage.from("lead-files").getPublicUrl(path);
    const { error } = await supabase.from("lead_files").insert({
      lead_id: lead.id, name: file.name, file_type: file.type, url: data.publicUrl, uploaded_by: profile.id,
    });
    setUploading(false);
    if (error) { showToast(t("שגיאה בשמירת הקובץ")); return; }
    showToast(t("הקובץ צורף"));
  }

  async function remove(f) {
    await supabase.from("lead_files").delete().eq("id", f.id);
  }

  return (
    <div>
      {files.length === 0 ? (
        <div style={{ fontSize: 12.5, color: colors.muted }}>{t("אין קבצים מצורפים")}</div>
      ) : (
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {files.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <FileText size={14} color={colors.muted} style={{ flexShrink: 0 }} />
              <a href={f.url} target="_blank" rel="noreferrer" style={{ color: colors.accent, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name}
              </a>
              {(f.uploaded_by === profile.id || mgr) && !readOnly && (
                <button onClick={() => remove(f)} style={{ border: "none", background: "none", color: colors.muted, cursor: "pointer", flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <label style={{ ...buttonGhost, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <Paperclip size={15} /> {uploading ? t("מעלה…") : t("צרף קובץ")}
          <input type="file" onChange={handleFileSelect} disabled={uploading} style={{ display: "none" }} />
        </label>
      )}
    </div>
  );
}

function defaultDueInput() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Quick "add a task/reminder for myself about this lead" form, plus a list of the ones already
// linked to it that I created — kept inside the drawer so reps don't need to leave the lead to
// jot down a follow-up.
function LeadTaskMini({ lead, profile, showToast, t }) {
  const { rows: myItems } = useRealtimeList("tasks", { filterColumn: "lead_id", filterValue: lead.id, orderBy: "due_at", ascending: true });
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("task");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(defaultDueInput());
  const [remindBefore, setRemindBefore] = useState(60);
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!due) { showToast(t("יש לבחור תאריך")); return; }
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      owner_id: profile.id, created_by: profile.id, kind,
      title: title.trim() || lead.name, due_at: new Date(due).toISOString(),
      remind_before_minutes: Number(remindBefore), lead_id: lead.id, lead_name: lead.name,
    });
    setSaving(false);
    if (error) { showToast(t("שגיאה בהוספה")); return; }
    setTitle(""); setDue(defaultDueInput()); setRemindBefore(60); setOpen(false);
    showToast(kind === "reminder" ? t("התזכורת נוספה") : t("המשימה נוספה"));
  }

  return (
    <div>
      {myItems.length > 0 && (
        <div style={{ display: "grid", gap: 4, marginBottom: 8 }}>
          {myItems.map((item) => (
            <div key={item.id} style={{ fontSize: 12, color: item.completed ? colors.muted : colors.text, textDecoration: item.completed ? "line-through" : "none" }}>
              {item.kind === "reminder" ? "🔔" : "📋"} {item.title} · {fmtDate(item.due_at)}
            </div>
          ))}
        </div>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} style={buttonGhost}>+ {t("הוסף תזכורת / משימה")}</button>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => setKind("task")} style={kind === "task" ? buttonPrimary : buttonGhost}>{t("משימה")}</button>
            <button type="button" onClick={() => setKind("reminder")} style={kind === "reminder" ? buttonPrimary : buttonGhost}>{t("תזכורת")}</button>
          </div>
          <input style={inputStyle} placeholder={`${t("כותרת (ברירת מחדל")}: ${lead.name})`} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input type="datetime-local" style={{ ...inputStyle, flex: 1, minWidth: 160 }} value={due} onChange={(e) => setDue(e.target.value)} />
            <select style={{ ...inputStyle, flex: 1, minWidth: 130 }} value={remindBefore} onChange={(e) => setRemindBefore(e.target.value)}>
              {REMIND_BEFORE_OPTIONS.map(([mins, label]) => <option key={mins} value={mins}>{t(label)}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={add} disabled={saving} style={buttonPrimary}>{saving ? t("שומר…") : t("הוסף")}</button>
            <button onClick={() => setOpen(false)} style={buttonGhost}>{t("ביטול")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
