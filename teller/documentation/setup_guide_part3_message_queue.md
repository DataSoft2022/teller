# Comprehensive Setup Guide - Part 3: Message Queue Setup

## RabbitMQ Setup for Message-Based Synchronization

In this section, we'll set up RabbitMQ for message-based synchronization between headquarters and branches. RabbitMQ will be used to handle real-time data synchronization and ensure reliable message delivery between different nodes.

### 1. Create RabbitMQ Configuration

Create a configuration file for RabbitMQ:

```bash
cd banking-prototype
mkdir -p config/rabbitmq
cat > config/rabbitmq/rabbitmq.conf << 'EOF'
# RabbitMQ Configuration

# Default user and password
default_user = admin
default_pass = admin_password

# Default vhost
default_vhost = /

# Memory threshold at which to trigger flow control
vm_memory_high_watermark.relative = 0.6

# Disk free space threshold at which to trigger flow control
disk_free_limit.relative = 2.0

# Enable management plugin
management.listener.port = 15672
management.listener.ssl = false

# Enable MQTT plugin
mqtt.listeners.tcp.default = 1883
mqtt.allow_anonymous = true
mqtt.vhost = /
mqtt.exchange = amq.topic
mqtt.subscription_ttl = 86400000
mqtt.prefetch = 10

# Enable STOMP plugin
stomp.listeners.tcp.1 = 61613
stomp.vhost = /
EOF
```

### 2. Create Docker Compose Files for RabbitMQ

#### HQ RabbitMQ Docker Compose

Create a Docker Compose file for the HQ RabbitMQ instance:

```bash
cat > hq/docker-compose-rabbitmq.yml << 'EOF'
version: '3.8'

services:
  rabbitmq-hq:
    image: rabbitmq:3.9-management
    container_name: rabbitmq-hq
    restart: unless-stopped
    environment:
      - RABBITMQ_CONFIG_FILE=/etc/rabbitmq/rabbitmq.conf
    volumes:
      - ./data/rabbitmq:/var/lib/rabbitmq
      - ../config/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf
    ports:
      - "5672:5672"   # AMQP port
      - "15672:15672" # Management UI port
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

#### Branch 1 RabbitMQ Docker Compose

Create a Docker Compose file for Branch 1 RabbitMQ instance:

```bash
cat > branch1/docker-compose-rabbitmq.yml << 'EOF'
version: '3.8'

services:
  rabbitmq-branch1:
    image: rabbitmq:3.9-management
    container_name: rabbitmq-branch1
    restart: unless-stopped
    environment:
      - RABBITMQ_CONFIG_FILE=/etc/rabbitmq/rabbitmq.conf
    volumes:
      - ./data/rabbitmq:/var/lib/rabbitmq
      - ../config/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf
    ports:
      - "5673:5672"   # AMQP port
      - "15673:15672" # Management UI port
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

#### Branch 2 RabbitMQ Docker Compose

Create a Docker Compose file for Branch 2 RabbitMQ instance:

```bash
cat > branch2/docker-compose-rabbitmq.yml << 'EOF'
version: '3.8'

services:
  rabbitmq-branch2:
    image: rabbitmq:3.9-management
    container_name: rabbitmq-branch2
    restart: unless-stopped
    environment:
      - RABBITMQ_CONFIG_FILE=/etc/rabbitmq/rabbitmq.conf
    volumes:
      - ./data/rabbitmq:/var/lib/rabbitmq
      - ../config/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf
    ports:
      - "5674:5672"   # AMQP port
      - "15674:15672" # Management UI port
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

### 3. Start RabbitMQ Containers

Start the RabbitMQ containers for HQ and branches:

```bash
# Start HQ RabbitMQ
cd banking-prototype/hq
docker-compose -f docker-compose-rabbitmq.yml up -d

# Start Branch 1 RabbitMQ
cd ../branch1
docker-compose -f docker-compose-rabbitmq.yml up -d

# Start Branch 2 RabbitMQ
cd ../branch2
docker-compose -f docker-compose-rabbitmq.yml up -d

# Return to the main directory
cd ..
```

### 4. Configure RabbitMQ for Synchronization

Set up exchanges, queues, and bindings for synchronization:

```bash
# Wait for RabbitMQ to start up
sleep 10

