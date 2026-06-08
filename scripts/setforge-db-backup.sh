#!/usr/bin/env bash
#
# setforge-db-backup.sh — twice-daily MariaDB backup for SetForge (comp_SetForge).
# Runs ON the DB box (CyberPanel/MariaDB) from root's crontab.
#
# Credentials are NOT in this script — they live in a 0600 defaults file so the
# password never appears in `ps`/process list. See INSTALL below.
#
# INSTALL (on the DB box, as root):
#   1) Put this file at /usr/local/bin/setforge-db-backup.sh and make it executable:
#        sudo install -m 755 setforge-db-backup.sh /usr/local/bin/setforge-db-backup.sh
#   2) Create the credentials file (root MySQL login; localhost = socket, no SSL needed):
#        sudo mkdir -p /etc/setforge
#        sudo tee /etc/setforge/db-backup.cnf >/dev/null <<'EOF'
#        [mysqldump]
#        user=root
#        password=YOUR_MYSQL_ROOT_PASSWORD
#        host=localhost
#        EOF
#        sudo chmod 600 /etc/setforge/db-backup.cnf
#   3) Test it once by hand:
#        sudo /usr/local/bin/setforge-db-backup.sh && ls -lh /var/backups/setforge-db
#   4) Add to root's crontab (twice daily — 02:00 and 14:00):
#        sudo crontab -e
#        0 2,14 * * * /usr/local/bin/setforge-db-backup.sh
#
# OFF-BOX COPY: handled by DAILY VM SNAPSHOTS to a separate cloud container. Those
#    snapshots also capture these dumps (they live on the volume), so the last day's
#    dumps are off-box too. The two layers complement each other: snapshot = whole-box
#    DR (daily, crash-consistent); these dumps = 2x/day, transaction-consistent,
#    portable, granular restore. The OFFSITE section below is therefore OPTIONAL —
#    only needed if you want sub-day off-box copies independent of the snapshot.

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
DB_NAME="comp_SetForge"
BACKUP_DIR="/var/backups/setforge-db"
DEFAULTS_FILE="/etc/setforge/db-backup.cnf"   # 0600, holds [mysqldump] creds
RETENTION_DAYS=14                             # delete local dumps older than this
LOG="/var/log/setforge-db-backup.log"
MIN_BYTES=1000                                # sanity floor; a real dump is far bigger

# ── Setup ────────────────────────────────────────────────────────────────────
umask 077                                     # backups + logs not world-readable
mkdir -p "$BACKUP_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
out="${BACKUP_DIR}/${DB_NAME}-${ts}.sql.gz"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }

if [ ! -r "$DEFAULTS_FILE" ]; then
  log "FATAL: defaults file $DEFAULTS_FILE missing/unreadable"
  exit 1
fi

log "backup start -> $out"

# ── Dump ─────────────────────────────────────────────────────────────────────
# --single-transaction: consistent InnoDB snapshot without locking the app out.
# --routines/--triggers/--events: full schema. gzip -9: smallest. pipefail catches
# a mysqldump failure even though it's piped into gzip.
if mysqldump --defaults-extra-file="$DEFAULTS_FILE" \
      --single-transaction --quick --routines --triggers --events \
      --default-character-set=utf8mb4 \
      "$DB_NAME" | gzip -9 > "$out"; then
  size=$(stat -c%s "$out" 2>/dev/null || echo 0)
  if [ "$size" -lt "$MIN_BYTES" ]; then
    log "ERROR: dump too small ($size bytes) — deleting, treating as failure"
    rm -f "$out"
    exit 1
  fi
  log "backup OK ($size bytes)"
else
  log "ERROR: mysqldump failed — deleting partial file"
  rm -f "$out"
  exit 1
fi

# ── Retention (local) ────────────────────────────────────────────────────────
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -print -delete >> "$LOG" 2>&1 || true
log "backup done; pruned local dumps older than ${RETENTION_DAYS}d"

# ── OFFSITE COPY (OPTIONAL — off-box already covered by daily VM snapshots) ────
# Object storage via rclone (configure a remote first: `rclone config`):
#   rclone copy "$out" myremote:setforge-db-backups/ >> "$LOG" 2>&1 \
#     && log "offsite OK -> myremote:setforge-db-backups/$(basename "$out")" \
#     || log "ERROR: offsite copy failed"
#
# Or scp to another host (key-based auth):
#   scp -q "$out" backup@other-host:/srv/setforge-db-backups/ >> "$LOG" 2>&1 \
#     && log "offsite OK -> other-host" || log "ERROR: offsite scp failed"

exit 0
