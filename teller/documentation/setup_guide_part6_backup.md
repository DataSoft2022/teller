# Comprehensive Setup Guide - Part 6: Backup and Recovery

## Backup and Recovery Procedures

In this section, we'll set up backup and recovery procedures for the multi-branch banking system to ensure data safety and business continuity.

### 1. Create Backup Scripts

Let's create backup scripts for PostgreSQL databases:

```bash
mkdir -p backup
cat > backup/backup_postgres.sh << 'EOF'
#!/bin/bash

# Configuration
BACKUP_DIR="/backup/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup HQ database
echo "Backing up HQ database..."
docker exec postgres-hq pg_dump -U postgres -d erpnext_hq -F c -f /tmp/erpnext_hq_$DATE.backup
docker cp postgres-hq:/tmp/erpnext_hq_$DATE.backup $BACKUP_DIR/
docker exec postgres-hq rm /tmp/erpnext_hq_$DATE.backup

# Backup Branch 1 database
echo "Backing up Branch 1 database..."
docker exec postgres-branch1 pg_dump -U postgres -d erpnext_branch1 -F c -f /tmp/erpnext_branch1_$DATE.backup
docker cp postgres-branch1:/tmp/erpnext_branch1_$DATE.backup $BACKUP_DIR/
docker exec postgres-branch1 rm /tmp/erpnext_branch1_$DATE.backup

# Backup Branch 2 database
echo "Backing up Branch 2 database..."
docker exec postgres-branch2 pg_dump -U postgres -d erpnext_branch2 -F c -f /tmp/erpnext_branch2_$DATE.backup
docker cp postgres-branch2:/tmp/erpnext_branch2_$DATE.backup $BACKUP_DIR/
docker exec postgres-branch2 rm /tmp/erpnext_branch2_$DATE.backup

# Remove old backups
echo "Removing backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -name "*.backup" -type f -mtime +$RETENTION_DAYS -delete

echo "Backup completed successfully!"
EOF

chmod +x backup/backup_postgres.sh
```

Create a backup script for ERPNext:

```bash
cat > backup/backup_erpnext.sh << 'EOF'
#!/bin/bash

# Configuration
BACKUP_DIR="/backup/erpnext"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup HQ ERPNext site
echo "Backing up HQ ERPNext site..."
docker exec erpnext-hq bench --site hq.banking.local backup --with-files
docker cp erpnext-hq:/home/frappe/frappe-bench/sites/hq.banking.local/private/backups/ $BACKUP_DIR/hq_$DATE/

# Backup Branch 1 ERPNext site
echo "Backing up Branch 1 ERPNext site..."
docker exec erpnext-branch1 bench --site branch1.banking.local backup --with-files
docker cp erpnext-branch1:/home/frappe/frappe-bench/sites/branch1.banking.local/private/backups/ $BACKUP_DIR/branch1_$DATE/

# Backup Branch 2 ERPNext site
echo "Backing up Branch 2 ERPNext site..."
docker exec erpnext-branch2 bench --site branch2.banking.local backup --with-files
docker cp erpnext-branch2:/home/frappe/frappe-bench/sites/branch2.banking.local/private/backups/ $BACKUP_DIR/branch2_$DATE/

# Remove old backups
echo "Removing backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;

echo "Backup completed successfully!"
EOF

chmod +x backup/backup_erpnext.sh
```

### 2. Create Recovery Scripts

Let's create recovery scripts for PostgreSQL databases:

