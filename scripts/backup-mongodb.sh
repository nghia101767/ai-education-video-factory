#!/usr/bin/env bash
set -euo pipefail
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
root_user=${MONGO_ROOT_USERNAME:-$(docker compose exec -T mongodb printenv MONGO_INITDB_ROOT_USERNAME)}
root_password=${MONGO_ROOT_PASSWORD:-$(docker compose exec -T mongodb printenv MONGO_INITDB_ROOT_PASSWORD)}
database=${MONGO_DATABASE:-$(docker compose exec -T mongodb printenv MONGO_INITDB_DATABASE)}
archive="backups/mongodb-$stamp.archive"
docker compose exec -T mongodb mongodump --username "$root_user" --password "$root_password" --authenticationDatabase admin --db "$database" --archive > "$archive"
printf '{"database":"%s","createdAt":"%s","archive":"%s"}\n' "$database" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$archive" > "$archive.metadata.json"
printf '%s\n' "$archive"
