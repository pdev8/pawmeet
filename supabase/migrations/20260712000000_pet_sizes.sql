-- More pet sizes: Petite (XS) and X-Large (XL), ordered around the existing S/M/L.
alter type public.pet_size add value if not exists 'XS' before 'S';
alter type public.pet_size add value if not exists 'XL' after 'L';