```bash
cat > backup/restore_postgres.sh << 'EOF'
#!/bin/bash

# Check if backup file is provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <backup_file> <target>"
    echo "Example: $0 /backup/postgres/erpnext_hq_20230101_120000.backup hq"
    exit 1
fi

BACKUP_FILE=$1
TARGET=$2

# Validate target
if [[ "$TARGET" != "hq" && "$TARGET" != "branch1" && "$TARGET" != "branch2" ]]; then
    echo "Invalid target. Must be one of: hq, branch1, branch2"
    exit 1
fi

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Copy backup file to container
echo "Copying backup file to container..."
case "$TARGET" in
    "hq")
        docker cp $BACKUP_FILE postgres-hq:/tmp/restore.backup
        DB_NAME="erpnext_hq"
        CONTAINER="postgres-hq"
        ;;
    "branch1")
        docker cp $BACKUP_FILE postgres-branch1:/tmp/restore.backup
        DB_NAME="erpnext_branch1"
        CONTAINER="postgres-branch1"
        ;;
    "branch2")
        docker cp $BACKUP_FILE postgres-branch2:/tmp/restore.backup
        DB_NAME="erpnext_branch2"
        CONTAINER="postgres-branch2"
        ;;
esac

# Restore database
echo "Restoring database $DB_NAME on $CONTAINER..."
docker exec $CONTAINER psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();"
docker exec $CONTAINER dropdb -U postgres $DB_NAME --if-exists
docker exec $CONTAINER createdb -U postgres $DB_NAME
docker exec $CONTAINER pg_restore -U postgres -d $DB_NAME /tmp/restore.backup

# Clean up
docker exec $CONTAINER rm /tmp/restore.backup

echo "Restore completed successfully!"
EOF

chmod +x backup/restore_postgres.sh
```

Create a recovery script for ERPNext:

```bash
cat > backup/restore_erpnext.sh << 'EOF'
#!/bin/bash

# Check if backup directory and target are provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <backup_directory> <target>"
    echo "Example: $0 /backup/erpnext/hq_20230101_120000 hq"
    exit 1
fi

BACKUP_DIR=$1
TARGET=$2

# Validate target
if [[ "$TARGET" != "hq" && "$TARGET" != "branch1" && "$TARGET" != "branch2" ]]; then
    echo "Invalid target. Must be one of: hq, branch1, branch2"
    exit 1
fi

# Validate backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# Find the latest database backup file
DB_BACKUP=$(find $BACKUP_DIR -name "*.sql.gz" | sort -r | head -1)
if [ -z "$DB_BACKUP" ]; then
    echo "No database backup found in $BACKUP_DIR"
    exit 1
fi

# Find the latest files backup
FILES_BACKUP=$(find $BACKUP_DIR -name "*.tar" | sort -r | head -1)

# Copy backup files to container
echo "Copying backup files to container..."
case "$TARGET" in
    "hq")
        CONTAINER="erpnext-hq"
        SITE="hq.banking.local"
        ;;
    "branch1")
        CONTAINER="erpnext-branch1"
        SITE="branch1.banking.local"
        ;;
    "branch2")
        CONTAINER="erpnext-branch2"
        SITE="branch2.banking.local"
        ;;
esac

docker cp $DB_BACKUP $CONTAINER:/tmp/database.sql.gz
if [ ! -z "$FILES_BACKUP" ]; then
    docker cp $FILES_BACKUP $CONTAINER:/tmp/files.tar
fi

# Restore database
echo "Restoring database for $SITE on $CONTAINER..."
docker exec $CONTAINER bench --site $SITE --force restore /tmp/database.sql.gz

# Restore files if available
if [ ! -z "$FILES_BACKUP" ]; then
    echo "Restoring files for $SITE on $CONTAINER..."
    docker exec $CONTAINER bench --site $SITE --force restore /tmp/files.tar
fi

# Clean up
docker exec $CONTAINER rm /tmp/database.sql.gz
if [ ! -z "$FILES_BACKUP" ]; then
    docker exec $CONTAINER rm /tmp/files.tar
fi

echo "Restore completed successfully!"
EOF

chmod +x backup/restore_erpnext.sh
```

### 3. Set Up Scheduled Backups

Let's set up a cron job to run backups automatically:

