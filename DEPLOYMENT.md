# Deployment Guide

This guide covers how to deploy the Backlinker automated directory submission system.

## ❌ Not Suitable For

- **Vercel/Netlify** - Serverless platforms with timeout limits (10-60s max)
- **Static hosting** - Needs Node.js runtime and database
- **Shared hosting** - Needs full server access for Playwright

## ✅ Recommended Hosting Options

### Option 1: VPS/Cloud Server (Recommended for Production)

Best providers:
- **DigitalOcean** - $6/month, 1GB RAM
- **Hetzner** - $4.50/month, 2GB RAM (best value)
- **Linode/Akamai** - $5/month, 1GB RAM
- **Vultr** - $6/month, 1GB RAM
- **AWS Lightsail** - $5/month, 1GB RAM

#### Quick Setup (Ubuntu 22.04)

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

# 3. Install Playwright system dependencies
sudo apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2

# 4. Clone repository
git clone https://github.com/stefanautomateed/backlinker.git
cd backlinker

# 5. Install dependencies
npm install
npx playwright install chromium

# 6. Configure environment
cp .env.example .env
nano .env  # Add your API keys

# 7. Initialize database
npm start init

# 8. Test it works
npm run dashboard
# Visit http://your-ip:3001
```

#### Keep it Running with PM2

```bash
# Install PM2
sudo npm install -g pm2

# Start dashboard
pm2 start src/dashboard.js --name backlinker-dashboard

# Auto-start on server reboot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs backlinker-dashboard
```

#### Add Domain with Nginx

```bash
# Install Nginx
sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available/backlinker
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/backlinker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Add SSL (Free with Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### Option 2: Railway.app (Easiest)

Perfect for developers who want auto-deploy from GitHub.

1. Sign up at https://railway.app
2. Connect your GitHub repository
3. Add environment variables in dashboard
4. Deploy automatically!

**Pricing:** Free $5/month credit, then ~$10-20/month

#### railway.toml
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node src/dashboard.js"
restartPolicyType = "always"

[healthcheck]
path = "/api/health"
timeout = 100
interval = 30
```

---

### Option 3: Render.com

Similar to Railway, good free tier.

1. Sign up at https://render.com
2. New Web Service → Connect repository
3. Configure:
   - **Build Command:** `npm install && npx playwright install chromium`
   - **Start Command:** `node src/dashboard.js`
   - Add environment variables

**Pricing:** Free tier available, $7/month for always-on

---

### Option 4: Docker (Self-Hosted)

Run anywhere with Docker installed.

#### Dockerfile
```dockerfile
FROM node:18

# Install Playwright dependencies
RUN npx playwright install-deps chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production
RUN npx playwright install chromium

COPY . .

EXPOSE 3001

CMD ["node", "src/dashboard.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  backlinker:
    build: .
    ports:
      - "3001:3001"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - CAPTCHA_API_KEY=${CAPTCHA_API_KEY}
      - WEBSITE_URL=${WEBSITE_URL}
      - WEBSITE_NAME=${WEBSITE_NAME}
      - WEBSITE_EMAIL=${WEBSITE_EMAIL}
      - DASHBOARD_ENABLED=true
      - CAPTCHA_ENABLED=true
      - BULK_SUBMISSION_ENABLED=true
    volumes:
      - ./backlinker.db:/app/backlinker.db
      - ./logs:/app/logs
      - ./screenshots:/app/screenshots
    restart: unless-stopped
```

**Run:**
```bash
docker-compose up -d
```

---

## 🔒 Security Checklist

- [ ] Change default dashboard password in .env
- [ ] Use HTTPS (SSL certificate)
- [ ] Restrict dashboard to specific IPs if possible
- [ ] Keep API keys secure (never commit to git)
- [ ] Update Node.js and dependencies regularly
- [ ] Enable firewall (ufw on Ubuntu)
- [ ] Set up automatic backups of database

## 📊 Resource Requirements

### Minimum
- **CPU:** 1 core
- **RAM:** 1GB
- **Storage:** 10GB
- **Bandwidth:** 100GB/month

### Recommended
- **CPU:** 2 cores
- **RAM:** 2GB
- **Storage:** 20GB
- **Bandwidth:** 500GB/month

### For Heavy Use (100+ directories/day)
- **CPU:** 4 cores
- **RAM:** 4GB
- **Storage:** 50GB
- **Bandwidth:** 1TB/month

## 🚀 Performance Tips

1. **Use headless browser** - Set `HEADLESS_BROWSER=true`
2. **Limit concurrent browsers** - Start with `PARALLEL_BROWSERS=3`, increase if stable
3. **Add delays** - Adjust `DELAY_BETWEEN_SUBMISSIONS_MS` to avoid rate limits
4. **Monitor resources** - Use `htop` or similar
5. **Enable CAPTCHA solving** - Increases success rate dramatically

## 📈 Scaling

### Vertical Scaling (Upgrade Server)
- 1GB → 2GB RAM: Handle 2x more concurrent browsers
- 2GB → 4GB RAM: Handle 5+ concurrent browsers

### Horizontal Scaling (Multiple Servers)
- Run multiple instances
- Use shared database (PostgreSQL instead of SQLite)
- Implement job queue (Redis/Bull)

## 🐛 Troubleshooting

### Playwright fails to launch
```bash
# Install missing dependencies
sudo npx playwright install-deps chromium
```

### Out of memory errors
```bash
# Check memory usage
free -h

# Reduce PARALLEL_BROWSERS in .env
PARALLEL_BROWSERS=2
```

### Database locked errors
```bash
# Only one process should access SQLite at a time
# Use PM2 to ensure single instance
pm2 list
```

### Port already in use
```bash
# Check what's using port 3001
sudo lsof -i :3001

# Change port in .env
DASHBOARD_PORT=3002
```

## 📞 Support

For deployment issues:
1. Check logs: `pm2 logs` or `docker logs`
2. Verify environment variables are set
3. Ensure all dependencies installed
4. Check firewall rules
5. Review screenshots folder for errors

## 🎯 Recommended Setup for Production

**Provider:** DigitalOcean Droplet ($6/month)
- Ubuntu 22.04
- 1GB RAM, 1 CPU
- Node.js 18 + PM2
- Nginx reverse proxy
- Let's Encrypt SSL
- Daily database backups

Total cost: **$6/month** + API costs ($2-7 per 158 directories)
