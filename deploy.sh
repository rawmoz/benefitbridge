#!/usr/bin/env bash
# Run on a fresh Vultr Ubuntu server as root:  bash deploy.sh
# Needs a .env file next to this script (copy .env.example and fill it in).
set -euo pipefail
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
fallocate -l 2G /swapfile 2>/dev/null && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile || true
docker build -t benefitbridge .
docker rm -f benefitbridge 2>/dev/null || true
docker run -d --name benefitbridge --restart unless-stopped --env-file .env -p 80:3000 benefitbridge
ufw allow 80/tcp 2>/dev/null || true
echo "Live at: http://$(curl -s ifconfig.me)"
