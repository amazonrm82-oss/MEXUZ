-- Security hardening: lead-files and chat-attachments were "public" buckets, meaning any file
-- URL was fetchable straight from the CDN by anyone who had it — no login, no RLS, completely
-- bypassing the lead-visibility rules (regular rep vs. foreign rep vs. manager) and DM privacy
-- that the rest of the schema enforces. A leaked link (browser history, a forwarded message, a
-- referrer header) was enough to read a file regardless of role.
--
-- Both buckets are now private. The app requests a short-lived signed URL (src/lib/signedStorageUrl.js)
-- each time a file is actually opened instead of storing/reusing a permanent public link.
--
-- NOTE: any file uploaded before this migration has its old public URL stored in the row (lead_files.url
-- / *_messages.attachment_url) — those links stop resolving once the bucket goes private, since a
-- signed URL can only be minted from a real object path, not from an old public URL string. Existing
-- attachments will need re-uploading if they're still needed.

update storage.buckets set public = false where id in ('lead-files', 'chat-attachments');

drop policy if exists lead_files_storage_select on storage.objects;
create policy lead_files_storage_select on storage.objects for select using (
  bucket_id = 'lead-files' and public.lead_is_visible((split_part(name, '/', 1))::uuid)
);

-- Chat attachments: gated to "logged in" rather than per-conversation, same as the coarser
-- team-wide visibility already implied by chat_reads_select — a real per-DM/per-group check
-- would need to parse the conversation key out of the path and join back to direct_messages/
-- chat_group_members, which is more machinery than this pass covers. Still a large improvement
-- over "public to the whole internet".
drop policy if exists chat_attachments_select on storage.objects;
create policy chat_attachments_select on storage.objects for select using (
  bucket_id = 'chat-attachments' and auth.uid() is not null
);
