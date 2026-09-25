# Deploying cvlint on a VPS

The stack is two containers behind Docker Compose:

- **web**: the Next.js standalone server (non-root, read-only filesystem, no internet access).
- **caddy**: reverse proxy with automatic HTTPS (Let's Encrypt), HTTP/2 and HTTP/3.

Any Linux VPS with 1 GB of RAM is enough.

## 1. Prepare the server

```bash
# Docker Engine + Compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out and back in afterwards

# Firewall: only SSH, HTTP and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

## 2. Point the domain

Create an `A` record (and `AAAA` for IPv6) for `cvlint.righi.dev` pointing to the VPS IP.
If the domain was attached to a Vercel project, remove it there first.

## 3. Deploy

```bash
git clone https://github.com/righibe/cvLint.git cvlint
cd cvlint
cp .env.example .env      # adjust SITE_DOMAIN / NEXT_PUBLIC_SITE_URL if needed
docker compose up -d --build
docker compose ps         # web should be "healthy"
```

Caddy obtains the certificate on the first request. Logs: `docker compose logs -f caddy web`.

## 4. Update

```bash
cd cvlint
git pull
docker compose up -d --build
docker image prune -f
```

## Notes

- `NEXT_PUBLIC_SITE_URL` is inlined at build time: rebuild after changing it.
- Certificates live in the `caddy_data` volume; keep it between deploys to avoid Let's Encrypt rate limits.
- Security headers and the CSP are set by the app (`next.config.ts`, `src/proxy.ts`), not by Caddy.
