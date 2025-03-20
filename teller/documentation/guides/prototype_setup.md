# Multi-Branch Banking System Prototype Setup

This guide will help you set up a testing prototype of our multi-branch banking system with data replication between branches. This simplified setup can run on one or two computers to demonstrate the core functionality.

## Prerequisites

- Computer with at least 16GB RAM and 4 CPU cores
- 50GB free disk space
- Windows 10/11, macOS, or Linux
- Docker Desktop installed and running
- Git installed

## Step 1: Create Project Structure

Create a directory structure for the prototype:

```bash
mkdir -p banking-prototype/{hq,branch1,branch2,shared}
cd banking-prototype
```

## Step 2: Set Up Docker Compose Files

### Headquarters (HQ) Setup

Create a file `hq/docker-compose.yml`:

```yaml
version: '3.8'

services:
  # ERPNext instance for HQ
  erpnext-hq:
    image: frappe/erpnext:v14
    container_name: erpnext-hq
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - ADMIN_PASSWORD=admin
      - DB_HOST=postgres-hq
      - DB_PORT=5432
      - DB_NAME=erpnext_hq
      - DB_PASSWORD=postgres
      - DB_ROOT_PASSWORD=postgres
    volumes:
      - erpnext-hq-sites:/home/frappe/frappe-bench/sites
    depends_on:
      - postgres-hq
    networks:
      - hq-network

  # PostgreSQL for HQ (primary)
  postgres-hq:
    image: postgres:14
    container_name: postgres-hq
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_DB=erpnext_hq
    volumes:
      - postgres-hq-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    command: 
      - "postgres"
      - "-c"
      - "wal_level=logical"
      - "-c"
      - "max_wal_senders=10"
      - "-c"
      - "max_replication_slots=10"
    networks:
      - hq-network
      - replication-network

  # RabbitMQ for message queuing
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    restart: unless-stopped
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=admin
      - RABBITMQ_DEFAULT_PASS=admin
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    networks:
      - hq-network
      - replication-network

  # Sync service for HQ
  sync-service-hq:
    build:
      context: ../shared/sync-service
      dockerfile: Dockerfile
    container_name: sync-service-hq
    restart: unless-stopped
    environment:
      - DB_HOST=postgres-hq
      - DB_PORT=5432
      - DB_NAME=erpnext_hq
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - RABBITMQ_USER=admin
      - RABBITMQ_PASS=admin
      - NODE_ENV=development
      - LOCATION=HQ
    volumes:
      - ../shared/sync-service:/app
    depends_on:
      - postgres-hq
      - rabbitmq
    networks:
      - hq-network
      - replication-network

volumes:
  erpnext-hq-sites:
  postgres-hq-data:
  rabbitmq-data:

networks:
  hq-network:
    driver: bridge
  replication-network:
    driver: bridge
```

### Branch Setup

Create a file `branch1/docker-compose.yml`:

```yaml
version: '3.8'

services:
  # ERPNext instance for Branch
  erpnext-branch:
    image: frappe/erpnext:v14
    container_name: erpnext-branch1
    restart: unless-stopped
    ports:
      - "8001:8000"
    environment:
      - ADMIN_PASSWORD=admin
      - DB_HOST=postgres-branch
      - DB_PORT=5432
      - DB_NAME=erpnext_branch1
      - DB_PASSWORD=postgres
      - DB_ROOT_PASSWORD=postgres
    volumes:
      - erpnext-branch-sites:/home/frappe/frappe-bench/sites
    depends_on:
      - postgres-branch
    networks:
      - branch-network

  # PostgreSQL for Branch (replica)
  postgres-branch:
    image: postgres:14
    container_name: postgres-branch1
    restart: unless-stopped
    ports:
      - "5433:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_DB=erpnext_branch1
    volumes:
      - postgres-branch-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    command: 
      - "postgres"
      - "-c"
      - "wal_level=logical"
      - "-c"
      - "max_wal_senders=10"
      - "-c"
      - "max_replication_slots=10"
    networks:
      - branch-network
      - replication-network

  # Sync service for Branch
  sync-service-branch:
    build:
      context: ../shared/sync-service
      dockerfile: Dockerfile
    container_name: sync-service-branch1
    restart: unless-stopped
    environment:
      - DB_HOST=postgres-branch
      - DB_PORT=5432
      - DB_NAME=erpnext_branch1
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
      - RABBITMQ_USER=admin
      - RABBITMQ_PASS=admin
      - NODE_ENV=development
      - LOCATION=BRANCH1
    volumes:
      - ../shared/sync-service:/app
    depends_on:
      - postgres-branch
    networks:
      - branch-network
      - replication-network

volumes:
  erpnext-branch-sites:
  postgres-branch-data:

networks:
  branch-network:
    driver: bridge
  replication-network:
    external: true
```

