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
