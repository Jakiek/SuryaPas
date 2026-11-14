-- Row-level security on every table, with no policies (SPEC 4).
--
-- With security on and no policy, the public "anon" and "authenticated" API
-- roles can read and write nothing. Only the server, using the service-role
-- key (which bypasses row-level security), reaches the data. That key never
-- leaves server code. Add a policy here only when a stage needs one, and say
-- why in the migration.

alter table profiles        enable row level security;
alter table assumption_sets enable row level security;
alter table assessments     enable row level security;
alter table sun_cache       enable row level security;
alter table events          enable row level security;
alter table installers      enable row level security;
alter table quote_requests  enable row level security;
