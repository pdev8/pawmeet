-- Optional photo on a place review (uploaded to the public `photos` bucket).
alter table public.place_reviews add column photo_url text;