# Configure HQ RabbitMQ
docker exec rabbitmq-hq rabbitmqctl add_vhost banking
docker exec rabbitmq-hq rabbitmqctl set_permissions -p banking admin ".*" ".*" ".*"

# Create exchanges, queues, and bindings for HQ
docker exec rabbitmq-hq rabbitmqadmin declare exchange --vhost=banking name=branch_to_hq type=topic
docker exec rabbitmq-hq rabbitmqadmin declare exchange --vhost=banking name=hq_to_branch type=topic

docker exec rabbitmq-hq rabbitmqadmin declare queue --vhost=banking name=branch1_to_hq_queue durable=true
docker exec rabbitmq-hq rabbitmqadmin declare queue --vhost=banking name=branch2_to_hq_queue durable=true
docker exec rabbitmq-hq rabbitmqadmin declare queue --vhost=banking name=hq_to_branch1_queue durable=true
docker exec rabbitmq-hq rabbitmqadmin declare queue --vhost=banking name=hq_to_branch2_queue durable=true

docker exec rabbitmq-hq rabbitmqadmin declare binding --vhost=banking source=branch_to_hq destination=branch1_to_hq_queue routing_key=branch1.*
docker exec rabbitmq-hq rabbitmqadmin declare binding --vhost=banking source=branch_to_hq destination=branch2_to_hq_queue routing_key=branch2.*
docker exec rabbitmq-hq rabbitmqadmin declare binding --vhost=banking source=hq_to_branch destination=hq_to_branch1_queue routing_key=hq.branch1.*
docker exec rabbitmq-hq rabbitmqadmin declare binding --vhost=banking source=hq_to_branch destination=hq_to_branch2_queue routing_key=hq.branch2.*

# Configure Branch 1 RabbitMQ
docker exec rabbitmq-branch1 rabbitmqctl add_vhost banking
docker exec rabbitmq-branch1 rabbitmqctl set_permissions -p banking admin ".*" ".*" ".*"

# Create exchanges, queues, and bindings for Branch 1
docker exec rabbitmq-branch1 rabbitmqadmin declare exchange --vhost=banking name=branch_to_hq type=topic
docker exec rabbitmq-branch1 rabbitmqadmin declare exchange --vhost=banking name=hq_to_branch type=topic

docker exec rabbitmq-branch1 rabbitmqadmin declare queue --vhost=banking name=branch1_to_hq_queue durable=true
docker exec rabbitmq-branch1 rabbitmqadmin declare queue --vhost=banking name=hq_to_branch1_queue durable=true

docker exec rabbitmq-branch1 rabbitmqadmin declare binding --vhost=banking source=branch_to_hq destination=branch1_to_hq_queue routing_key=branch1.*
docker exec rabbitmq-branch1 rabbitmqadmin declare binding --vhost=banking source=hq_to_branch destination=hq_to_branch1_queue routing_key=hq.branch1.*

# Configure Branch 2 RabbitMQ
docker exec rabbitmq-branch2 rabbitmqctl add_vhost banking
docker exec rabbitmq-branch2 rabbitmqctl set_permissions -p banking admin ".*" ".*" ".*"

# Create exchanges, queues, and bindings for Branch 2
docker exec rabbitmq-branch2 rabbitmqadmin declare exchange --vhost=banking name=branch_to_hq type=topic
docker exec rabbitmq-branch2 rabbitmqadmin declare exchange --vhost=banking name=hq_to_branch type=topic

docker exec rabbitmq-branch2 rabbitmqadmin declare queue --vhost=banking name=branch2_to_hq_queue durable=true
docker exec rabbitmq-branch2 rabbitmqadmin declare queue --vhost=banking name=hq_to_branch2_queue durable=true

