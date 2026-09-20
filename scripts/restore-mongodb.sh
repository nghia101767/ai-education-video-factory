#!/usr/bin/env bash
set -euo pipefail
archive=${1:?Usage: scripts/restore-mongodb.sh backups/file.archive}
target_database=${2:?Usage: scripts/restore-mongodb.sh backups/file.archive separate_test_database}
test -f "$archive"
source_database=${MONGO_DATABASE:-$(docker compose exec -T mongodb printenv MONGO_INITDB_DATABASE)}
if [[ "$target_database" == "$source_database" ]]; then echo "Refusing to restore over the active database" >&2; exit 2; fi
if [[ "$target_database" != *_regression_restore_* ]]; then echo "Target must be a clearly named regression restore database" >&2; exit 2; fi
root_user=${MONGO_ROOT_USERNAME:-$(docker compose exec -T mongodb printenv MONGO_INITDB_ROOT_USERNAME)}
root_password=${MONGO_ROOT_PASSWORD:-$(docker compose exec -T mongodb printenv MONGO_INITDB_ROOT_PASSWORD)}
docker compose exec -T mongodb mongorestore --username "$root_user" --password "$root_password" --authenticationDatabase admin --nsFrom "$source_database.*" --nsTo "$target_database.*" --archive < "$archive"
