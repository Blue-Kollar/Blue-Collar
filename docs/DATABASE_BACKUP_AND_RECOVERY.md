# Database Backup and Recovery Guide

This guide covers automated backup and restore procedures for PostgreSQL in BlueCollar.

## Architecture

```
PostgreSQL Database
      ↓
  pg_dump (daily)
      ↓
  Backup Storage (S3/Local)
      ↓
  Backup Verification
      ↓
  Retention Policy (30 days)
```

## 1. Backup Strategy

### 1.1 Backup Types

- **Full Backups**: Complete database dump (daily at 2 AM UTC)
- **WAL Archiving**: Write-Ahead Logs for point-in-time recovery
- **Incremental**: Only changed data (optional, for large databases)

### 1.2 Retention Policy

- Full backups: 30 days
- WAL archives: 7 days
- Test restores: Weekly

## 2. Automated Backup Script

Create `deploy/scripts/backup-database.sh`:

```bash
#!/bin/bash

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/postgresql}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bluecollar}"
DB_USER="${DB_USER:-bluecollar}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/bluecollar_${TIMESTAMP}.sql.gz"
BACKUP_LOG="$BACKUP_DIR/backup_${TIMESTAMP}.log"

echo "Starting backup at $(date)" | tee "$BACKUP_LOG"

# Perform backup
if pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --verbose \
  --no-password \
  2>> "$BACKUP_LOG" | gzip > "$BACKUP_FILE"; then

  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup completed successfully: $BACKUP_FILE ($BACKUP_SIZE)" | tee -a "$BACKUP_LOG"

  # Upload to S3 if configured
  if [ -n "$S3_BUCKET" ]; then
    echo "Uploading to S3..." | tee -a "$BACKUP_LOG"
    aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/backups/" \
      --region "$AWS_REGION" \
      --sse AES256 \
      2>> "$BACKUP_LOG"
    echo "S3 upload completed" | tee -a "$BACKUP_LOG"
  fi

  # Clean up old backups
  echo "Cleaning up backups older than $RETENTION_DAYS days" | tee -a "$BACKUP_LOG"
  find "$BACKUP_DIR" -name "bluecollar_*.sql.gz" -mtime +$RETENTION_DAYS -delete

  echo "Backup process finished at $(date)" | tee -a "$BACKUP_LOG"
  exit 0
else
  echo "Backup failed!" | tee -a "$BACKUP_LOG"
  exit 1
fi
```

## 3. Backup Verification Script

Create `deploy/scripts/verify-backup.sh`:

```bash
#!/bin/bash

set -e

# Configuration
BACKUP_FILE="${1:?Backup file required}"
VERIFY_DB="${VERIFY_DB:-bluecollar_verify}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-bluecollar}"

echo "Verifying backup: $BACKUP_FILE"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Check file integrity
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "Error: Backup file is corrupted"
  exit 1
fi

echo "Backup file integrity: OK"

# Create temporary database for verification
echo "Creating temporary verification database..."
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$VERIFY_DB" 2>/dev/null || true

# Restore backup to temporary database
echo "Restoring backup to temporary database..."
if gunzip -c "$BACKUP_FILE" | psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$VERIFY_DB" \
  > /dev/null 2>&1; then

  echo "Backup restoration: OK"

  # Verify database integrity
  echo "Verifying database integrity..."
  TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$VERIFY_DB" \
    -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")

  if [ "$TABLES" -gt 0 ]; then
    echo "Database integrity: OK (found $TABLES tables)"
  else
    echo "Error: No tables found in restored database"
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$VERIFY_DB"
    exit 1
  fi

  # Clean up
  echo "Cleaning up temporary database..."
  dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$VERIFY_DB"

  echo "Backup verification: PASSED"
  exit 0
else
  echo "Error: Failed to restore backup"
  dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$VERIFY_DB" 2>/dev/null || true
  exit 1
fi
```

## 4. Restore Procedure

Create `deploy/scripts/restore-database.sh`:

```bash
#!/bin/bash

set -e

# Configuration
BACKUP_FILE="${1:?Backup file required}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bluecollar}"
DB_USER="${DB_USER:-bluecollar}"

echo "WARNING: This will restore the database from backup: $BACKUP_FILE"
echo "Current data will be lost. Continue? (yes/no)"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled"
  exit 0
fi

echo "Starting restore at $(date)"

# Drop existing database
echo "Dropping existing database..."
dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true

# Create new database
echo "Creating new database..."
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"

# Restore from backup
echo "Restoring from backup..."
if gunzip -c "$BACKUP_FILE" | psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME"; then

  echo "Restore completed successfully at $(date)"
  exit 0
else
  echo "Restore failed!"
  exit 1
fi
```

## 5. Docker Compose Integration

Add backup service to `docker-compose.prod.example.yml`:

