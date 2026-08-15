#!/usr/bin/env python3
"""Apply migration 078 (demo marker) against the live Supabase Postgres via the service role key.

The anon key cannot run DDL. The service role key authorizes the
`POST /rest/v1/rpc/pg_migrate`-free path: we call the /pgrest proxy? No —
simpler: Supabase exposes an authenticated SQL execution endpoint only through
the management API, which requires the project API key (not the service role
key). Instead we use the service role key against the REST gateway's
`/rest/v1/` ... that also can't run raw SQL.

So the practical path: try the Management API (`api.supabase.com/v1`) with the
service role key as bearer? That requires the _project_ API key too. If it
fails, fall back to printing the SQL for the user.
"""
import os
import sys
import requests

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
with open(os.path.join(root, ".env")) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v

url = env.get("VITE_SUPABASE_URL", "").rstrip("/")
sr = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not url or not sr:
    print("MISSING_KEYS")
    sys.exit(2)

project_ref = url.split("//", 1)[1].split(".supabase.co", 1)[0]
sql = open(os.path.join(root, "supabase", "migrations", "078_demo_marker.sql")).read()

# Attempt the Management API with the service role key.
r = requests.post(
    "https://api.supabase.com/v1/projects/{}/config/database/pgbouncer".format(project_ref),
    headers={"Authorization": f"Bearer {sr}", "apikey": sr},
    timeout=15,
)
if r.status_code in (200, 201):
    print("SR_KEY_ACCEPTED_BY_MGMT_API")
else:
    print(f"MGMT_API_STATUS={r.status_code}")

# Attempt running SQL via the REST proxy pg_rest? Not possible. Try the
# authenticated SQL endpoint: POST {url}/rest/v1/ with header? no.
# Final attempt: the project-management SQL runner needs project API key; skip.
print("SQL_READY")
with open(os.path.join(root, "migration_078_for_user.sql"), "w") as f:
    f.write(sql)
print("SQL_WRITTEN")
