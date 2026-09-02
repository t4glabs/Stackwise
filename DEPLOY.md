# Deploying welive-lms to the Hetzner box

This sits next to your existing Ghost and Strapi/Next.js apps in `/var/www`, as its own
folder, its own pm2 process, and its own Postgres database. Nothing here touches those
other apps.

## 0. One-time server prerequisites

```bash
# Postgres, if you don't already have one running for another project
sudo apt update && sudo apt install -y postgresql

sudo -u postgres psql -c "CREATE DATABASE welive_lms;"
sudo -u postgres psql -c "CREATE USER welive_lms WITH ENCRYPTED PASSWORD '<pick-a-password>';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE welive_lms TO welive_lms;"
```

If Strapi already runs a Postgres instance on this box, reuse it — just add a new
database + role inside it rather than installing a second Postgres.

Node 20.9+ is required (Next.js 16). Confirm with `node -v`; install/upgrade via nvm if needed.

## 1. Get the code onto the box

```bash
cd /var/www
git clone <your-repo-url> welive-lms   # or scp the project up
cd welive-lms
npm ci
```

## 2. Configure environment

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

```bash
# .env
DATABASE_URL="postgresql://welive_lms:<password>@localhost:5432/welive_lms"
AUTH_SECRET="$(openssl rand -base64 32)"

BOOKSTACK_BASE_URL="https://books.humansofwelive.org"
BOOKSTACK_TOKEN_ID="..."       # BookStack > user profile > API Tokens (needs "Access System API")
BOOKSTACK_TOKEN_SECRET="..."
BOOKSTACK_WEBHOOK_SECRET="$(openssl rand -hex 16)"

ORG_NAME="WeLive Foundation"
ORG_SLUG="welive"
```

`chmod 600 .env` — it holds the BookStack token and DB credentials.

## 3. Set up BookStack

1. In BookStack, create (or reuse) a service-account user, give it the **"Access
   System API"** system permission, then generate an API Token on that user's profile.
   Put the Token ID/Secret in `.env` above.
2. Tag the books you want published as courses — see the tag taxonomy in the
   architecture plan (`lms_publish=true`, `lms_type=...`, `lms_program=...`, etc.).
3. Settings > Webhooks > add a webhook pointed at:
   `https://lms.humansofwelive.org/api/webhooks/bookstack?secret=<BOOKSTACK_WEBHOOK_SECRET>`
   Trigger it on page/chapter/book created/updated/deleted events.

## 4. Database + first build

```bash
npm run db:deploy   # applies prisma/migrations against Postgres
npm run db:seed      # creates the org + admin/facilitator/learner accounts
                      # (pulls the real BookStack catalog automatically, since a
                      # token is now configured — see prisma/seed.ts)
npm run build
```

**Change the seeded admin/facilitator/learner passwords immediately** — `prisma/seed.ts`
uses fixed dev passwords (`admin123` etc.) that are fine for local testing but not for
a real deployment. Either edit them directly in the DB or add a proper "change password"
flow before rollout.

## 5. Start with pm2

```bash
pm2 start ecosystem.config.js
pm2 save            # persist across reboots (pm2 startup should already be configured
                     # from your other projects)
```

Check `pm2 list` first and change the `PORT` in `ecosystem.config.js` if `3300` is
already taken by another app on this box.

## 6. Nginx + TLS

Create `/etc/nginx/sites-available/lms.humansofwelive.org` (a new file — this does not
touch your existing Ghost/Strapi server blocks):

```nginx
server {
    server_name lms.humansofwelive.org;

    location / {
        proxy_pass http://127.0.0.1:3300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lms.humansofwelive.org /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lms.humansofwelive.org
```

## 7. Sync backstop (cron)

The BookStack webhook keeps the catalog fresh in near-real-time. Add a cron job as a
backstop in case a webhook delivery is ever missed:

```bash
crontab -e
# every 20 minutes
*/20 * * * * curl -fsS "https://lms.humansofwelive.org/api/sync?secret=<BOOKSTACK_WEBHOOK_SECRET>" >/dev/null
```

## 8. Backups

Content itself lives in BookStack and is that system's own backup concern, unchanged
by this project. Back up this app's Postgres database (enrollment/progress/accounts):

```bash
crontab -e
# nightly at 2am
0 2 * * * pg_dump welive_lms | gzip > /var/backups/welive-lms-$(date +\%F).sql.gz
```

## Redeploying after changes

```bash
cd /var/www/welive-lms
git pull
npm ci
npm run db:deploy   # only if there are new migrations
npm run build
pm2 reload welive-lms
```
