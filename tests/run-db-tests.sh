#!/usr/bin/env bash
# Starts a throwaway PostgreSQL 16, runs db.test.sql against the real migration + seed, then removes it.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
D=$(mktemp -d); chmod 755 "$D"; chown postgres "$D"
cp -r supabase tests "$D/"; chown -R postgres "$D"
runuser -u postgres -- bash -c "
  $PGBIN/initdb -D $D/data -A trust >/dev/null &&
  $PGBIN/pg_ctl -D $D/data -o '-p 54399 -k $D' -l $D/log -w start >/dev/null &&
  cd $D && $PGBIN/psql -h $D -p 54399 -U postgres -d postgres -qAt -f tests/db.test.sql 2>&1 | sed -E 's/^psql:[^ ]+ //' | grep -E 'NOTICE|ERROR|FAILED|passed' | sed -E 's/NOTICE:  //' ; 
  $PGBIN/pg_ctl -D $D/data -m immediate stop >/dev/null"
rm -rf "$D"