```yaml
backup:
  image: postgres:16-alpine
  restart: unless-stopped
  depends_on:
    - db
  environment:
    PGPASSWORD: ${POSTGRES_PASSWORD:-change-me}
    DB_HOST: db
    DB_PORT: 5432
    DB_NAME: ${POSTGRES_DB:-bluecollar}
    DB_USER: ${POSTGRES_USER:-bluecollar}
    BACKUP_DIR: /backups
    RETENTION_DAYS: 30
    S3_BUCKET: ${BACKUP_S3_BUCKET:-}
    AWS_REGION: ${AWS_REGION:-us-east-1}
  volumes:
    - ./deploy/scripts/backup-database.sh:/usr/local/bin/backup-database.sh:ro
    - ./deploy/scripts/verify-backup.sh:/usr/local/bin/verify-backup.sh:ro
    - ./deploy/scripts/restore-database.sh:/usr/local/bin/restore-database.sh:ro
    - backups:/backups
  entrypoint: |
    sh -c "
    apk add --no-cache aws-cli
    chmod +x /usr/local/bin/*.sh
    while true; do
      /usr/local/bin/backup-database.sh
      /usr/local/bin/verify-backup.sh /backups/bluecollar_*.sql.gz | tail -1
      sleep 86400
    done
    "
  networks:
    - internal
  logging:
    driver: json-file
    options:
      max-size: '10m'
      max-file: '5'
```

## 6. Cron Job Setup (Alternative)

For non-Docker environments, add to crontab:

```bash
# Daily backup at 2 AM UTC
0 2 * * * /usr/local/bin/backup-database.sh >> /var/log/bluecollar-backup.log 2>&1

# Weekly verification on Sunday at 3 AM UTC
0 3 * * 0 /usr/local/bin/verify-backup.sh /backups/bluecollar_*.sql.gz >> /var/log/bluecollar-verify.log 2>&1
```

## 7. Backup Monitoring

Create `deploy/scripts/backup-status.sh`:

```bash
#!/bin/bash

BACKUP_DIR="${BACKUP_DIR:-/backups/postgresql}"

echo "=== Backup Status Report ==="
echo "Generated: $(date)"
echo ""

echo "Recent backups:"
ls -lh "$BACKUP_DIR"/bluecollar_*.sql.gz 2>/dev/null | tail -5 || echo "No backups found"

echo ""
echo "Backup statistics:"
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "bluecollar_*.sql.gz" 2>/dev/null | wc -l)

echo "Total backups: $BACKUP_COUNT"
echo "Total size: $TOTAL_SIZE"

echo ""
echo "Oldest backup:"
ls -lh "$BACKUP_DIR"/bluecollar_*.sql.gz 2>/dev/null | head -1 || echo "No backups found"

echo ""
echo "Newest backup:"
ls -lh "$BACKUP_DIR"/bluecollar_*.sql.gz 2>/dev/null | tail -1 || echo "No backups found"
```

## 8. Point-in-Time Recovery (PITR)

### 8.1 Enable WAL Archiving

Update PostgreSQL configuration:

```sql
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'test ! -f /backups/wal/%f && cp %p /backups/wal/%f';
```

### 8.2 PITR Restore

```bash
#!/bin/bash

BACKUP_FILE="${1:?Backup file required}"
TARGET_TIME="${2:?Target time required (YYYY-MM-DD HH:MM:SS)}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-bluecollar}"
DB_USER="${DB_USER:-bluecollar}"

echo "Restoring to point-in-time: $TARGET_TIME"

# Restore base backup
gunzip -c "$BACKUP_FILE" | psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME"

# Create recovery.conf for PITR
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /backups/wal/%f %p'
recovery_target_timeline = 'latest'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
EOF

# Restart PostgreSQL to apply recovery
systemctl restart postgresql
```

## 9. Backup Retention Policy

- **Full backups**: 30 days (daily)
- **WAL archives**: 7 days
- **Test restores**: Weekly
- **Off-site copies**: Monthly to S3

## 10. Disaster Recovery Checklist

- [ ] Backup scripts are executable
- [ ] Backup directory has sufficient space
- [ ] S3 bucket is configured (if using cloud storage)
- [ ] Verification tests pass weekly
- [ ] Restore procedure is documented
- [ ] Team is trained on restore procedures
- [ ] Backup logs are monitored
- [ ] Retention policies are enforced

---

## 11. Automated CI/CD Backups (GitHub Actions)

Backups are fully automated via `.github/workflows/DB_BACKUPS.yml` (closes #797).

### Schedule

| Job             | Cron        | Description                               |
| --------------- | ----------- | ----------------------------------------- |
| `backup`        | `0 2 * * *` | Daily encrypted backup → S3               |
| `restore-drill` | `0 3 * * 0` | Weekly restore-to-scratch integrity drill |

Both jobs can also be triggered manually via `workflow_dispatch`.

### Scripts

| Script                            | Purpose                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `deploy/backups/backup.sh`        | `pg_dump` → gzip → GPG-encrypt → S3 upload → retention prune |
| `deploy/backups/restore-drill.sh` | Decrypt → restore to temp DB → count tables → teardown       |

### Required GitHub Secrets

| Secret                  | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `DB_PASSWORD`           | PostgreSQL password                                         |
| `BACKUP_GPG_PASSPHRASE` | Symmetric GPG passphrase for encryption at rest             |
| `BACKUP_S3_BUCKET`      | S3 bucket name (optional — artifact fallback used if unset) |
| `AWS_ACCESS_KEY_ID`     | AWS key (required if S3 bucket is set)                      |
| `AWS_SECRET_ACCESS_KEY` | AWS secret (required if S3 bucket is set)                   |
| `AWS_REGION`            | AWS region (default: `us-east-1`)                           |

### Failure Alerting

Both jobs automatically open a GitHub Issue labelled `devops, reliability` if they fail,
ensuring on-call engineers are notified without requiring external tooling.
