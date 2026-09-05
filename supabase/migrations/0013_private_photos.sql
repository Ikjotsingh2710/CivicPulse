-- CivicPulse — make report photos genuinely private.
-- Run AFTER 0012_photo_containment.sql. Idempotent, but see the WARNING below.
--
-- WHAT WAS STILL WRONG AFTER 0012
--   0012 removed every way to *discover* a photo's URL and made deletion
--   possible. It did not stop a photo being fetchable by anyone who already had
--   the link, because the bucket was still public and a public bucket serves
--   files without consulting RLS at all. That is obscurity, not access control:
--   a link pasted into a group chat stayed live for ever.
--
-- WHAT THIS DOES
--   Flips the bucket to private, so every read goes through a policy, and makes
--   that policy depend on the report the photo belongs to:
--
--     · approved reports  → anyone, signed in or not
--     · your own report   → you, at any status
--     · every report      → the ward desk
--     · rejected reports  → nobody (and 0012 deletes the file anyway)
--
--   An unreviewed or rejected photo is now unreachable even with the exact URL.
--
-- WARNING — RUN THIS TOGETHER WITH THE MATCHING DEPLOY
--   Storage paths replace full public URLs in image_url. The old app build
--   cannot read the new values and the new build cannot read the old ones, so
--   run this and push the frontend in the same sitting.

-- ---------------------------------------------------------------------------
-- 1. Store the path, not the URL
-- ---------------------------------------------------------------------------
-- A signed URL is minted from an object's path, and a stored public URL cannot
-- be signed. Existing rows are rewritten from
--   https://<ref>.supabase.co/storage/v1/object/public/ticket-photos/reports/x.jpg
-- to
--   reports/x.jpg
-- Cloudinary URLs are left alone: they are not ours to sign, and the app keeps
-- treating anything starting with http as an absolute address.

update public.grievance_tickets
   set image_url = regexp_replace(image_url, '^https?://.*/object/public/ticket-photos/', '')
 where image_url like '%/object/public/ticket-photos/%';

update public.grievance_tickets
   set resolution_image_url =
       regexp_replace(resolution_image_url, '^https?://.*/object/public/ticket-photos/', '')
 where resolution_image_url like '%/object/public/ticket-photos/%';

-- The read policy below looks photos up by path on every access.
create index if not exists grievance_tickets_image_url_idx
  on public.grievance_tickets (image_url);
create index if not exists grievance_tickets_resolution_url_idx
  on public.grievance_tickets (resolution_image_url);

-- ---------------------------------------------------------------------------
-- 2. Close the bucket
-- ---------------------------------------------------------------------------

update storage.buckets set public = false where id = 'ticket-photos';

-- ---------------------------------------------------------------------------
-- 3. One policy, tied to the report
-- ---------------------------------------------------------------------------
/**
 * Who may read a photo is decided by the report it belongs to, not by the file.
 *
 * That is the whole point: a photograph's visibility should follow the thing it
 * documents. A report nobody has reviewed is not public, so neither is its
 * photo — and no URL, however it was obtained, changes that.
 *
 * `name` is the object's path, which is exactly what image_url now stores.
 */
drop policy if exists ticket_photos_public_read on storage.objects;
drop policy if exists ticket_photos_admin_list on storage.objects;
drop policy if exists ticket_photos_read on storage.objects;

create policy ticket_photos_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'ticket-photos'
    and exists (
      select 1
      from public.grievance_tickets t
      where (t.image_url = name or t.resolution_image_url = name)
        and (
          -- Reviewed and still standing: this is what the public feed shows.
          t.status in ('In Progress', 'Resolved')
          -- Your own report, whatever state it is in.
          or t.user_phone = public.current_phone()
          -- The desk, which has to see a photo in order to judge it.
          or public.is_admin()
        )
    )
  );

-- Uploading and deleting are unchanged; restated so this file leaves the bucket
-- in a working state on its own.
drop policy if exists ticket_photos_auth_write on storage.objects;
create policy ticket_photos_auth_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-photos');

drop policy if exists ticket_photos_admin_delete on storage.objects;
create policy ticket_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ticket-photos' and public.is_admin());

-- ---------------------------------------------------------------------------
-- VERIFY
-- ---------------------------------------------------------------------------
-- Expect: public = false, and image_url values that are bare paths.
select
  (select public from storage.buckets where id = 'ticket-photos') as bucket_public,
  (select count(*) from public.grievance_tickets
    where image_url like 'http%')                                 as still_absolute_urls,
  (select count(*) from public.grievance_tickets
    where image_url is not null and image_url not like 'http%')   as stored_as_paths;
