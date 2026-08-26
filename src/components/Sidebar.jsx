import React, { useMemo, useState } from "react";
import {
  Inbox, Briefcase, UserPlus, Calculator, Upload, Factory, CalendarDays,
  BarChart3, Users, Bell, CreditCard, Truck, Archive, XCircle, Settings, FileText, LogOut,
  ChevronLeft, ChevronRight, MessageCircle, Sparkles, Smartphone, PieChart, LineChart, ListTodo, ThumbsDown, Megaphone, Search, Layers, LifeBuoy,
} from "lucide-react";
import { colors } from "../lib/theme";
import { canActLikeManager, isRegularRep, canViewReports } from "../lib/permissions";

const ICONS = {
  inbox: Inbox, myDeals: Briefcase, add: UserPlus, calc: Calculator, import: Upload, ops: Factory,
  dashboard: BarChart3, customers: Users, notifications: Bell, paymentDues: CreditCard, suppliers: Truck,
  calendar: CalendarDays, history: Archive, canceled: XCircle, settings: Settings, teamChat: MessageCircle,
  download: Smartphone, reports: PieChart, myReports: LineChart, tasks: ListTodo, notInterested: ThumbsDown,
  home: Megaphone, ourSystems: Layers, supportTickets: LifeBuoy,
};

const GROUP_ACCENTS = {
  "בית": "#c9a227", "לידים": "#3548c7", "מכירה ותפעול": "#0ea5a5", "ניהול": "#8a6fae", "ארכיון": "#a89a82", "צוות": "#4b8fa8", "מערכת": "#6b6b6b",
};

function buildGroups(profile) {
  const mgr = canActLikeManager(profile);
  const groups = [
    { title: "בית", items: ["home", "ourSystems"] },
    { title: "לידים", items: [
      "inbox",
      "notInterested",
      !mgr && "myDeals",
      "add",
      "calc",
      mgr && "import",
    ].filter(Boolean) },
    { title: "מכירה ותפעול", items: ["ops", "dashboard", !mgr && "myReports", "calendar", canViewReports(profile) && "reports"].filter(Boolean) },
    { title: "ניהול", items: [
      mgr && "notifications",
      (mgr || isRegularRep(profile)) && "paymentDues",
      mgr && "suppliers",
      "customers",
      "supportTickets",
    ].filter(Boolean) },
    { title: "ארכיון", items: [mgr && "history", mgr && "canceled"].filter(Boolean) },
    { title: "צוות", items: ["teamChat", "tasks"] },
    { title: "מערכת", items: ["settings", "download"] },
  ];
  return groups.filter((g) => g.items.length);
}

