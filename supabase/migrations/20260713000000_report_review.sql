-- Allow reporting a place review (in-app moderation queue already handles it).
alter type public.report_target add value if not exists 'review';