Copy and modify the branch1 folder to create branch2, changing the ports and container names accordingly.

## Step 3: Create Synchronization Service

Create a basic Node.js synchronization service in `shared/sync-service/`:

### Dockerfile

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]
```

### package.json

```json
{
  "name": "sync-service",
  "version": "1.0.0",
  "description": "Synchronization service for multi-branch banking system",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "amqplib": "^0.8.0",
    "pg": "^8.7.3",
    "express": "^4.18.1",
    "node-cron": "^3.0.0",
    "uuid": "^8.3.2"
  }
}
```

### index.js

```javascript
const amqp = require('amqplib');
const { Client } = require('pg');
const cron = require('node-cron');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

// Configuration from environment variables
const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'erpnext',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  },
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: process.env.RABBITMQ_PORT || 5672,
    user: process.env.RABBITMQ_USER || 'guest',
    pass: process.env.RABBITMQ_PASS || 'guest'
  },
  location: process.env.LOCATION || 'UNKNOWN'
};

// Create Express app for health checks and monitoring
const app = express();
const port = 3000;

// Database client
const dbClient = new Client(config.db);

// Connect to database
async function connectToDatabase() {
  try {
    await dbClient.connect();
    console.log('Connected to database');
    
    // Create sync tables if they don't exist
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS sync_outbox (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        record_id INTEGER NOT NULL,
        operation VARCHAR(10) NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        error_message TEXT
      );
      
      CREATE TABLE IF NOT EXISTS sync_status (
        id SERIAL PRIMARY KEY,
        location VARCHAR(50) NOT NULL,
        last_successful_sync TIMESTAMP,
        sync_direction VARCHAR(20) NOT NULL,
        records_processed INTEGER DEFAULT 0,
        status VARCHAR(20) NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);
    
    console.log('Sync tables created or already exist');
  } catch (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
}

// Connect to RabbitMQ
async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(
      `amqp://${config.rabbitmq.user}:${config.rabbitmq.pass}@${config.rabbitmq.host}:${config.rabbitmq.port}`
    );
    console.log('Connected to RabbitMQ');
    return connection;
  } catch (err) {
    console.error('Error connecting to RabbitMQ:', err);
    process.exit(1);
  }
}

// Process outgoing sync items
async function processOutgoingSync(channel) {
  try {
    // Get pending items from sync_outbox
    const result = await dbClient.query(
      `SELECT * FROM sync_outbox WHERE status = 'pending' ORDER BY created_at LIMIT 100`
    );
    
    if (result.rows.length === 0) {
      console.log('No pending sync items to process');
      return;
    }
    
    console.log(`Processing ${result.rows.length} outgoing sync items`);
    
    // Process each item
    for (const item of result.rows) {
      // Create message with metadata
      const message = {
        id: item.id,
        source: config.location,
        table: item.table_name,
        recordId: item.record_id,
        operation: item.operation,
        payload: item.payload,
        timestamp: new Date().toISOString(),
        transactionId: uuidv4()
      };
      
      // Publish to appropriate queue based on table
      const queueName = `sync.${item.table_name}`;
      await channel.assertQueue(queueName, { durable: true });
      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true
      });
      
      // Update sync_outbox status
      await dbClient.query(
        `UPDATE sync_outbox SET status = 'sent', processed_at = NOW() WHERE id = $1`,
        [item.id]
      );
      
      console.log(`Sent sync item ${item.id} to queue ${queueName}`);
    }
    
    // Update sync status
    await dbClient.query(
      `INSERT INTO sync_status (location, sync_direction, records_processed, status, last_successful_sync, completed_at)
       VALUES ($1, 'OUTGOING', $2, 'COMPLETED', NOW(), NOW())`,
      [config.location, result.rows.length]
    );
    
  } catch (err) {
    console.error('Error processing outgoing sync:', err);
  }
}

