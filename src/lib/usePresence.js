import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Who's online right now, via Supabase Realtime Presence — no heartbeat polling needed like the
// old app's crm-presence-v1 blob; the socket itself tracks connect/disconnect, so a closed tab
// or lost connection removes the user automatically within seconds.
export function usePresence(profile) {
  const [online, setOnline] = useState({});

  useEffect(() => {
    if (!profile) { setOnline({}); return; }
    const channel = supabase.channel("online-users", { config: { presence: { key: profile.id } } });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const flat = {};
        Object.entries(state).forEach(([key, metas]) => { flat[key] = metas[0]; });
        setOnline(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ id: profile.id, name: profile.name, role: profile.role, online_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  return online; // { [profileId]: { id, name, role, online_at } }
}
