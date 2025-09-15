# Deployment Guide - tainguyenmmoshop.com

## Server Information

-   **Server**: Ubuntu Server 22.04 x64
-   **IP**: 222.255.119.33
-   **Domain**: tainguyenmmoshop.com

## Pre-deployment Setup

### 1. Upload Source Code

Upload the entire `server` folder to your Ubuntu server at `/opt/tainguyenmmoshop/`

```bash
# On your local machine
scp -r server/ root@222.255.119.33:/opt/tainguyenmmoshop/
```

### 2. DNS Configuration

Point your domain to the server IP:

```
A Record: tainguyenmmoshop.com → 222.255.119.33
A Record: www.tainguyenmmoshop.com → 222.255.119.33
```

## Deployment Steps

### 1. Connect to Server

```bash
ssh root@222.255.119.33
```

### 2. Run Deployment Script

```bash
cd /opt/tainguyenmmoshop
chmod +x deploy.sh
./deploy.sh
```

### 3. Configure Environment Variables

Edit the `.env` file with your actual values:

```bash
nano .env
```

Required configurations:

-   `POSTGRES_PASSWORD`: Strong password for database
-   `JWT_SECRET`: Long random string for JWT tokens
-   Cloudinary credentials (CLOUD_NAME, API_KEY, API_SECRET)
-   SMTP settings for email functionality

### 4. Restart Services

```bash
docker-compose restart
```

### 5. Run Database Migration

```bash
docker-compose exec backend npm run migrate
```

## Service Management

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f nginx
```

### Check Service Status

```bash
docker-compose ps
```

## SSL Certificate

SSL certificate is automatically obtained using Let's Encrypt and configured for:

-   tainguyenmmoshop.com
-   www.tainguyenmmoshop.com

Auto-renewal is set up via cron job.

## API Endpoints

Once deployed, your API will be available at:

-   **Base URL**: https://tainguyenmmoshop.com/api
-   **Documentation**: https://tainguyenmmoshop.com/api-docs
-   **Health Check**: https://tainguyenmmoshop.com/health

## Troubleshooting

### Check if services are running

```bash
docker-compose ps
```

### Restart specific service

```bash
docker-compose restart backend
docker-compose restart nginx
docker-compose restart postgres
```

### View specific service logs

```bash
docker-compose logs backend
```

### Access database directly

```bash
docker-compose exec postgres psql -U postgres -d muabantainguyen
```

### Rebuild services

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Security Notes

1. Change default database password
2. Use strong JWT secret
3. Configure firewall to only allow ports 80, 443, and 22
4. Regularly update system packages
5. Monitor logs for suspicious activity

## Backup

### Database Backup

```bash
docker-compose exec postgres pg_dump -U postgres muabantainguyen > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U postgres muabantainguyen < backup_file.sql
```