// Process incoming sync messages
async function setupIncomingSync(channel) {
  try {
    // Define tables to sync
    const tables = ['teller_invoice', 'currency_exchange', 'teller_treasury', 'exchange_rates'];
    
    for (const table of tables) {
      const queueName = `sync.${table}`;
      await channel.assertQueue(queueName, { durable: true });
      
      // Consume messages
      channel.consume(queueName, async (msg) => {
        if (msg !== null) {
          try {
            const content = JSON.parse(msg.content.toString());
            
            // Skip messages from this location (avoid circular sync)
            if (content.source === config.location) {
              channel.ack(msg);
              return;
            }
            
            console.log(`Received sync message for ${content.table} from ${content.source}`);
            
            // Process based on operation type
            if (content.operation === 'INSERT' || content.operation === 'UPDATE') {
              // Check if record exists
              const checkResult = await dbClient.query(
                `SELECT 1 FROM ${content.table} WHERE id = $1`,
                [content.recordId]
              );
              
              if (checkResult.rows.length > 0) {
                // Update existing record
                const fields = Object.keys(content.payload).filter(k => k !== 'id');
                const values = fields.map(f => content.payload[f]);
                const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ');
                
                await dbClient.query(
                  `UPDATE ${content.table} SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(', ')} 
                   WHERE id = $1`,
                  [content.recordId, ...values]
                );
                
                console.log(`Updated record ${content.recordId} in ${content.table}`);
              } else {
                // Insert new record
                const fields = Object.keys(content.payload);
                const values = fields.map(f => content.payload[f]);
                const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
                
                await dbClient.query(
                  `INSERT INTO ${content.table} (${fields.join(', ')}) 
                   VALUES (${placeholders})`,
                  values
                );
                
                console.log(`Inserted new record into ${content.table}`);
              }
            } else if (content.operation === 'DELETE') {
              // Delete record
              await dbClient.query(
                `DELETE FROM ${content.table} WHERE id = $1`,
                [content.recordId]
              );
              
              console.log(`Deleted record ${content.recordId} from ${content.table}`);
            }
            
            // Acknowledge message
            channel.ack(msg);
            
          } catch (err) {
            console.error('Error processing sync message:', err);
            // Requeue message for retry
            channel.nack(msg, false, true);
          }
        }
      });
      
      console.log(`Listening for sync messages on queue ${queueName}`);
    }
  } catch (err) {
    console.error('Error setting up incoming sync:', err);
  }
}

// Main function
async function main() {
  try {
    // Connect to database
    await connectToDatabase();
    
    // Connect to RabbitMQ
    const connection = await connectToRabbitMQ();
    const channel = await connection.createChannel();
    
    // Set up sync processing
    await setupIncomingSync(channel);
    
    // Schedule outgoing sync processing
    cron.schedule('*/1 * * * *', async () => {
      await processOutgoingSync(channel);
    });
    
    // Set up API endpoints
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'UP', location: config.location });
    });
    
    app.get('/status', async (req, res) => {
      try {
        const result = await dbClient.query(
          `SELECT * FROM sync_status ORDER BY started_at DESC LIMIT 10`
        );
        res.status(200).json(result.rows);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    
    // Start server
    app.listen(port, () => {
      console.log(`Sync service listening at http://localhost:${port}`);
    });
    
    console.log(`Sync service started for location: ${config.location}`);
    
  } catch (err) {
    console.error('Error in main function:', err);
    process.exit(1);
  }
}

// Start the application
main();
```

## Step 4: Create Database Initialization Scripts

Create initialization scripts for PostgreSQL in `hq/init-scripts/` and `branch1/init-scripts/`:

### 01-init-tables.sql

```sql
-- Create tables for banking system

-- Teller Invoice
CREATE TABLE IF NOT EXISTS teller_invoice (
    id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    branch_id VARCHAR(20) NOT NULL,
    customer_id VARCHAR(50),
    transaction_date TIMESTAMP NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    modified_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending',
    global_transaction_id UUID NOT NULL
);

-- Currency Exchange
CREATE TABLE IF NOT EXISTS currency_exchange (
    id SERIAL PRIMARY KEY,
    transaction_no VARCHAR(50) UNIQUE NOT NULL,
    branch_id VARCHAR(20) NOT NULL,
    customer_id VARCHAR(50),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(15,6) NOT NULL,
    from_amount DECIMAL(15,2) NOT NULL,
    to_amount DECIMAL(15,2) NOT NULL,
    transaction_date TIMESTAMP NOT NULL,
    teller_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    global_transaction_id UUID NOT NULL,
    sync_status VARCHAR(20) DEFAULT 'pending'
);

-- Teller Treasury
CREATE TABLE IF NOT EXISTS teller_treasury (
    id SERIAL PRIMARY KEY,
    branch_id VARCHAR(20) NOT NULL,
    teller_id VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    opening_balance DECIMAL(15,2) NOT NULL,
    closing_balance DECIMAL(15,2),
    shift_date DATE NOT NULL,
    shift_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    closed_at TIMESTAMP,
    sync_status VARCHAR(20) DEFAULT 'pending'
);

-- Exchange Rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    modified_at TIMESTAMP,
    UNIQUE (from_currency, to_currency, effective_date)
);

