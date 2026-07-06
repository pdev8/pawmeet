-- New notification kind: a host edited an event's details (in-app; push later).
alter type public.notification_type add value if not exists 'event_updated';
