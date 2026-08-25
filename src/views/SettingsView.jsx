import React, { useState, useEffect, useRef } from "react";
import { Settings } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonPrimary, buttonGhost, buttonDanger } from "../lib/theme";
import { canActLikeManager, canResetSystem } from "../lib/permissions";
import { ROLE_OPTIONS } from "../lib/constants";
import { validatePassword } from "../lib/passwordPolicy";
import { fmtDate } from "../lib/format";
import { useLanguage } from "../lib/LanguageContext";
import PageHeader from "../components/PageHeader";
import InlineEdit from "../components/InlineEdit";

export default function SettingsView({ profile, profiles, catalog, navLabels, showToast }) {
  const mgr = canActLikeManager(profile);
  const canReset = canResetSystem(profile);
  const { t } = useLanguage();

  return (
    <div>
      <PageHeader icon={Settings} title={t("הגדרות")} />
      <div style={{ display: "grid", gap: 16, maxWidth: 640 }}>
        <LanguageSection />
        <PasswordSection showToast={showToast} />
        <MfaSection showToast={showToast} />
        {mgr && <UserManagementSection profile={profile} profiles={profiles} showToast={showToast} />}
        {mgr && <ActiveSessionsSection showToast={showToast} />}
        {mgr && <CatalogSection catalog={catalog} showToast={showToast} />}
        {mgr && <NavLabelsSection navLabels={navLabels} showToast={showToast} />}
        {mgr && <CustomTabsSection showToast={showToast} />}
        {mgr && <MessageTemplatesSection showToast={showToast} />}
        {mgr && <GoogleCalendarSection showToast={showToast} />}
        {canReset && <ResetSection showToast={showToast} />}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function LanguageSection() {
  const { lang, setLang, t } = useLanguage();
  return (
    <Card title={t("שפת מערכת")}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setLang("he")} style={lang === "he" ? buttonPrimary : buttonGhost}>עברית</button>
        <button onClick={() => setLang("en")} style={lang === "en" ? buttonPrimary : buttonGhost}>English</button>
      </div>
    </Card>
  );
}

function PasswordSection({ showToast }) {
  const { t } = useLanguage();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function change() {
    if (!currentPw) { showToast(t("יש להזין את הסיסמה הנוכחית")); return; }
    const pwError = validatePassword(newPw);
    if (pwError) { showToast(pwError); return; }
    if (newPw !== confirmPw) { showToast(t("הסיסמה החדשה וחזרה עליה לא זהות")); return; }
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: userData.user.email, password: currentPw });
    if (verifyErr) { setBusy(false); showToast(t("הסיסמה הנוכחית שגויה")); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setBusy(false);
    if (error) { showToast(t("שגיאה בשינוי סיסמה")); return; }
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    showToast(t("הסיסמה עודכנה"));
  }

  return (
    <Card title={t("שינוי סיסמה")}>
      <div style={{ display: "grid", gap: 8, maxWidth: 280 }}>
        <input type="password" style={inputStyle} placeholder={t("סיסמה נוכחית")} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
        <input type="password" style={inputStyle} placeholder={t("סיסמה חדשה")} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <input type="password" style={inputStyle} placeholder={t("חזרה על הסיסמה החדשה")} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        <div style={{ fontSize: 11, color: colors.muted }}>{t("8-16 תווים, אות גדולה, אות קטנה ומספר")}</div>
        <button onClick={change} disabled={busy} style={buttonPrimary}>{busy ? t("מעדכן…") : t("עדכן סיסמה")}</button>
      </div>
    </Card>
  );
}