-- Branch Registry
CREATE TABLE IF NOT EXISTS branch_registry (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    region VARCHAR(50),
    contact_number VARCHAR(20),
    manager_id VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL,
    last_sync_at TIMESTAMP
);

-- Insert sample branch data
INSERT INTO branch_registry (id, name, address, region, is_active, created_at)
VALUES 
  ('HQ', 'Headquarters', 'Main Street 123, Capital City', 'Central', true, NOW()),
  ('BR001', 'Branch 1', 'North Avenue 45, Northern City', 'North', true, NOW()),
  ('BR002', 'Branch 2', 'South Boulevard 67, Southern City', 'South', true, NOW());
```

### 02-setup-replication.sql (HQ only)

```sql
-- Create publications for tables that need to be replicated
CREATE PUBLICATION hq_to_branch_pub FOR TABLE exchange_rates;

-- Create a replication slot for each branch
SELECT pg_create_logical_replication_slot('branch1_slot', 'pgoutput');
SELECT pg_create_logical_replication_slot('branch2_slot', 'pgoutput');
```

### 02-setup-replication.sql (Branch only)

```sql
-- Create publications for tables that need to be replicated to HQ
CREATE PUBLICATION branch_to_hq_pub FOR TABLE teller_invoice, currency_exchange, teller_treasury;

-- Create a subscription to HQ
CREATE SUBSCRIPTION branch_from_hq_sub
  CONNECTION 'host=postgres-hq port=5432 user=postgres password=postgres dbname=erpnext_hq'
  PUBLICATION hq_to_branch_pub;
```

## Step 5: Start the Prototype

1. Start the HQ services first:

```bash
cd hq
docker-compose up -d
```

2. Start the branch services:

```bash
cd ../branch1
docker-compose up -d

cd ../branch2
docker-compose up -d
```

## Step 6: Access the Services

- ERPNext HQ: http://localhost:8000
- ERPNext Branch 1: http://localhost:8001
- ERPNext Branch 2: http://localhost:8002
- RabbitMQ Management: http://localhost:15672 (username: admin, password: admin)

## Step 7: Test Data Replication

1. Create exchange rates at HQ:
   - Log in to ERPNext HQ
   - Create new exchange rates
   - Verify they are replicated to branches

2. Create transactions at branches:
   - Log in to ERPNext Branch 1
   - Create teller transactions
   - Verify they are replicated to HQ

## Monitoring and Troubleshooting

- Check sync service logs:
  ```bash
  docker logs sync-service-hq
  docker logs sync-service-branch1
  ```

- Check RabbitMQ queues in the management interface

- Check PostgreSQL replication status:
  ```bash
  docker exec -it postgres-hq psql -U postgres -c "SELECT * FROM pg_stat_replication;"
  ```

## Limitations of the Prototype

- This is a simplified version of the full architecture
- Security features are minimal for testing purposes
- Some manual setup may be required for ERPNext customizations
- Not all failure scenarios are handled

## Next Steps

After testing the prototype, you can:

1. Add more branches to test scalability
2. Implement more sophisticated conflict resolution
3. Add monitoring with Prometheus and Grafana
4. Test network disruption scenarios
5. Develop custom ERPNext apps for banking features 