-- CivicPulse — contain what a bad photo can do.
-- Run AFTER 0006_storage_no_listing.sql and 0009_upvotes.sql. Idempotent.
--
-- THE PROBLEM
--   Every uploaded photo was readable by anyone on the internet with no account
--   at all — a plain GET on the storage URL returns the image. And no DELETE
--   policy existed on storage.objects, so nobody, not even an admin, could ever
--   remove one. Rejecting a report changed a status and left the photo public
--   forever. If somebody uploaded something that should not exist, there was no
--   way to take it down.
--
-- WHAT THIS CHANGES
--   1. Admins can delete a photo, so rejecting a report can actually remove it.
--   2. The public feed stops publishing photos of reports no human has looked
--      at yet. An unreviewed photo is no longer displayed anywhere public.
--
-- WHAT THIS DOES NOT CHANGE
--   The bucket is still public, so a photo remains fetchable by anyone holding
--   its exact URL. Closing that needs a private bucket and signed URLs on every
--   image in the app — a larger change, noted at the bottom. What this migration
--   does is remove every way to *discover* such a URL and make deletion possible.

-- ---------------------------------------------------------------------------
-- 1. Let the desk delete a photo
-- ---------------------------------------------------------------------------

drop policy if exists ticket_photos_admin_delete on storage.objects;
create policy ticket_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ticket-photos' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Do not publish a photo nobody has reviewed
-- ---------------------------------------------------------------------------
/**
 * The public feed, with one change: `image_url` is null until a human at the
 * ward desk has moved the report out of 'Submitted'.
 *
 * The report itself still appears — category, ward, description, status and
 * upvote count — so the community can still say "I have this too" while it is
 * being reviewed. Only the unreviewed photograph is withheld.
 *
 * `photo_pending` lets the app draw an honest placeholder rather than a broken
 * image, so the reader knows the photo exists and is being checked.
 *
 * The reporter and the ward desk both keep full access through the underlying
 * table; this view is only what the public sees.
 */
-- Dropped rather than replaced: CREATE OR REPLACE VIEW can only append columns,
-- and `photo_pending` belongs next to the image_url it explains rather than
-- tacked on the end. Nothing depends on this view, so dropping it is safe.
drop view if exists public.public_tickets;

create view public.public_tickets as
select
  t.id,
  t.ticket_number,
  t.created_at,
  t.category,
  t.description,
  t.urgency,
  t.latitude,
  t.longitude,
  t.ward_location,
  case when t.status in ('In Progress', 'Resolved') then t.image_url end as image_url,
  (t.status = 'Submitted')                                               as photo_pending,
  t.status,
  t.upvote_count,
  t.user_name
from public.grievance_tickets t
where t.status <> 'Rejected';

grant select on public.public_tickets to anon, authenticated;

-- VERIFY — expect image_url to be null for every Submitted row.
select ticket_number, status, (image_url is null) as photo_withheld, photo_pending
from public.public_tickets
order by created_at desc
limit 10;

-- ---------------------------------------------------------------------------
-- NEXT STEP, when it is worth the work
-- ---------------------------------------------------------------------------
-- To make photos genuinely non-public rather than merely undiscoverable:
--   update storage.buckets set public = false where id = 'ticket-photos';
-- and then serve every image through supabase.storage.createSignedUrl(). That
-- touches MediaService and every <img> in the app, which is why it is not done
-- here — but it is the only thing that makes an uploaded photo unreachable to
-- someone who already has the link.