function MfaSection({ showToast }) {
  const { t } = useLanguage();
  const [verifiedFactor, setVerifiedFactor] = useState(null);
  const [enrolling, setEnrolling] = useState(null); // { factorId, qrCode, secret }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setVerifiedFactor(data?.totp?.find((f) => f.status === "verified") || null);
      setLoaded(true);
    });
  }, []);

  async function startEnroll() {
    setBusy(true);
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.totp || []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) { showToast(t("שגיאה בהפעלת אימות דו-שלבי")); return; }
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll(e) {
    e.preventDefault();
    setBusy(true);
    const { data: challenge, error: challErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (challErr) { setBusy(false); showToast(t("שגיאה ביצירת אתגר האימות")); return; }
    const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: enrolling.factorId, challengeId: challenge.id, code: code.trim() });
    setBusy(false);
    if (verifyErr) { showToast(t("קוד שגוי — נסי שוב")); return; }
    setVerifiedFactor({ id: enrolling.factorId, status: "verified" });
    setEnrolling(null);
    setCode("");
    showToast(t("אימות דו-שלבי הופעל"));
  }

  async function disable() {
    if (!verifiedFactor) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    setBusy(false);
    if (error) { showToast(t("שגיאה בביטול")); return; }
    setVerifiedFactor(null);
    showToast(t("אימות דו-שלבי בוטל"));
  }

  return (
    <Card title={t("אימות דו-שלבי (2FA)")}>
      <div style={{ fontSize: 12.5, color: colors.mutedText, marginBottom: 10 }}>
        {t("מוסיף שכבת הגנה נוספת: אחרי הזנת הסיסמה, תתבקשי גם להזין קוד בן 6 ספרות מאפליקציית אימות (כמו Google Authenticator). מומלץ במיוחד לחשבונות מנהל/סגן.")}
      </div>
      {!loaded ? (
        <div style={{ fontSize: 12.5, color: colors.muted }}>{t("טוען…")}</div>
      ) : verifiedFactor ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#2e7d32", fontWeight: 700 }}>✓ {t("פעיל")}</span>
          <button onClick={disable} disabled={busy} style={buttonGhost}>{t("בטל")}</button>
        </div>
      ) : enrolling ? (
        <form onSubmit={confirmEnroll} style={{ display: "grid", gap: 10, maxWidth: 280 }}>
          <div style={{ fontSize: 12.5 }}>{t("סרקי את הקוד עם אפליקציית אימות (Google Authenticator / Authy):")}</div>
          <img src={enrolling.qrCode} alt="QR" style={{ width: 180, height: 180, alignSelf: "center" }} />
          <div style={{ fontSize: 11, color: colors.muted, wordBreak: "break-all" }}>{t("או הזיני ידנית:")} {enrolling.secret}</div>
          <input
            placeholder={t("קוד בן 6 ספרות")} value={code} onChange={(e) => setCode(e.target.value)}
            inputMode="numeric" maxLength={6} style={{ ...inputStyle, textAlign: "center", letterSpacing: 4 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={busy || code.length < 6} style={buttonPrimary}>{t("אשר והפעל")}</button>
            <button type="button" onClick={() => setEnrolling(null)} style={buttonGhost}>{t("ביטול")}</button>
          </div>
        </form>
      ) : (
        <button onClick={startEnroll} disabled={busy} style={buttonPrimary}>{busy ? t("מתחיל…") : t("הפעל אימות דו-שלבי")}</button>
      )}
    </Card>
  );
}