export default function Sidebar({ profile, profiles, online, badges, view, setView, navLabels, customTabs, sidebarOpen, setSidebarOpen, onLogout, leads, openLead, t }) {
  const groups = buildGroups(profile);
  const onlineIds = new Set(Object.keys(online || {}));
  const roster = profiles || [];
  const onlineCount = roster.filter((p) => onlineIds.has(p.id)).length;
  const [searchTerm, setSearchTerm] = useState("");

  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < 2 || !leads) return [];
    return leads.filter((l) =>
      (l.name || "").toLowerCase().includes(q) ||
      (l.business_name || "").toLowerCase().includes(q) ||
      (l.phone || "").includes(q)
    ).slice(0, 8);
  }, [searchTerm, leads]);

  function selectSearchResult(id) {
    openLead(id);
    setSearchTerm("");
    if (typeof window !== "undefined" && window.innerWidth <= 820) setSidebarOpen(false);
  }

  function navigateTo(key) {
    setView(key);
    if (typeof window !== "undefined" && window.innerWidth <= 820) setSidebarOpen(false);
  }

  return (
    <div
      className={`sidebar-nav ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
      style={{
        width: sidebarOpen ? 232 : 60, transition: "width .15s", background: "#fff",
        borderInlineEnd: `1px solid ${colors.border}`, display: "flex", flexDirection: "column",
        height: "100vh", position: "sticky", top: 0, flexShrink: 0,
      }}
    >
      <div style={{
        padding: sidebarOpen ? "18px 16px" : "18px 8px",
        background: `linear-gradient(135deg, ${colors.header} 0%, ${colors.accent} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {sidebarOpen ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Sparkles size={18} color="#fff" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: .2 }}>MEXUZ</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.85)" }}>{t("CRM - מערכת לידים")}</div>
            </div>
          </div>
        ) : (
          <Sparkles size={18} color="#fff" />
        )}
        <button onClick={() => setSidebarOpen((s) => !s)} style={{ border: "none", background: "rgba(255,255,255,.2)", borderRadius: 6, cursor: "pointer", color: "#fff", padding: 4, flexShrink: 0 }}>
          {sidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {sidebarOpen && (
        <div style={{ padding: "10px 10px 0", position: "relative" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} color={colors.muted} style={{ position: "absolute", insetInlineStart: 9, top: 9 }} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("חיפוש ליד…")}
              style={{
                width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 28px", fontSize: 12.5,
                borderRadius: 8, border: `1px solid ${colors.border}`, outline: "none",
              }}
            />
          </div>
          {searchResults.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", insetInlineStart: 10, insetInlineEnd: 10, background: "#fff",
              borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.15)", border: `1px solid ${colors.border}`,
              zIndex: 20, maxHeight: 300, overflowY: "auto",
            }}>
              {searchResults.map((l) => (
                <button
                  key={l.id}
                  onClick={() => selectSearchResult(l.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "right", padding: "8px 10px", border: "none",
                    background: "none", cursor: "pointer", borderBottom: `1px solid ${colors.border}`, fontSize: 12.5,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{l.name}</div>
                  <div style={{ color: colors.mutedText, fontSize: 11 }}>{l.business_name} {l.phone ? `· ${l.phone}` : ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {groups.map((g) => {
          const accent = GROUP_ACCENTS[g.title] || colors.accent;
          return (
            <div key={g.title} style={{ marginBottom: 14 }}>
              {sidebarOpen && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "6px 8px" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: colors.muted, fontWeight: 700 }}>{t(g.title)}</span>
                </div>
              )}
              {g.items.map((key) => {
                const Icon = ICONS[key] || FileText;
                const active = view === key;
                const badge = badges?.[key];
                return (
                  <button
                    key={key}
                    className="nav-btn"
                    onClick={() => navigateTo(key)}
                    title={t(navLabels[key]) || key}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
                      borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, position: "relative",
                      background: active ? `${accent}18` : "transparent",
                      borderInlineStart: active ? `3px solid ${accent}` : "3px solid transparent",
                      color: active ? colors.text : "#4b5566",
                      fontWeight: active ? 700 : 500, fontSize: 13.5, textAlign: "right",
                    }}
                  >
                    <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
                      <Icon size={17} color={active ? accent : "#6b7280"} />
                      {!sidebarOpen && badge > 0 && (
                        <span style={{ position: "absolute", top: -4, insetInlineEnd: -4, width: 8, height: 8, borderRadius: "50%", background: colors.danger, border: "1.5px solid #fff" }} />
                      )}
                    </span>
                    {sidebarOpen && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(navLabels[key]) || key}</span>}
                    {sidebarOpen && badge > 0 && (
                      <span style={{
                        background: colors.danger, color: "#fff", fontSize: 10, fontWeight: 700,
                        borderRadius: 10, minWidth: 17, height: 17, display: "flex", alignItems: "center",
                        justifyContent: "center", padding: "0 4px", flexShrink: 0,
                      }}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
        {customTabs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {sidebarOpen && <div style={{ fontSize: 11, color: colors.muted, fontWeight: 700, margin: "6px 8px" }}>{t("נוסף")}</div>}
            {customTabs.map((tab) => (
              <button
                key={tab.id}
                className="nav-btn"
                onClick={() => navigateTo("custom:" + tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
                  borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2,
                  background: view === "custom:" + tab.id ? colors.bg : "transparent", color: colors.text,
                  fontWeight: 500, fontSize: 13.5, textAlign: "right",
                }}
              >
                <FileText size={17} style={{ flexShrink: 0 }} />
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "10px 10px 0", borderTop: `1px solid ${colors.border}` }}>
        {sidebarOpen ? (
          <div style={{ padding: "2px 8px 10px" }}>
            <div style={{ fontSize: 10.5, color: colors.muted, fontWeight: 700, marginBottom: 6 }}>{t("מחוברים עכשיו")} ({onlineCount})</div>
            <div style={{ display: "grid", gap: 4 }}>
              {roster.map((p) => {
                const isOnline = onlineIds.has(p.id);
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: isOnline ? 1 : 0.55 }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: isOnline ? "#4f8f5e" : colors.border,
                    }} />
                    <span>{p.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }} title={`${onlineCount} ${t("מחוברים")}`}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4f8f5e" }} />
          </div>
        )}
      </div>

      <div style={{ padding: 10, borderTop: `1px solid ${colors.border}` }}>
        {sidebarOpen && <div style={{ fontSize: 12.5, color: colors.muted, padding: "0 8px 8px" }}>{profile.name} · {profile.role}</div>}
        <button className="nav-btn" onClick={onLogout} style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
          borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: colors.danger, fontSize: 13.5,
        }}>
          <LogOut size={17} />
          {sidebarOpen && <span>{t("יציאה")}</span>}
        </button>
        {sidebarOpen && (
          <div style={{ fontSize: 10, color: colors.muted, textAlign: "center", padding: "6px 8px 2px" }}>
            © {new Date().getFullYear()} MEXUZ. {t("כל הזכויות שמורות")}.
          </div>
        )}
      </div>
    </div>
  );
}
