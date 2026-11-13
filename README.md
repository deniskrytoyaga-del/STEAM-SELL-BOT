# Steam Sale Bot

Telegram bot that reads Steam's featured Specials feed and sends discounted games sorted by discount percentage.

## Setup
1. In GitHub repository Settings → Secrets and variables → Actions, create repository secret named `BOT_TOKEN`.
2. Paste the token from BotFather into the secret value. Never commit the token to files.
3. In Settings → Actions → General, allow GitHub Actions to read and write repository contents.
4. Open Actions → Steam Sale Bot → Run workflow once.
5. Open the Telegram bot and send `/start`.

## How it works
GitHub Actions runs every 5 minutes and checks Telegram updates. This is a free, scheduled workaround, not a continuously running server; button responses can take up to about 5 minutes. GitHub may delay scheduled workflows, especially during busy periods.

Steam data comes from the Steam Store featured Specials feed and is not guaranteed to include every discounted game in the entire store. Prices are requested in RUB.

## Commands
- `/start` — show the welcome message and keyboard
- `/deals` — show current deals
- `/help` — help


## Run on Cloudflare Workers (instant webhook)

The repository now includes `cloudflare-worker.js`. This is the recommended way to run the bot; it receives Telegram updates through a webhook instead of waiting for a scheduled GitHub Actions run.

1. Open Cloudflare Dashboard → Workers & Pages → Create → Worker. Give it a name and deploy the starter Worker.
2. Open the Worker → Edit code. Replace the starter code with the complete contents of `cloudflare-worker.js` from this repository, then Deploy.
3. Open Worker → Settings → Variables and Secrets. Add these three values as **Secrets**:
   - `BOT_TOKEN` — token from @BotFather.
   - `WEBHOOK_SECRET` — create a private random string (letters and numbers; 30+ characters).
   - `SETUP_SECRET` — create a different private random string (30+ characters).
4. After saving the secrets and deploying, open this address in your browser, replacing the parts in angle brackets:
   `https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/setup?key=YOUR-SETUP-SECRET`
5. The page should return JSON with `"ok": true`. Then open the Telegram bot and send `/start`.

Do not paste any of these secrets into GitHub files or send them in chat. If you previously enabled the GitHub Actions polling workflow, disable its schedule to avoid two bot processes competing for updates.

The Worker responds to Telegram via webhook, so it does not wait for a five-minute GitHub Actions schedule. It fetches current Steam Specials when the user requests deals.