function UserManagementSection({ profile, profiles, showToast }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ username: "", name: "", password: "", role: ROLE_OPTIONS[0] });
  const [busy, setBusy] = useState(false);

  async function addAccount(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.name.trim()) { showToast(t("יש למלא שם משתמש ושם תצוגה")); return; }
    const pwError = validatePassword(form.password);
    if (pwError) { showToast(pwError); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-account", { body: form });
    setBusy(false);
    if (error || data?.error) { showToast((data && data.error) || t("שגיאה ביצירת המשתמש — ודא שה-Edge Function פרוסה")); return; }
    setForm({ username: "", name: "", password: "", role: ROLE_OPTIONS[0] });
    showToast(t("המשתמש נוצר"));
  }

  async function changeRole(id, role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) showToast(t("שגיאה בעדכון תפקיד"));
  }

  async function toggleReportsAccess(p) {
    const { error } = await supabase.from("profiles").update({ can_view_reports: !p.can_view_reports }).eq("id", p.id);
    if (error) showToast(t("שגיאה בעדכון גישה לדוחות"));
  }

  async function deleteAccount(id) {
    const { data, error } = await supabase.functions.invoke("admin-delete-account", { body: { targetId: id } });
    if (error || data?.error) { showToast((data && data.error) || t("שגיאה במחיקת המשתמש")); return; }
    showToast(t("המשתמש נמחק"));
  }

  return (
    <Card title={t("ניהול משתמשים")}>
      <form onSubmit={addAccount} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 14 }}>
        <input style={{ ...inputStyle, width: 120 }} placeholder={t("שם משתמש")} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input style={{ ...inputStyle, width: 120 }} placeholder={t("שם תצוגה")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div>
          <input style={{ ...inputStyle, width: 120 }} placeholder={t("סיסמה")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div style={{ fontSize: 10, color: colors.muted, marginTop: 3, maxWidth: 120 }}>{t("8-16 תווים, אות גדולה, קטנה ומספר")}</div>
        </div>
        <select style={{ ...inputStyle, width: 110 }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" disabled={busy} style={buttonPrimary}>{busy ? t("יוצר…") : t("צור משתמש")}</button>
      </form>
      <div style={{ display: "grid", gap: 6 }}>
        {profiles.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5, padding: "4px 0", borderBottom: `1px solid ${colors.border}` }}>
            <span>{p.name} ({p.username}){p.is_super_admin ? ` · ${t("סופר-אדמין")}` : ""}</span>
            {!p.is_super_admin && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select style={{ ...inputStyle, width: 100, padding: 4 }} value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}>
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  onClick={() => toggleReportsAccess(p)}
                  title={t("גישה לדוחות תקופתיים")}
                  style={{
                    border: `1px solid ${p.can_view_reports ? colors.accent : colors.border}`, borderRadius: 6, cursor: "pointer",
                    background: p.can_view_reports ? colors.accent : "#fff", color: p.can_view_reports ? "#fff" : colors.muted,
                    fontSize: 11, padding: "4px 8px",
                  }}
                >
                  {t("דוחות")}
                </button>
                {p.id !== profile.id && <button onClick={() => deleteAccount(p.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>{t("מחק")}</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActiveSessionsSection({ showToast }) {
  const { t, tStatus } = useLanguage();
  const [sessions, setSessions] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const { data, error } = await supabase.rpc("list_active_sessions");
    if (error) { showToast(t("שגיאה בטעינת ההתחברויות")); return; }
    setSessions(data || []);
  }

  useEffect(() => { load(); }, []);

  async function disconnect(sessionId) {
    setBusyId(sessionId);
    const { error } = await supabase.rpc("force_logout_session", { target_session_id: sessionId });
    setBusyId(null);
    if (error) { showToast(t("שגיאה בניתוק")); return; }
    showToast(t("ההתחברות נותקה"));
    load();
  }

  return (
    <Card title={t("התחברויות פעילות")}>
      <div style={{ fontSize: 12.5, color: colors.mutedText, marginBottom: 10 }}>
        {t("רשימת כל המכשירים/דפדפנים המחוברים כרגע למערכת. ניתוק כאן מנתק את המכשיר תוך זמן קצר (עד שהוא מנסה לרענן את החיבור).")}
      </div>
      <button onClick={load} style={{ ...buttonGhost, marginBottom: 10 }}>{t("רענן")}</button>
      {sessions === null ? (
        <div style={{ fontSize: 12.5, color: colors.muted }}>{t("טוען…")}</div>
      ) : sessions.length === 0 ? (
        <div style={{ fontSize: 12.5, color: colors.muted }}>{t("אין התחברויות פעילות")}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sessions.map((s) => (
            <div key={s.session_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: colors.bg, borderRadius: 10, padding: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name} <span style={{ fontWeight: 400, color: colors.muted, fontSize: 11.5 }}>({tStatus(s.role)})</span></div>
                <div style={{ fontSize: 11.5, color: colors.muted }}>{t("פעיל לאחרונה")}: {fmtDate(s.updated_at)}</div>
              </div>
              <button onClick={() => disconnect(s.session_id)} disabled={busyId === s.session_id} style={buttonDanger}>
                {busyId === s.session_id ? t("מנתק…") : t("נתק")}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CatalogSection({ catalog, showToast }) {
  const { t } = useLanguage();
  const [newProduct, setNewProduct] = useState({ name: "", subProduct: "", qty: "", price: "" });

  async function updateTierPrice(tierId, price) {
    const n = Number(price);
    if (!price || !(n > 0)) { showToast(t("המחיר חייב להיות מספר גדול מ-0 — לא נשמר")); return; }
    await supabase.from("product_tiers").update({ price: n }).eq("id", tierId);
  }
  async function addProduct(e) {
    e.preventDefault();
    if (!newProduct.name.trim() || !newProduct.subProduct.trim() || !newProduct.qty || !newProduct.price) { showToast(t("יש למלא את כל השדות")); return; }
    const { data, error } = await supabase.from("products").insert({ name: newProduct.name.trim(), sub_product: newProduct.subProduct.trim() }).select().single();
    if (error) { showToast(t("שגיאה בהוספת מוצר")); return; }
    await supabase.from("product_tiers").insert({ product_id: data.id, qty: Number(newProduct.qty), price: Number(newProduct.price) });
    setNewProduct({ name: "", subProduct: "", qty: "", price: "" });
    showToast(t("המוצר נוסף"));
  }
  async function removeProduct(id) {
    await supabase.from("products").delete().eq("id", id);
  }
  async function addFinish() {
    await supabase.from("finishes").insert({ name: t("רמת שירות חדשה"), mult: 1 });
  }
  async function updateFinish(id, field, value) {
    await supabase.from("finishes").update({ [field]: field === "mult" ? Number(value) || 1 : value }).eq("id", id);
  }
  async function removeFinish(id) { await supabase.from("finishes").delete().eq("id", id); }
  async function addGlobalAddon() {
    await supabase.from("global_addons").insert({ name: t("תוספת חדשה"), price: 0 });
  }
  async function updateGlobalAddon(id, field, value) {
    if (field === "price") {
      const n = Number(value);
      if (!value || !(n >= 0)) { showToast(t("המחיר חייב להיות מספר תקין — לא נשמר")); return; }
      await supabase.from("global_addons").update({ price: n }).eq("id", id);
      return;
    }
    await supabase.from("global_addons").update({ [field]: value }).eq("id", id);
  }
  async function removeGlobalAddon(id) { await supabase.from("global_addons").delete().eq("id", id); }

  const shippingOption = catalog.shippingOptions[0] || null;
  const [newRange, setNewRange] = useState({ from: "", to: "", price: "" });

  async function updateShippingRange(id, field, value) {
    const n = Number(value);
    if (!value || !(n >= 0)) { showToast(t("הערך חייב להיות מספר תקין — לא נשמר")); return; }
    await supabase.from("shipping_ranges").update({ [field]: n }).eq("id", id);
  }
  async function removeShippingRange(id) { await supabase.from("shipping_ranges").delete().eq("id", id); }
  async function addShippingRange(e) {
    e.preventDefault();
    if (!shippingOption) { showToast(t("אין עדיין שיטת פריסה מוגדרת")); return; }
    if (!newRange.from || !newRange.to || !newRange.price) { showToast(t("יש למלא טווח כמות ומחיר")); return; }
    await supabase.from("shipping_ranges").insert({
      shipping_option_id: shippingOption.id, from_qty: Number(newRange.from), to_qty: Number(newRange.to), price: Number(newRange.price),
    });
    setNewRange({ from: "", to: "", price: "" });
    showToast(t("טווח הפריסה נוסף"));
  }

  return (
    <Card title={t("קטלוג ותמחור")}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{t("מוצרים ומדרגות מחיר")}</div>
      <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 10 }}>
        {catalog.products.map((p) => (
          <div key={p.id} style={{ fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{p.name} · {p.sub_product}</span>
              <button onClick={() => removeProduct(p.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>{t("מחק")}</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {p.tiers.map((tier) => (
                <span key={tier.id} style={{ fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 2 }}>
                  {t("מ-")}{tier.qty}:
                  <InlineEdit type="number" value={tier.price} onSave={(v) => updateTierPrice(tier.id, v)} width={55} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={addProduct} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <input style={{ ...inputStyle, width: 110 }} placeholder={t("שם מוצר")} value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
        <input style={{ ...inputStyle, width: 110 }} placeholder={t("גודל/סוג")} value={newProduct.subProduct} onChange={(e) => setNewProduct({ ...newProduct, subProduct: e.target.value })} />
        <input type="number" style={{ ...inputStyle, width: 80 }} placeholder={t("כמות")} value={newProduct.qty} onChange={(e) => setNewProduct({ ...newProduct, qty: e.target.value })} />
        <input type="number" style={{ ...inputStyle, width: 80 }} placeholder={t("מחיר")} value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
        <button type="submit" style={buttonGhost}>{t("הוסף מוצר")}</button>
      </form>

      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{t("רמות שירות")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {catalog.finishes.map((f) => (
          <div key={f.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
            <InlineEdit value={f.name} onSave={(v) => updateFinish(f.id, "name", v)} width={70} />
            <InlineEdit type="number" step="0.05" value={f.mult} onSave={(v) => updateFinish(f.id, "mult", v)} width={50} />
            <button onClick={() => removeFinish(f.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>×</button>
          </div>
        ))}
        <button onClick={addFinish} style={buttonGhost}>+ {t("רמת שירות")}</button>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{t("תוספות כלליות")}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {catalog.globalAddons.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
            <InlineEdit value={a.name} onSave={(v) => updateGlobalAddon(a.id, "name", v)} width={80} />
            <InlineEdit type="number" value={a.price} onSave={(v) => updateGlobalAddon(a.id, "price", v)} width={55} />
            <button onClick={() => removeGlobalAddon(a.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>×</button>
          </div>
        ))}
        <button onClick={addGlobalAddon} style={buttonGhost}>+ {t("תוספת")}</button>
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6, marginTop: 16 }}>{t("מחירי פריסה והטמעה")}</div>
      <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
        {(shippingOption?.ranges || []).sort((a, b) => a.from_qty - b.from_qty).map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span>{t("מ-")}</span>
            <InlineEdit type="number" value={r.from_qty} onSave={(v) => updateShippingRange(r.id, "from_qty", v)} width={70} />
            <span>{t("עד")}</span>
            <InlineEdit type="number" value={r.to_qty} onSave={(v) => updateShippingRange(r.id, "to_qty", v)} width={70} />
            <span>{t("עלות")}</span>
            <InlineEdit type="number" value={r.price} onSave={(v) => updateShippingRange(r.id, "price", v)} width={70} />
            <span>₪</span>
            <button onClick={() => removeShippingRange(r.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>×</button>
          </div>
        ))}
        {!shippingOption?.ranges?.length && <div style={{ fontSize: 12, color: colors.muted }}>{t("אין עדיין טווחי פריסה")}</div>}
      </div>
      <form onSubmit={addShippingRange} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input type="number" style={{ ...inputStyle, width: 90 }} placeholder={t("מכמות")} value={newRange.from} onChange={(e) => setNewRange({ ...newRange, from: e.target.value })} />
        <input type="number" style={{ ...inputStyle, width: 90 }} placeholder={t("עד כמות")} value={newRange.to} onChange={(e) => setNewRange({ ...newRange, to: e.target.value })} />
        <input type="number" style={{ ...inputStyle, width: 90 }} placeholder={t("עלות ₪")} value={newRange.price} onChange={(e) => setNewRange({ ...newRange, price: e.target.value })} />
        <button type="submit" style={buttonGhost}>+ {t("טווח פריסה")}</button>
      </form>
    </Card>
  );
}

function NavLabelsSection({ navLabels, showToast }) {
  const { t } = useLanguage();
  async function updateLabel(key, value) {
    const next = { ...navLabels, [key]: value };
    const { error } = await supabase.from("app_settings").upsert({ key: "nav_labels", value: next });
    if (error) showToast(t("שגיאה בעדכון תוויות"));
  }
  return (
    <Card title={t("שמות לשוניות")}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {Object.entries(navLabels).map(([key, label]) => (
          <label key={key} style={{ fontSize: 12 }}>
            {key}
            <input style={{ ...inputStyle, marginTop: 2 }} defaultValue={label} onBlur={(e) => updateLabel(key, e.target.value)} />
          </label>
        ))}
      </div>
    </Card>
  );
}

function CustomTabsSection({ showToast }) {
  const { t } = useLanguage();
  const { rows: tabs } = useRealtimeList("custom_tabs", { orderBy: "sort_order", ascending: true });
  const [form, setForm] = useState({ label: "", title: "", content: "" });

  async function addTab(e) {
    e.preventDefault();
    if (!form.label.trim()) { showToast(t("יש להזין שם ללשונית")); return; }
    await supabase.from("custom_tabs").insert({ label: form.label.trim(), title: form.title.trim(), content: form.content, sort_order: tabs.length });
    setForm({ label: "", title: "", content: "" });
    showToast(t("הלשונית נוספה"));
  }
  async function removeTab(id) { await supabase.from("custom_tabs").delete().eq("id", id); }

  return (
    <Card title={t("לשוניות מותאמות אישית")}>
      {tabs.map((tab) => (
        <div key={tab.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${colors.border}` }}>
          <span>{tab.label}</span>
          <button onClick={() => removeTab(tab.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>{t("מחק")}</button>
        </div>
      ))}
      <form onSubmit={addTab} style={{ display: "grid", gap: 6, marginTop: 10 }}>
        <input style={inputStyle} placeholder={t("שם בתפריט")} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input style={inputStyle} placeholder={t("כותרת")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea style={{ ...inputStyle, minHeight: 60 }} placeholder={t("תוכן")} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <button type="submit" style={buttonGhost}>{t("הוסף לשונית")}</button>
      </form>
    </Card>
  );
}

function MessageTemplatesSection({ showToast }) {
  const { t } = useLanguage();
  const { rows: templates } = useRealtimeList("message_templates", { orderBy: "sort_order", ascending: true });
  const [form, setForm] = useState({ title: "", body: "" });

  async function addTemplate(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { showToast(t("יש למלא כותרת ותוכן")); return; }
    await supabase.from("message_templates").insert({ title: form.title.trim(), body: form.body.trim(), sort_order: templates.length });
    setForm({ title: "", body: "" });
    showToast(t("התבנית נוספה"));
  }
  async function removeTemplate(id) { await supabase.from("message_templates").delete().eq("id", id); }

  return (
    <Card title={t("תבניות הודעה מהירות (וואטסאפ)")}>
      <div style={{ fontSize: 11.5, color: colors.mutedText, marginBottom: 10 }}>
        {t("אפשר להשתמש ב-{שם} בתוכן ההודעה — הוא יוחלף אוטומטית בשם הליד.")}
      </div>
      {templates.map((tpl) => (
        <div key={tpl.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${colors.border}` }}>
          <div>
            <div style={{ fontWeight: 700 }}>{tpl.title}</div>
            <div style={{ color: colors.mutedText, fontSize: 12 }}>{tpl.body}</div>
          </div>
          <button onClick={() => removeTemplate(tpl.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer" }}>{t("מחק")}</button>
        </div>
      ))}
      <form onSubmit={addTemplate} style={{ display: "grid", gap: 6, marginTop: 10 }}>
        <input style={inputStyle} placeholder={t("כותרת הכפתור (למשל: תודה שפנית)")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea style={{ ...inputStyle, minHeight: 60 }} placeholder={t("תוכן ההודעה")} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <button type="submit" style={buttonGhost}>{t("הוסף תבנית")}</button>
      </form>
    </Card>
  );
}

function GoogleCalendarSection({ showToast }) {
  const { t } = useLanguage();
  const [connected, setConnected] = useState(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);
  const { rows: embedRows } = useRealtimeList("app_settings", { filterColumn: "key", filterValue: "google_calendar_embed_url" });
  const [embedInput, setEmbedInput] = useState("");
  const savedEmbedUrl = embedRows[0]?.value || "";

  useEffect(() => { setEmbedInput(savedEmbedUrl); }, [savedEmbedUrl]);

  async function saveEmbedUrl() {
    const url = embedInput.trim();
    if (url && !url.startsWith("https://calendar.google.com/")) {
      showToast(t("הקישור חייב להתחיל ב-https://calendar.google.com/"));
      return;
    }
    const { error } = await supabase.from("app_settings").upsert({ key: "google_calendar_embed_url", value: url });
    if (error) { showToast(t("שגיאה בשמירת הקישור")); return; }
    showToast(t("הקישור נשמר"));
  }

  async function refreshStatus() {
    const { data } = await supabase.rpc("google_calendar_connected");
    setConnected(!!data);
    return !!data;
  }

  useEffect(() => {
    refreshStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function connect() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("google-oauth-start");
    setBusy(false);
    if (error || data?.error || !data?.url) { showToast((data && data.error) || t("שגיאה בהתחברות לגוגל")); return; }
    window.open(data.url, "_blank", "noopener,noreferrer");
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      const ok = await refreshStatus();
      if (ok || attempts > 40) clearInterval(pollRef.current);
    }, 3000);
  }

  async function disconnect() {
    setBusy(true);
    const { error } = await supabase.rpc("disconnect_google_calendar");
    setBusy(false);
    if (error) { showToast(t("שגיאה בניתוק")); return; }
    setConnected(false);
    showToast(t("יומן Google נותק"));
  }

  return (
    <Card title={t("יומן Google")}>
      <div style={{ fontSize: 12.5, color: colors.mutedText, marginBottom: 10 }}>
        {t("פגישות שנקבעות ביומן במערכת יסתנכרנו אוטומטית ליומן Google המחובר, וגם להפך — כולל עריכות ומחיקות. מיועד לחיבור יומן אחד משותף (של עדן).")}
      </div>
      {connected === null ? (
        <div style={{ fontSize: 12.5, color: colors.muted }}>{t("בודק סטטוס…")}</div>
      ) : connected ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#2e7d32", fontWeight: 700 }}>✓ {t("מחובר")}</span>
          <button onClick={disconnect} disabled={busy} style={buttonGhost}>{t("נתק")}</button>
        </div>
      ) : (
        <button onClick={connect} disabled={busy} style={buttonPrimary}>{busy ? t("פותח…") : t("חבר יומן Google")}</button>
      )}

      <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 16, paddingTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{t("הטמעת יומן Google בתוך המערכת")}</div>
        <div style={{ fontSize: 12, color: colors.mutedText, marginBottom: 8 }}>
          {t("הופכים את היומן לציבורי בהגדרות Google Calendar (Settings and sharing → Access permissions → Make available to public), ואז מדביקים כאן את הקישור מתוך \"Integrate calendar → Public URL to this calendar\". שימי לב: יומן ציבורי נגיש לכל מי שיש לו את הקישור.")}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={inputStyle} placeholder="https://calendar.google.com/calendar/embed?src=..." value={embedInput} onChange={(e) => setEmbedInput(e.target.value)} />
          <button onClick={saveEmbedUrl} style={buttonGhost}>{t("שמור")}</button>
        </div>
      </div>
    </Card>
  );
}

function ResetSection({ showToast }) {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);

  async function resetLeads() {
    const { error } = await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { showToast(t("שגיאה באיפוס")); return; }
    showToast(t("כל הלידים נמחקו"));
    setConfirming(false);
  }

  return (
    <Card title={t("איפוס מערכת")}>
      <div style={{ fontSize: 12.5, color: colors.mutedText, marginBottom: 10 }}>{t("מוחק את כל הלידים וההזמנות לצמיתות. פעולה בלתי הפיכה.")}</div>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} style={buttonDanger}>{t("איפוס כל הלידים")}</button>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={resetLeads} style={buttonDanger}>{t("כן, מחק הכל")}</button>
          <button onClick={() => setConfirming(false)} style={buttonGhost}>{t("ביטול")}</button>
        </div>
      )}
    </Card>
  );
}