```bash
cat > backup/setup_cron.sh << 'EOF'
#!/bin/bash

# Add cron jobs for automatic backups
(crontab -l 2>/dev/null; echo "0 2 * * * $(pwd)/backup/backup_postgres.sh > $(pwd)/backup/postgres_backup.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 3 * * * $(pwd)/backup/backup_erpnext.sh > $(pwd)/backup/erpnext_backup.log 2>&1") | crontab -

echo "Cron jobs set up successfully!"
echo "PostgreSQL backups will run daily at 2:00 AM"
echo "ERPNext backups will run daily at 3:00 AM"
EOF

chmod +x backup/setup_cron.sh
```

### 4. Create Backup Verification Script

Let's create a script to verify the integrity of backups:

```bash
cat > backup/verify_backup.sh << 'EOF'
#!/bin/bash

# Check if backup file is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 /backup/postgres/erpnext_hq_20230101_120000.backup"
    exit 1
fi

BACKUP_FILE=$1

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create a temporary container to verify the backup
echo "Creating temporary container to verify backup..."
docker run --rm -v $BACKUP_FILE:/backup.file postgres:14 pg_restore -l /backup.file > /dev/null

# Check the exit status
if [ $? -eq 0 ]; then
    echo "Backup verification successful! The backup file is valid."
else
    echo "Backup verification failed! The backup file may be corrupted."
    exit 1
fi
EOF

chmod +x backup/verify_backup.sh
```

### 5. Create Disaster Recovery Documentation

Let's create a disaster recovery document:

```bash
cat > backup/disaster_recovery.md << 'EOF'
# Disaster Recovery Procedures

This document outlines the procedures for recovering the multi-branch banking system in case of a disaster.

## Prerequisites

- Access to backup files
- Docker and Docker Compose installed on the recovery machine
- Network connectivity between recovery machines

## Recovery Scenarios

### Scenario 1: Single Database Failure

If a single PostgreSQL database fails:

1. Stop the affected container:
   ```bash
   docker stop postgres-hq  # or postgres-branch1, postgres-branch2
   ```

2. Remove the affected container:
   ```bash
   docker rm postgres-hq  # or postgres-branch1, postgres-branch2
   ```

3. Start a new container:
   ```bash
   cd banking-prototype/hq  # or branch1, branch2
   docker-compose -f docker-compose-postgres.yml up -d
   ```

4. Restore the database from backup:
   ```bash
   ./backup/restore_postgres.sh /path/to/backup/file hq  # or branch1, branch2
   ```

### Scenario 2: Single ERPNext Instance Failure

If a single ERPNext instance fails:

1. Stop the affected container:
   ```bash
   docker stop erpnext-hq  # or erpnext-branch1, erpnext-branch2
   ```

2. Remove the affected container:
   ```bash
   docker rm erpnext-hq  # or erpnext-branch1, erpnext-branch2
   ```

3. Start a new container:
   ```bash
   cd banking-prototype/hq  # or branch1, branch2
   docker-compose -f docker-compose-erpnext.yml up -d
   ```

4. Restore the ERPNext site from backup:
   ```bash
   ./backup/restore_erpnext.sh /path/to/backup/directory hq  # or branch1, branch2
   ```

### Scenario 3: Complete System Failure

If the entire system fails:

1. Set up a new machine with Docker and Docker Compose.

2. Clone the repository or copy the banking-prototype directory.

3. Create the Docker network:
   ```bash
   docker network create banking-prototype-network
   ```

4. Start PostgreSQL containers:
   ```bash
   cd banking-prototype/hq
   docker-compose -f docker-compose-postgres.yml up -d
   cd ../branch1
   docker-compose -f docker-compose-postgres.yml up -d
   cd ../branch2
   docker-compose -f docker-compose-postgres.yml up -d
   ```

5. Restore PostgreSQL databases:
   ```bash
   ./backup/restore_postgres.sh /path/to/hq/backup/file hq
   ./backup/restore_postgres.sh /path/to/branch1/backup/file branch1
   ./backup/restore_postgres.sh /path/to/branch2/backup/file branch2
   ```

6. Start RabbitMQ containers:
   ```bash
   cd banking-prototype/hq
   docker-compose -f docker-compose-rabbitmq.yml up -d
   cd ../branch1
   docker-compose -f docker-compose-rabbitmq.yml up -d
   cd ../branch2
   docker-compose -f docker-compose-rabbitmq.yml up -d
   ```

7. Start Sync Service containers:
   ```bash
   cd banking-prototype/hq
   docker-compose -f docker-compose-sync.yml up -d
   cd ../branch1
   docker-compose -f docker-compose-sync.yml up -d
   cd ../branch2
   docker-compose -f docker-compose-sync.yml up -d
   ```

8. Start ERPNext containers:
   ```bash
   cd banking-prototype/hq
   docker-compose -f docker-compose-erpnext.yml up -d
   cd ../branch1
   docker-compose -f docker-compose-erpnext.yml up -d
   cd ../branch2
   docker-compose -f docker-compose-erpnext.yml up -d
   ```

9. Restore ERPNext sites:
   ```bash
   ./backup/restore_erpnext.sh /path/to/hq/backup/directory hq
   ./backup/restore_erpnext.sh /path/to/branch1/backup/directory branch1
   ./backup/restore_erpnext.sh /path/to/branch2/backup/directory branch2
   ```

10. Start Monitoring services:
    ```bash
    cd banking-prototype/monitoring
    docker-compose up -d
    ```

## Recovery Testing

It is recommended to test the recovery procedures regularly to ensure they work as expected. Schedule a quarterly recovery test where you:

1. Create a backup of the system
2. Set up a test environment
3. Restore the backup in the test environment
4. Verify that all components work correctly

Document any issues encountered during the test and update the recovery procedures accordingly.
EOF
```

