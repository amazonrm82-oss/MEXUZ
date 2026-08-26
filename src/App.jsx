import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { LanguageProvider, useLanguage } from "./lib/LanguageContext";
import { supabase } from "./lib/supabaseClient";
import { useRealtimeList } from "./lib/useTable";
import { useCatalog } from "./lib/useCatalog";
import { useLeadActions } from "./lib/leadActions";
import { usePresence } from "./lib/usePresence";
import { useTaskAlerts } from "./lib/useTaskAlerts";
import { useIdleLogout } from "./lib/useIdleLogout";
import { canActLikeManager, isLeadVisibleForUser } from "./lib/permissions";
import { TWO_WEEKS_MS, UNCLAIMED_ALERT_MS } from "./lib/constants";
import { Menu } from "lucide-react";
import LoginScreen from "./components/LoginScreen";
import MfaChallengeScreen from "./components/MfaChallengeScreen";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";
import NewTasksModal from "./components/NewTasksModal";
import FollowUpPopup from "./components/FollowUpPopup";
import ManagerNotesModal from "./components/ManagerNotesModal";
import { colors } from "./lib/theme";

import InboxView from "./views/InboxView";
import MyDealsView from "./views/MyDealsView";
import AddLeadView from "./views/AddLeadView";
import CalcView from "./views/CalcView";
import ImportView from "./views/ImportView";
import OpsView from "./views/OpsView";
import DashboardView from "./views/DashboardView";
import CustomersView from "./views/CustomersView";
import NotificationsView from "./views/NotificationsView";
import PaymentDuesView from "./views/PaymentDuesView";
import SuppliersView from "./views/SuppliersView";
import CalendarView from "./views/CalendarView";
import HistoryView from "./views/HistoryView";
import CanceledView from "./views/CanceledView";
import SettingsView from "./views/SettingsView";
import TeamChatView from "./views/TeamChatView";
import DownloadView from "./views/DownloadView";
import ReportsView from "./views/ReportsView";
import MyReportsView from "./views/MyReportsView";
import TasksView from "./views/TasksView";
import NotInterestedView from "./views/NotInterestedView";
import AnnouncementsView from "./views/AnnouncementsView";
import OurSystemsView from "./views/OurSystemsView";
import SupportTicketsView from "./views/SupportTicketsView";
import ManagerAlertsView from "./views/ManagerAlertsView";
import CustomTabView from "./views/CustomTabView";
import LeadDrawer from "./views/LeadDrawer";

const DEFAULT_NAV_LABELS = {
  inbox: "תיבת לידים", myDeals: "הפרויקטים שלי", add: "הוספת ליד", calc: "מחשבון הצעת מחיר", import: "ייבוא לידים",
  ops: "תפעול", dashboard: "ביצועים", customers: "לקוחות", notifications: "התראות", paymentDues: "חייבים בתשלום",
  suppliers: "ספקים וקבלני משנה", calendar: "יומן", history: "היסטוריה", canceled: "לידים שבוטלו", settings: "הגדרות",
  teamChat: "צ'אט צוות", download: "הורדה למכשיר", reports: "דוחות תקופתיים", myReports: "הדוח שלי",
  tasks: "משימות ותזכורות", notInterested: "לא מעוניינים", home: "לוח מודעות", ourSystems: "המערכות שלנו",
  supportTickets: "פניות תמיכה", managerAlerts: "התראות למנהל",
};

export default function App() {
  return (
    <AuthProvider>
      <LanguageProviderWrapper>
        <Root />
      </LanguageProviderWrapper>
    </AuthProvider>
  );
}

function LanguageProviderWrapper({ children }) {
  const { profile } = useAuth();
  return <LanguageProvider profile={profile}>{children}</LanguageProvider>;
}

function Root() {
  const { session, profile, loading, mfaRequired } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.header, color: "#fff", fontFamily: "sans-serif" }}>
        {t("טוען…")}
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  if (mfaRequired) return <MfaChallengeScreen />;
  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.bg, fontFamily: "sans-serif", padding: 24, textAlign: "center" }}>
        {t("החשבון מחובר אך אין לו פרופיל במערכת. יש לפנות למנהל כדי שייצור עבורך משתמש.")}
      </div>
    );
  }
  return <MainApp profile={profile} />;
}

