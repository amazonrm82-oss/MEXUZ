import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Smile, Paperclip, Pencil, Check, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeList } from "../lib/useTable";
import { colors, panelStyle, inputStyle, buttonGhost } from "../lib/theme";
import { fmtDate } from "../lib/format";
import { canActLikeManager } from "../lib/permissions";
import { EMOJIS } from "../lib/emojis";
import { useLanguage } from "../lib/LanguageContext";
import { useSignedUrl } from "../lib/signedStorageUrl";

const EDIT_WINDOW_MS = 5 * 60 * 1000;
const DELETE_WINDOW_MS = 10 * 60 * 1000;
const TYPING_THROTTLE_MS = 2000;
const TYPING_EXPIRE_MS = 3000;

function chatKeyFor(target, myId) {
  return target === "team" ? "team" : "dm:" + [myId, target].sort().join("|");
}

export default function TeamChatView({ profile, profiles, online }) {
  const { t } = useLanguage();
  const [target, setTarget] = useState("team");
  const { rows: teamMessages } = useRealtimeList("team_messages", { orderBy: "created_at", ascending: true });
  const { rows: directMessages } = useRealtimeList("direct_messages", { orderBy: "created_at", ascending: true });
  const conversationKey = chatKeyFor(target, profile.id);
  const { rows: reads } = useRealtimeList("chat_reads", { filterColumn: "conversation_key", filterValue: conversationKey });

  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [, forceTick] = useState(0);
  const mgr = canActLikeManager(profile);
  const fileInputRef = useRef(null);
  const typingChannelRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const scrollRef = useRef(null);

  const others = profiles.filter((p) => p.id !== profile.id);

  const dmThread = useMemo(() => {
    if (target === "team") return [];
    return directMessages.filter((m) => (m.sender_id === profile.id && m.recipient_id === target) || (m.sender_id === target && m.recipient_id === profile.id));
  }, [directMessages, target, profile.id]);

  const messages = target === "team" ? teamMessages : dmThread;
  const table = target === "team" ? "team_messages" : "direct_messages";

  function nameFor(id) { return profiles.find((p) => p.id === id)?.name || "—"; }

  /* ---- mark conversation read whenever it's open and has messages ---- */
  useEffect(() => {
    if (!messages.length) return;
    supabase.from("chat_reads").upsert({ conversation_key: conversationKey, account_id: profile.id, last_read_at: new Date().toISOString() });
  }, [conversationKey, messages.length, profile.id]);

  const otherRead = target !== "team" ? reads.find((r) => r.account_id === target) : null;
  function isSeen(m) {
    return !!otherRead && new Date(otherRead.last_read_at) >= new Date(m.created_at);
  }

  /* ---- typing broadcast: ephemeral, per-conversation, no DB writes ---- */
  useEffect(() => {
    const channel = supabase.channel(`typing:${conversationKey}`);
    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload.id === profile.id) return;
      setTypingUsers((cur) => ({ ...cur, [payload.id]: { name: payload.name, at: Date.now() } }));
    }).subscribe();
    typingChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); typingChannelRef.current = null; };
  }, [conversationKey, profile.id]);

  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeTypers = Object.values(typingUsers).filter((u) => Date.now() - u.at < TYPING_EXPIRE_MS);

  function reportTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { id: profile.id, name: profile.name } });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  /* ---- sending ---- */
  async function send() {
    if (!text.trim()) return;
    const base = { sender_id: profile.id, text: text.trim() };
    if (table === "direct_messages") base.recipient_id = target;
    await supabase.from(table).insert(base);
    setText("");
    setShowEmoji(false);
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const path = `${conversationKey}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file);
    if (upErr) { alert(t("שגיאה בהעלאת הקובץ")); return; }
    // attachment_url holds the private bucket's object path, not a public link — ChatAttachment
    // resolves it to a short-lived signed URL whenever the message renders.
    const base = {
      sender_id: profile.id, text: text.trim(),
      attachment_url: path, attachment_name: file.name, attachment_type: file.type,
    };
    if (table === "direct_messages") base.recipient_id = target;
    await supabase.from(table).insert(base);
    setText("");
  }

  function insertEmoji(e) {
    setText((cur) => cur + e);
  }

  async function del(id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) alert(t("אפשר למחוק הודעה עד 10 דקות אחרי שנשלחה"));
  }

  function startEdit(m) {
    setEditingId(m.id);
    setEditText(m.text || "");
  }
  async function saveEdit(id) {
    const { error } = await supabase.from(table).update({ text: editText.trim(), edited_at: new Date().toISOString() }).eq("id", id);
    if (error) alert(t("אפשר לערוך הודעה עד 5 דקות אחרי שנשלחה"));
    setEditingId(null);
  }

  return (
    <div className="two-col-responsive" style={{ display: "flex", gap: 16, height: "calc(100vh - 48px)" }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>{t("צ'אט")}</div>
        <button onClick={() => setTarget("team")} style={{ display: "block", width: "100%", textAlign: "right", padding: 8, borderRadius: 8, border: "none", cursor: "pointer", background: target === "team" ? colors.bg : "transparent", marginBottom: 4, fontWeight: target === "team" ? 700 : 400 }}>
          {t("צ'אט צוות")}
        </button>
        {others.map((p) => (
          <button key={p.id} onClick={() => setTarget(p.id)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "right", padding: 8, borderRadius: 8, border: "none", cursor: "pointer", background: target === p.id ? colors.bg : "transparent", marginBottom: 4, fontWeight: target === p.id ? 700 : 400 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: online?.[p.id] ? "#4f8f5e" : colors.border }} />
            {p.name}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", ...panelStyle, marginBottom: 6 }}>
          {messages.map((m) => {
            const mine = m.sender_id === profile.id;
            const isImage = m.attachment_type && m.attachment_type.startsWith("image/");
            const canStillEdit = mine && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;
            const canStillDelete = (mine && Date.now() - new Date(m.created_at).getTime() < DELETE_WINDOW_MS) || mgr;
            return (
              <div key={m.id} style={{ marginBottom: 10, textAlign: mine ? "left" : "right" }}>
                <div style={{
                  display: "inline-block", background: mine ? colors.accent : colors.bg,
                  color: mine ? "#fff" : colors.text, borderRadius: 12, padding: "6px 12px", maxWidth: "72%", textAlign: "right",
                }}>
                  {target === "team" && !mine && <div style={{ fontSize: 11, opacity: .8 }}>{nameFor(m.sender_id)}</div>}

                  {editingId === m.id ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: 5, color: colors.text }} onKeyDown={(e) => e.key === "Enter" && saveEdit(m.id)} />
                      <button onClick={() => saveEdit(m.id)} style={{ border: "none", background: "none", cursor: "pointer", color: mine ? "#fff" : colors.accent }}><Check size={15} /></button>
                      <button onClick={() => setEditingId(null)} style={{ border: "none", background: "none", cursor: "pointer", color: mine ? "#fff" : colors.danger }}><X size={15} /></button>
                    </div>
                  ) : (
                    <>
                      {m.text && <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{m.text}</div>}
                      {m.attachment_url && (
                        <ChatAttachment path={m.attachment_url} name={m.attachment_name} isImage={isImage} />
                      )}
                    </>
                  )}

                  <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>
                    {fmtDate(m.created_at)}{m.edited_at ? ` · ${t("נערך")}` : ""}
                    {mine && target !== "team" && <span> · {isSeen(m) ? t("נראה ✓✓") : t("נשלח ✓")}</span>}
                  </div>
                </div>
                {editingId !== m.id && (mine || canStillDelete) && (
                  <div style={{ display: "flex", gap: 8, justifyContent: mine ? "flex-start" : "flex-end" }}>
                    {mine && canStillEdit && !m.attachment_url && (
                      <button onClick={() => startEdit(m)} style={{ border: "none", background: "none", color: colors.muted, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 2 }}><Pencil size={11} /> {t("ערוך")}</button>
                    )}
                    {canStillDelete && (
                      <button onClick={() => del(m.id)} style={{ border: "none", background: "none", color: colors.danger, cursor: "pointer", fontSize: 11 }}>{t("מחק")}</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {messages.length === 0 && <div style={{ color: colors.muted, fontSize: 13 }}>{t("אין הודעות עדיין")}</div>}
        </div>

        <div style={{ minHeight: 16, fontSize: 11.5, color: colors.muted, marginBottom: 4 }}>
          {activeTypers.length > 0 && `${activeTypers.map((u) => u.name).join(", ")} ${t("מקליד/ה…")}`}
        </div>

        <div style={{ position: "relative", display: "flex", gap: 6, alignItems: "center" }}>
          {showEmoji && (
            <div style={{ position: "absolute", bottom: 44, insetInlineStart: 0, background: "#fff", border: `1px solid ${colors.border}`, borderRadius: 10, padding: 8, display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, boxShadow: "0 4px 16px rgba(0,0,0,.12)", zIndex: 10 }}>
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => insertEmoji(e)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, padding: 2 }}>{e}</button>
              ))}
            </div>
          )}
          <button onClick={() => setShowEmoji((s) => !s)} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted, padding: 6 }}><Smile size={19} /></button>
          <button onClick={() => fileInputRef.current?.click()} style={{ border: "none", background: "none", cursor: "pointer", color: colors.muted, padding: 6 }}><Paperclip size={19} /></button>
          <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileSelect} />
          <input
            style={inputStyle} placeholder={t("הודעה…")} value={text}
            onChange={(e) => { setText(e.target.value); reportTyping(); }}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button onClick={send} style={buttonGhost}>{t("שלח")}</button>
        </div>
      </div>
    </div>
  );
}

// chat-attachments is a private bucket — the stored path only resolves through a short-lived
// signed URL, fetched per-message here (images load it eagerly so they still appear inline;
// other files just link out once the URL comes back).
function ChatAttachment({ path, name, isImage }) {
  const url = useSignedUrl("chat-attachments", path);
  if (isImage) {
    return url ? (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={name} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, marginTop: 4, display: "block" }} />
      </a>
    ) : (
      <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>{name}</div>
    );
  }
  return (
    <a
      href={url || "#"}
      onClick={(e) => { if (!url) e.preventDefault(); }}
      target="_blank" rel="noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, color: "inherit", fontSize: 12.5 }}
    >
      <Paperclip size={13} /> {name}
    </a>
  );
}