### 6. Set Up Backup Storage

Let's create a Docker Compose file for a backup storage service:

```bash
mkdir -p backup/storage
cat > backup/storage/docker-compose.yml << 'EOF'
version: '3.8'

services:
  backup-storage:
    image: minio/minio
    container_name: backup-storage
    restart: unless-stopped
    volumes:
      - ./data:/data
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

Create a script to upload backups to the storage service:

```bash
cat > backup/upload_backup.sh << 'EOF'
#!/bin/bash

# Check if backup directory is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_directory>"
    echo "Example: $0 /backup/postgres"
    exit 1
fi

BACKUP_DIR=$1

# Validate backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# Install MinIO client if not already installed
if ! command -v mc &> /dev/null; then
    echo "Installing MinIO client..."
    wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc
    chmod +x /usr/local/bin/mc
fi

# Configure MinIO client
mc alias set local http://localhost:9000 minio minio123

# Create bucket if it doesn't exist
mc mb --ignore-existing local/banking-backups

# Upload backups
echo "Uploading backups from $BACKUP_DIR..."
mc cp --recursive $BACKUP_DIR local/banking-backups/$(basename $BACKUP_DIR)

echo "Backup upload completed successfully!"
EOF

chmod +x backup/upload_backup.sh
```

### 7. Start Backup Storage Service

Start the backup storage service:

```bash
cd backup/storage
docker-compose up -d
cd ../..
```

### 8. Test Backup and Recovery

Let's test the backup and recovery procedures:

```bash
# Create a backup directory
mkdir -p /backup/postgres /backup/erpnext

# Run PostgreSQL backup
./backup/backup_postgres.sh

# Run ERPNext backup
./backup/backup_erpnext.sh

# Verify a PostgreSQL backup
./backup/verify_backup.sh /backup/postgres/erpnext_hq_*.backup

# Upload backups to storage
./backup/upload_backup.sh /backup/postgres
./backup/upload_backup.sh /backup/erpnext

# Test PostgreSQL recovery (replace with actual backup file)
# ./backup/restore_postgres.sh /backup/postgres/erpnext_hq_20230101_120000.backup hq

# Test ERPNext recovery (replace with actual backup directory)
# ./backup/restore_erpnext.sh /backup/erpnext/hq_20230101_120000 hq
```

## Next Steps

After setting up backup and recovery procedures for the multi-branch banking system, proceed to [Part 7: Deployment to Production](setup_guide_part7_production.md) to prepare the system for production deployment. 