docker exec rabbitmq-branch2 rabbitmqadmin declare binding --vhost=banking source=branch_to_hq destination=branch2_to_hq_queue routing_key=branch2.*
docker exec rabbitmq-branch2 rabbitmqadmin declare binding --vhost=banking source=hq_to_branch destination=hq_to_branch2_queue routing_key=hq.branch2.*
```

### 5. Create Synchronization Service

Now, let's create a Node.js-based synchronization service that will handle the message processing between PostgreSQL and RabbitMQ.

#### Create Synchronization Service Directory Structure

```bash
mkdir -p shared/sync-service/src
```

#### Create package.json for the Synchronization Service

```bash
cat > shared/sync-service/package.json << 'EOF'
{
  "name": "banking-sync-service",
  "version": "1.0.0",
  "description": "Synchronization service for multi-branch banking system",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "amqplib": "^0.10.3",
    "pg": "^8.11.0",
    "express": "^4.18.2",
    "winston": "^3.8.2",
    "uuid": "^9.0.0",
    "dotenv": "^16.0.3"
  }
}
EOF
```

#### Create Dockerfile for the Synchronization Service

```bash
cat > shared/sync-service/Dockerfile << 'EOF'
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
EOF
```

#### Create .env Files for Different Environments

For HQ:

```bash
cat > shared/sync-service/hq.env << 'EOF'
NODE_ENV=development
PORT=3000
BRANCH_CODE=HQ

# PostgreSQL Configuration
PGHOST=postgres-hq
PGPORT=5432
PGDATABASE=erpnext_hq
PGUSER=postgres
PGPASSWORD=postgres_hq_password

# RabbitMQ Configuration
RABBITMQ_HOST=rabbitmq-hq
RABBITMQ_PORT=5672
RABBITMQ_VHOST=banking
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin_password

# Sync Configuration
SYNC_INTERVAL=30000
EOF
```

For Branch 1:

```bash
cat > shared/sync-service/branch1.env << 'EOF'
NODE_ENV=development
PORT=3000
BRANCH_CODE=BR001

# PostgreSQL Configuration
PGHOST=postgres-branch1
PGPORT=5432
PGDATABASE=erpnext_branch1
PGUSER=postgres
PGPASSWORD=postgres_branch1_password

# RabbitMQ Configuration
RABBITMQ_HOST=rabbitmq-branch1
RABBITMQ_PORT=5672
RABBITMQ_VHOST=banking
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin_password

# Sync Configuration
SYNC_INTERVAL=30000
EOF
```

For Branch 2:

```bash
cat > shared/sync-service/branch2.env << 'EOF'
NODE_ENV=development
PORT=3000
BRANCH_CODE=BR002

# PostgreSQL Configuration
PGHOST=postgres-branch2
PGPORT=5432
PGDATABASE=erpnext_branch2
PGUSER=postgres
PGPASSWORD=postgres_branch2_password

# RabbitMQ Configuration
RABBITMQ_HOST=rabbitmq-branch2
RABBITMQ_PORT=5672
RABBITMQ_VHOST=banking
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin_password

# Sync Configuration
SYNC_INTERVAL=30000
EOF
```

#### Create Main Application Files

Create the main index.js file:

```bash
cat > shared/sync-service/src/index.js << 'EOF'
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const amqp = require('amqplib');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'sync-service', branch: process.env.BRANCH_CODE },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'sync-service.log' })
  ]
});

// PostgreSQL connection pool
const pgPool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD
});

