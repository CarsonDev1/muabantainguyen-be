#!/bin/bash

# Deploy script for tainguyenmmoshop.com
# Run this script on Ubuntu server 222.255.119.33

set -e

echo "🚀 Starting deployment for tainguyenmmoshop.com..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Install Docker Compose
echo "🐙 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Install Certbot for SSL
echo "🔒 Installing Certbot..."
sudo apt install -y certbot

# Create project directory
PROJECT_DIR="/opt/tainguyenmmoshop"
echo "📁 Creating project directory: $PROJECT_DIR"
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR

# Copy files (assume source is already uploaded)
echo "📋 Setting up configuration files..."
cd $PROJECT_DIR

# Create .env file from template
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cp env.template .env
    echo "❗ Please edit .env file with your actual configuration values"
    echo "❗ Required: POSTGRES_PASSWORD, JWT_SECRET, Cloudinary credentials, SMTP settings"
fi

# Set up SSL certificate
echo "🔐 Setting up SSL certificate..."
if [ ! -d "/etc/letsencrypt/live/tainguyenmmoshop.com" ]; then
    sudo certbot certonly --standalone \
        -d tainguyenmmoshop.com \
        -d www.tainguyenmmoshop.com \
        --non-interactive \
        --agree-tos \
        --email admin@tainguyenmmoshop.com
fi

# Set up auto-renewal for SSL
echo "🔄 Setting up SSL auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx") | crontab -

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

# Test database connection
echo "🗄️  Testing database connection..."
docker-compose exec backend npm run migrate || echo "⚠️  Database migration needed - run manually"

# Show logs
echo "📋 Recent logs:"
docker-compose logs --tail=50

echo "✅ Deployment completed!"
echo ""
echo "🌐 Your API will be available at: https://tainguyenmmoshop.com/api"
echo "📚 API documentation: https://tainguyenmmoshop.com/api-docs"
echo "🏥 Health check: https://tainguyenmmoshop.com/health"
echo ""
echo "🔧 Next steps:"
echo "1. Edit .env file with your actual configuration values"
echo "2. Restart services: docker-compose restart"
echo "3. Run database migration: docker-compose exec backend npm run migrate"
echo "4. Check logs: docker-compose logs -f"