function MainApp({ profile }) {
  const { logout } = useAuth();
  const { t, tStatus } = useLanguage();
  useIdleLogout(logout);

  const [view, setViewRaw] = useState("home");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 820);
  const [toast, setToast] = useState(null);
  const [seenTick, setSeenTick] = useState(0);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const { rows: allLeads, loading: leadsLoading } = useRealtimeList("leads", { orderBy: "received_at", ascending: false });
  const { rows: profiles } = useRealtimeList("profiles", { orderBy: "name", ascending: true });
  const { rows: customTabs } = useRealtimeList("custom_tabs", { orderBy: "sort_order", ascending: true });
  const { rows: settingsRows } = useRealtimeList("app_settings", { orderBy: "key", ascending: true });
  const { rows: teamMessages } = useRealtimeList("team_messages", { orderBy: "created_at", ascending: false });
  const { rows: directMessages } = useRealtimeList("direct_messages", { orderBy: "created_at", ascending: false });
  const { rows: tasks } = useRealtimeList("tasks", { orderBy: "due_at", ascending: true });
  const catalog = useCatalog();
  const actions = useLeadActions(showToast, profile);
  const online = usePresence(profile);
  const { newAssignedTasks } = useTaskAlerts(tasks, profile, showToast);

  /* ---- "seen" tracking per nav tab (localStorage, per-browser) — drives unread badges ---- */
  const lastSeenFor = useCallback((key) => Number(localStorage.getItem(`crm-seen:${profile.id}:${key}`) || 0), [profile.id]);
  const setView = useCallback((key) => {
    localStorage.setItem(`crm-seen:${profile.id}:${key}`, String(Date.now()));
    setSeenTick((v) => v + 1);
    setViewRaw(key);
  }, [profile.id]);

  const navLabels = useMemo(() => {
    const row = settingsRows.find((s) => s.key === "nav_labels");
    return { ...DEFAULT_NAV_LABELS, ...(row ? row.value : {}) };
  }, [settingsRows]);

  const googleCalendarEmbedUrl = useMemo(() => {
    const row = settingsRows.find((s) => s.key === "google_calendar_embed_url");
    return row?.value || "";
  }, [settingsRows]);

  const leads = useMemo(() => allLeads.filter((l) => isLeadVisibleForUser(l, profile)), [allLeads, profile]);
  const selectedLead = useMemo(() => allLeads.find((l) => l.id === selectedLeadId) || null, [allLeads, selectedLeadId]);

  /* ---- manager-flagged notes: pop up for every manager/deputy on login, and again the moment a
     new one is flagged while the app is open, until each one is actually marked handled ---- */
  const { rows: flaggedNotes } = useRealtimeList("lead_notes", { filterColumn: "flagged_for_manager", filterValue: true, orderBy: "created_at", ascending: true });
  const unresolvedManagerNotes = useMemo(() => flaggedNotes.filter((n) => !n.resolved), [flaggedNotes]);
  const [managerNotesClosed, setManagerNotesClosed] = useState(false);
  const seenNoteIdsRef = useRef(new Set());
  useEffect(() => {
    const hasNewOne = unresolvedManagerNotes.some((n) => !seenNoteIdsRef.current.has(n.id));
    if (hasNewOne) setManagerNotesClosed(false);
    seenNoteIdsRef.current = new Set(unresolvedManagerNotes.map((n) => n.id));
  }, [unresolvedManagerNotes]);

  /* ---- follow-up popup: once per login, if the user has leads sitting in "פולואפ" ---- */
  const [followUpPopupOpen, setFollowUpPopupOpen] = useState(false);
  const followUpShownRef = useRef(false);
  const myFollowUpLeads = useMemo(
    () => leads.filter((l) => l.claimed_by === profile.id && l.process_status === "פולואפ" && !l.closed_at && !l.canceled && !l.archived),
    [leads, profile.id]
  );
  useEffect(() => {
    if (!leadsLoading && !followUpShownRef.current) {
      followUpShownRef.current = true;
      if (myFollowUpLeads.length > 0) setFollowUpPopupOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadsLoading]);

  const badges = useMemo(() => {
    const b = {};
    const mine = leads.filter((l) => l.claimed_by === profile.id && !l.closed_at && !l.canceled && !l.archived && l.process_status !== "לא מעוניין").length;
    if (mine > 0) b.inbox = mine;

    if (canActLikeManager(profile)) {
      const seenAt = lastSeenFor("notifications");
      const pendingNew = leads.filter((l) => l.pending_approval && l.closed_at && new Date(l.closed_at).getTime() > seenAt).length;
      const lateNew = leads.filter((l) => l.owes_payment && l.unpaid_since && Date.now() - new Date(l.unpaid_since).getTime() > TWO_WEEKS_MS && new Date(l.unpaid_since).getTime() > seenAt).length;
      const unclaimedNew = leads.filter((l) => !l.claimed_by && !l.canceled && !l.archived && !l.closed_at && Date.now() - new Date(l.received_at).getTime() > UNCLAIMED_ALERT_MS && new Date(l.received_at).getTime() > seenAt).length;
      const n = pendingNew + lateNew + unclaimedNew;
      if (n > 0) b.notifications = n;
      if (unresolvedManagerNotes.length > 0) b.managerAlerts = unresolvedManagerNotes.length;
    }

    const chatSeenAt = lastSeenFor("teamChat");
    const unreadTeam = teamMessages.filter((m) => m.sender_id !== profile.id && new Date(m.created_at).getTime() > chatSeenAt).length;
    const unreadDirect = directMessages.filter((m) => m.recipient_id === profile.id && new Date(m.created_at).getTime() > chatSeenAt).length;
    const chatCount = unreadTeam + unreadDirect;
    if (chatCount > 0) b.teamChat = chatCount;

    const overdueTasks = tasks.filter((t) => t.owner_id === profile.id && !t.completed && new Date(t.due_at).getTime() < Date.now()).length;
    if (overdueTasks > 0) b.tasks = overdueTasks;

    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, teamMessages, directMessages, tasks, profile, seenTick, unresolvedManagerNotes]);

  function openLead(id) { setSelectedLeadId(id); }
  function closeDrawer() { setSelectedLeadId(null); }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const commonProps = {
    profile, profiles, leads, allLeads, catalog, actions, showToast, openLead, view, setView, online, tasks, t, tStatus,
    googleCalendarEmbedUrl, flaggedNotes,
  };

  return (
    <div className="app-shell" style={{ display: "flex", minHeight: "100vh", background: colors.bg, fontFamily: "sans-serif", color: colors.text }}>
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(true)}
        style={{
          alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%",
          border: "none", background: colors.header, color: "#fff", cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,.2)",
        }}
      >
        <Menu size={20} />
      </button>

      <div
        className={`sidebar-backdrop ${sidebarOpen ? "sidebar-backdrop-visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        profile={profile} profiles={profiles} online={online} badges={badges} view={view} setView={setView} navLabels={navLabels} customTabs={customTabs}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onLogout={handleLogout} leads={leads} openLead={openLead} t={t}
      />
      <div className="app-main-content" style={{ flex: 1, minWidth: 0, padding: 24 }}>
        {leadsLoading ? (
          <div>{t("טוען נתונים…")}</div>
        ) : (
          <ViewRouter view={view} navLabels={navLabels} customTabs={customTabs} {...commonProps} />
        )}
      </div>

      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          profile={profile}
          profiles={profiles}
          catalog={catalog}
          actions={actions}
          showToast={showToast}
          onClose={closeDrawer}
          t={t}
          tStatus={tStatus}
          readOnly={
            !canActLikeManager(profile) && (
              !!selectedLead.archived ||
              (!!selectedLead.claimed_by && selectedLead.claimed_by !== profile.id)
            )
          }
        />
      )}

      {newAssignedTasks.length > 0 && (
        <NewTasksModal tasks={newAssignedTasks} profiles={profiles} onClose={() => {}} />
      )}

      {followUpPopupOpen && (
        <FollowUpPopup leads={myFollowUpLeads} onOpenLead={openLead} onClose={() => setFollowUpPopupOpen(false)} />
      )}

      {canActLikeManager(profile) && unresolvedManagerNotes.length > 0 && !managerNotesClosed && (
        <ManagerNotesModal
          notes={unresolvedManagerNotes} leads={allLeads} profiles={profiles} profile={profile}
          openLead={openLead} onClose={() => setManagerNotesClosed(true)}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}

function ViewRouter(props) {
  const { view, navLabels, customTabs } = props;
  if (view === "inbox") return <InboxView {...props} />;
  if (view === "myDeals") return <MyDealsView {...props} />;
  if (view === "add") return <AddLeadView {...props} />;
  if (view === "calc") return <CalcView {...props} />;
  if (view === "import") return <ImportView {...props} />;
  if (view === "ops") return <OpsView {...props} />;
  if (view === "dashboard") return <DashboardView {...props} />;
  if (view === "customers") return <CustomersView {...props} />;
  if (view === "notifications") return <NotificationsView {...props} />;
  if (view === "paymentDues") return <PaymentDuesView {...props} />;
  if (view === "suppliers") return <SuppliersView {...props} />;
  if (view === "calendar") return <CalendarView {...props} />;
  if (view === "history") return <HistoryView {...props} />;
  if (view === "canceled") return <CanceledView {...props} />;
  if (view === "settings") return <SettingsView {...props} navLabels={navLabels} />;
  if (view === "teamChat") return <TeamChatView {...props} />;
  if (view === "download") return <DownloadView {...props} />;
  if (view === "reports") return <ReportsView {...props} />;
  if (view === "myReports") return <MyReportsView {...props} />;
  if (view === "tasks") return <TasksView {...props} />;
  if (view === "notInterested") return <NotInterestedView {...props} />;
  if (view === "home") return <AnnouncementsView {...props} />;
  if (view === "ourSystems") return <OurSystemsView {...props} />;
  if (view === "supportTickets") return <SupportTicketsView {...props} />;
  if (view === "managerAlerts") return <ManagerAlertsView {...props} />;
  if (view.startsWith("custom:")) {
    const tab = customTabs.find((t) => "custom:" + t.id === view);
    return <CustomTabView tab={tab} />;
  }
  return null;
}
