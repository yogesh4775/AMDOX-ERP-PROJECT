#!/bin/bash
set -e

# Amdox ERP Database Restore Script
# Downloads and restores an encrypted database dump from S3

if [ -z "$1" ]; then
  echo "Usage: $0 <s3_backup_filename>"
  exit 1
fi

S3_FILENAME="$1"
DOWNLOAD_DIR="/tmp/restores"
DECRYPTED_FILENAME="decrypted_backup.sql.gz"

mkdir -p "$DOWNLOAD_DIR"

echo "Downloading encrypted backup from S3..."
# aws s3 cp "s3://${S3_BUCKET_NAME:-amdox-backups}/${S3_FILENAME}" "${DOWNLOAD_DIR}/${S3_FILENAME}"

echo "Decrypting backup archive..."
openssl enc -d -aes-256-cbc -in "${DOWNLOAD_DIR}/${S3_FILENAME}" -out "${DOWNLOAD_DIR}/${DECRYPTED_FILENAME}" -k "${BACKUP_ENCRYPTION_KEY:-supersecretpassphrase}"

echo "Restoring database..."
gunzip -c "${DOWNLOAD_DIR}/${DECRYPTED_FILENAME}" | psql -h "${DB_HOST:-db}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-amdox_erp}"

echo "Clean up temporary files..."
rm -f "${DOWNLOAD_DIR}/${S3_FILENAME}" "${DOWNLOAD_DIR}/${DECRYPTED_FILENAME}"

echo "Database restoration completed successfully!"
