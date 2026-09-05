-- CivicPulse — stop anonymous enumeration of report photos.
-- Run AFTER 0001_init.sql. Idempotent; safe to re-run.
--
-- THE PROBLEM
-- 0001 created `ticket_photos_public_read`, a SELECT policy on storage.objects
-- granted to the `public` role. That grant is broader than it looks: it does
-- not just permit fetching a photo you already have a link to, it permits the
-- storage LIST operation. Anyone holding the publishable key — which ships in
-- the browser bundle and is therefore not a secret — could ask for every
-- filename in `ticket-photos` and then, because the bucket is public, download
-- each one. Every citizen's report photo, in one request.
--
-- THE FIX
-- Drop that policy. Serving a public bucket does NOT depend on it: a request to
--     /storage/v1/object/public/ticket-photos/<path>
-- is authorised by the bucket's `public` flag and skips RLS entirely, which is
-- what "public bucket" means. What the policy uniquely enabled was listing.
--
-- After this, photo filenames are UUIDs that appear only on a ticket row, and
-- ticket rows are already protected: a citizen reads their own, an admin reads
-- all, nobody else reads any. An unguessable name is not the same as an access
-- control, so see the note at the bottom before this carries sensitive data.

drop policy if exists ticket_photos_public_read on storage.objects;

-- Uploading is unchanged and still requires a signed-in user. Restated here so
-- re-running this file alone leaves the bucket in a working state.
drop policy if exists ticket_photos_auth_write on storage.objects;
create policy ticket_photos_auth_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-photos');

-- Admins may enumerate the bucket — useful for auditing what has been
-- uploaded, and it is the only listing path that remains.
drop policy if exists ticket_photos_admin_list on storage.objects;
create policy ticket_photos_admin_list on storage.objects
  for select to authenticated
  using (bucket_id = 'ticket-photos' and public.is_admin());

-- VERIFY (expect: only the two policies above)
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'ticket_photos%'
order by policyname;

-- NOTE — the stronger option, if report photos ever need to be genuinely
-- private: flip the bucket to `public = false` and serve every image through a
-- short-lived signed URL. That is a real code change, not just a policy one —
-- MediaService would have to mint signed URLs and every <img src> in the app
-- would have to await one — so it is deliberately not done here.
