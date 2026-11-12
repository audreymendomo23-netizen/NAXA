-- NAXA Security phase 5 — indexes couvrant les clés étrangères des candidats ONVIF.
-- Migration idempotente : elle peut être rejouée dans les lots racines et horodatés.

create index if not exists naxa_security_discovery_reviewed_by_idx
  on public.naxa_security_camera_discovery_candidates (reviewed_by);

create index if not exists naxa_security_discovery_camera_fk_idx
  on public.naxa_security_camera_discovery_candidates (camera_id, pharmacie_id);

create index if not exists naxa_security_discovery_gateway_fk_idx
  on public.naxa_security_camera_discovery_candidates (gateway_id, pharmacie_id);
