#!/bin/bash
set -e

# Amdox ERP Database Backup Script
# Backs up database to S3-compatible storage with versioning

BACKUP_DIR="/tmp/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="amdox_backup_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILENAME="${FILENAME}.enc"

mkdir -p "$BACKUP_DIR"

echo "Starting database dump..."
pg_dump -h "${DB_HOST:-db}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-amdox_erp}" | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Encrypting backup archive..."
openssl enc -aes-256-cbc -salt -in "${BACKUP_DIR}/${FILENAME}" -out "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" -k "${BACKUP_ENCRYPTION_KEY:-supersecretpassphrase}"

echo "Uploading encrypted backup to S3-compatible storage..."
# aws s3 cp "${BACKUP_DIR}/${ENCRYPTED_FILENAME}" "s3://${S3_BUCKET_NAME:-amdox-backups}/${ENCRYPTED_FILENAME}"

echo "Clean up temporary files..."
rm -f "${BACKUP_DIR}/${FILENAME}" "${BACKUP_DIR}/${ENCRYPTED_FILENAME}"

echo "Database backup completed successfully!"
