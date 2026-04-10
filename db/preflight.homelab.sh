set -eu

reject_placeholder_password() {
  env_var_name="$1"
  env_var_value="$2"

  case "$env_var_value" in
    "<replace-with-rds-password>" | "replace-with-rds-password" | "change-this-db-password" | "changeme" | "password")
      echo "$env_var_name must be replaced before first homelab boot" >&2
      exit 1
      ;;
  esac
}

if [ "$DB_USER" = "$POSTGRES_USER" ]; then
  echo "DB_USER must differ from POSTGRES_USER in the homelab deployment" >&2
  exit 1
fi

reject_placeholder_password "DB_PASSWORD" "$DB_PASSWORD"
reject_placeholder_password "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"

if [ "$#" -eq 0 ]; then
set -- postgres
fi

exec docker-entrypoint.sh "$@"