// Express app setup
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    branch: process.env.BRANCH_CODE,
    timestamp: new Date().toISOString()
  });
});

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    const pgClient = await pgPool.connect();
    const result = await pgClient.query('SELECT COUNT(*) FROM sync_outbox WHERE status = $1', ['pending']);
    pgClient.release();
    
    res.status(200).json({
      status: 'OK',
      branch: process.env.BRANCH_CODE,
      pendingSyncItems: parseInt(result.rows[0].count),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting status', { error: error.message });
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// RabbitMQ connection
let rabbitConnection;
let rabbitChannel;

// Connect to RabbitMQ
async function connectToRabbitMQ() {
  try {
    const amqpUrl = `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}/${process.env.RABBITMQ_VHOST}`;
    rabbitConnection = await amqp.connect(amqpUrl);
    rabbitChannel = await rabbitConnection.createChannel();
    
    logger.info('Connected to RabbitMQ');
    
    // Setup consumers based on branch code
    if (process.env.BRANCH_CODE === 'HQ') {
      // HQ consumes messages from branches
      await rabbitChannel.consume('branch1_to_hq_queue', processIncomingMessage, { noAck: false });
      await rabbitChannel.consume('branch2_to_hq_queue', processIncomingMessage, { noAck: false });
    } else {
      // Branches consume messages from HQ
      const queueName = `hq_to_${process.env.BRANCH_CODE.toLowerCase()}_queue`;
      await rabbitChannel.consume(queueName, processIncomingMessage, { noAck: false });
    }
  } catch (error) {
    logger.error('Error connecting to RabbitMQ', { error: error.message });
    setTimeout(connectToRabbitMQ, 5000);
  }
}

// Process incoming messages from RabbitMQ
async function processIncomingMessage(msg) {
  if (!msg) return;
  
  try {
    const content = JSON.parse(msg.content.toString());
    logger.info('Received message', { messageId: content.id, operation: content.operation });
    
    const pgClient = await pgPool.connect();
    
    try {
      // Start transaction
      await pgClient.query('BEGIN');
      
      // Process the message based on operation
      switch (content.operation) {
        case 'INSERT':
        case 'UPDATE':
          await upsertRecord(pgClient, content.table_name, content.data);
          break;
        case 'DELETE':
          await deleteRecord(pgClient, content.table_name, content.data.id);
          break;
        default:
          logger.warn('Unknown operation', { operation: content.operation });
      }
      
      // Update sync status
      await pgClient.query(
        'INSERT INTO sync_status (source, destination, last_sync_time, status, record_count) VALUES ($1, $2, $3, $4, $5)',
        [content.source, process.env.BRANCH_CODE, new Date(), 'completed', 1]
      );
      
      // Commit transaction
      await pgClient.query('COMMIT');
      
      // Acknowledge message
      rabbitChannel.ack(msg);
      logger.info('Processed message successfully', { messageId: content.id });
    } catch (error) {
      // Rollback transaction on error
      await pgClient.query('ROLLBACK');
      logger.error('Error processing message', { error: error.message, messageId: content.id });
      
      // Requeue message for retry (or move to dead letter queue after multiple failures)
      rabbitChannel.nack(msg, false, true);
    } finally {
      pgClient.release();
    }
  } catch (error) {
    logger.error('Error parsing message', { error: error.message });
    rabbitChannel.nack(msg, false, false);
  }
}

// Upsert record into database
async function upsertRecord(pgClient, tableName, data) {
  // Extract fields and values from data
  const fields = Object.keys(data).filter(key => key !== 'id');
  const values = fields.map(field => data[field]);
  
  // Create placeholders for prepared statement
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
  const updateSet = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
  
  // Upsert query
  const query = `
    INSERT INTO ${tableName} (${fields.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;
  
  await pgClient.query(query, values);
}

// Delete record from database
async function deleteRecord(pgClient, tableName, id) {
  await pgClient.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
}

// Process outgoing messages to RabbitMQ
async function processOutgoingMessages() {
  if (!rabbitChannel) {
    logger.warn('RabbitMQ channel not available');
    return;
  }
  
  const pgClient = await pgPool.connect();
  
  try {
    // Start transaction
    await pgClient.query('BEGIN');
    
    // Get pending outbox messages
    const result = await pgClient.query(
      'SELECT * FROM sync_outbox WHERE status = $1 ORDER BY created_at LIMIT 100',
      ['pending']
    );
    
    if (result.rows.length === 0) {
      await pgClient.query('COMMIT');
      return;
    }
    
    logger.info(`Processing ${result.rows.length} outgoing messages`);
    
    // Process each message
    for (const row of result.rows) {
      try {
        // Determine routing key based on branch code
        let routingKey;
        let exchange;
        
        if (process.env.BRANCH_CODE === 'HQ') {
          // HQ to branch
          exchange = 'hq_to_branch';
          routingKey = `hq.${row.destination.toLowerCase()}.*`;
        } else {
          // Branch to HQ
          exchange = 'branch_to_hq';
          routingKey = `${process.env.BRANCH_CODE.toLowerCase()}.${row.table_name}`;
        }
        
        // Publish message to RabbitMQ
        const message = {
          id: row.id,
          table_name: row.table_name,
          record_id: row.record_id,
          operation: row.operation,
          data: row.data,
          source: process.env.BRANCH_CODE,
          destination: row.destination,
          global_transaction_id: row.global_transaction_id,
          timestamp: new Date().toISOString()
        };
        
        await rabbitChannel.publish(
          exchange,
          routingKey,
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );
        
        // Mark as processed
        await pgClient.query(
          'UPDATE sync_outbox SET status = $1, processed_at = $2 WHERE id = $3',
          ['processed', new Date(), row.id]
        );
        
        logger.info('Published message', { messageId: row.id, routingKey });
      } catch (error) {
        logger.error('Error publishing message', { error: error.message, messageId: row.id });
        // Continue with other messages
      }
    }
    
    // Commit transaction
    await pgClient.query('COMMIT');
  } catch (error) {
    // Rollback transaction on error
    await pgClient.query('ROLLBACK');
    logger.error('Error processing outgoing messages', { error: error.message });
  } finally {
    pgClient.release();
  }
}

// Start the application
async function startApp() {
  try {
    // Connect to PostgreSQL
    await pgPool.query('SELECT NOW()');
    logger.info('Connected to PostgreSQL');
    
    // Connect to RabbitMQ
    await connectToRabbitMQ();
    
    // Start processing outgoing messages periodically
    setInterval(processOutgoingMessages, process.env.SYNC_INTERVAL || 30000);
    
    // Start Express server
    app.listen(port, () => {
      logger.info(`Sync service listening on port ${port}`);
    });
  } catch (error) {
    logger.error('Error starting application', { error: error.message });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (rabbitChannel) await rabbitChannel.close();
  if (rabbitConnection) await rabbitConnection.close();
  await pgPool.end();
  
  process.exit(0);
});

// Start the application
startApp();
EOF
```

### 6. Create Docker Compose Files for Synchronization Service

#### HQ Sync Service Docker Compose

```bash
cat > hq/docker-compose-sync.yml << 'EOF'
version: '3.8'

services:
  sync-service-hq:
    build:
      context: ../shared/sync-service
      dockerfile: Dockerfile
    container_name: sync-service-hq
    restart: unless-stopped
    env_file:
      - ../shared/sync-service/hq.env
    ports:
      - "3000:3000"
    depends_on:
      - postgres-hq
      - rabbitmq-hq
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

#### Branch 1 Sync Service Docker Compose

```bash
cat > branch1/docker-compose-sync.yml << 'EOF'
version: '3.8'

services:
  sync-service-branch1:
    build:
      context: ../shared/sync-service
      dockerfile: Dockerfile
    container_name: sync-service-branch1
    restart: unless-stopped
    env_file:
      - ../shared/sync-service/branch1.env
    ports:
      - "3001:3000"
    depends_on:
      - postgres-branch1
      - rabbitmq-branch1
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

#### Branch 2 Sync Service Docker Compose

```bash
cat > branch2/docker-compose-sync.yml << 'EOF'
version: '3.8'

services:
  sync-service-branch2:
    build:
      context: ../shared/sync-service
      dockerfile: Dockerfile
    container_name: sync-service-branch2
    restart: unless-stopped
    env_file:
      - ../shared/sync-service/branch2.env
    ports:
      - "3002:3000"
    depends_on:
      - postgres-branch2
      - rabbitmq-branch2
    networks:
      - banking-prototype-network

networks:
  banking-prototype-network:
    external: true
EOF
```

### 7. Start Synchronization Services

Start the synchronization services for HQ and branches:

```bash
# Start HQ Sync Service
cd banking-prototype/hq
docker-compose -f docker-compose-sync.yml up -d

# Start Branch 1 Sync Service
cd ../branch1
docker-compose -f docker-compose-sync.yml up -d

# Start Branch 2 Sync Service
cd ../branch2
docker-compose -f docker-compose-sync.yml up -d

# Return to the main directory
cd ..
```

## Next Steps

After setting up the message queue and synchronization services, proceed to [Part 4: ERPNext Setup](setup_guide_part4_erpnext.md) to configure ERPNext with PostgreSQL for the banking system. 