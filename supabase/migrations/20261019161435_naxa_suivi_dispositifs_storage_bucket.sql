-- NAXA — public packshots for the connected-device catalogue.
-- Images are generic illustrations; this bucket contains no personal health data.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispositifs', 'dispositifs', true, 30000, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
