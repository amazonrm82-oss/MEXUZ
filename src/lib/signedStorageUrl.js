import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// lead-files and chat-attachments are private buckets (see supabase/migrations/0011_private_storage_buckets.sql)
// — RLS on storage.objects only gates the authenticated API path, so a public bucket would let
// anyone with a link read a file straight from the CDN regardless of role. Every read goes
// through a short-lived signed URL instead, generated on demand.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function getSignedUrl(bucket, path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// For attachments that must render immediately (inline chat images) rather than being resolved
// only when clicked.
export function useSignedUrl(bucket, path) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return undefined;
    getSignedUrl(bucket, path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [bucket, path]);
  return url;
}
