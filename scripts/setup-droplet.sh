#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04+ Droplet.
# Run as root: bash scripts/setup-droplet.sh [deploy-user] [your-domain-or-ip]
set -euo pipefail

DEPLOY_USER="${1:-deploy}"
SERVER_NAME="${2:-_}"

# ── Nginx ──────────────────────────────────────────────────────────────────────
apt-get update -q
apt-get install -y -q nginx

# ── Web root ───────────────────────────────────────────────────────────────────
mkdir -p /var/www/hyperprepapp
chown -R www-data:www-data /var/www/hyperprepapp

# ── Deploy user (passwordless SSH, rsync only) ─────────────────────────────────
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$DEPLOY_USER"
fi
mkdir -p /home/"$DEPLOY_USER"/.ssh
chmod 700 /home/"$DEPLOY_USER"/.ssh
touch /home/"$DEPLOY_USER"/.ssh/authorized_keys
chmod 600 /home/"$DEPLOY_USER"/.ssh/authorized_keys
chown -R "$DEPLOY_USER":"$DEPLOY_USER" /home/"$DEPLOY_USER"/.ssh

# Allow the deploy user to write to the web root
chown -R "$DEPLOY_USER":www-data /var/www/hyperprepapp
chmod -R 775 /var/www/hyperprepapp

# ── Nginx site config ──────────────────────────────────────────────────────────
CONF=/etc/nginx/sites-available/hyperprepapp
cat > "$CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    root /var/www/hyperprepapp;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript text/javascript image/svg+xml;
}
NGINX

ln -sf "$CONF" /etc/nginx/sites-enabled/hyperprepapp
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo ""
echo "Droplet is ready."
echo ""
echo "Next steps:"
echo "  1. Add your GitHub Actions public SSH key to /home/$DEPLOY_USER/.ssh/authorized_keys"
echo "  2. Add these secrets to your GitHub repo (Settings → Secrets → Actions):"
echo "       DROPLET_HOST   = $(curl -s ifconfig.me 2>/dev/null || echo '<your-droplet-ip>')"
echo "       DROPLET_USER   = $DEPLOY_USER"
echo "       DROPLET_SSH_KEY = <private key matching the public key above>"
echo "       VITE_SUPABASE_URL       = https://your-project.supabase.co"
echo "       VITE_SUPABASE_ANON_KEY  = your-anon-key"
echo ""
echo "  3. Push to main — the deploy-droplet workflow will rsync the built app to this server."
