# GymPulse

A self-hosted workout timer, food diary, body-stats tracker and friends feed. One small container, one database file, no outside services needed to run. Installs on an iPhone as a web app.

## What it does

- Sign in with a username and password. The first account is the admin; the admin adds everyone else.
- A beginner routine (editable). Tap sets as you finish them and the rest timer starts. Timed exercises (treadmill, elliptical) have a Start button.
- Lock-screen alerts when a rest ends (Web Push, mirrors to Apple Watch).
- Body stats in lb and ft/in: BMI, healthy weight range, daily calories, weight chart, streak and weekly CDC goals.
- Food diary with calories and macros. Search 38 built-in foods, import the free USDA database for thousands more, look up packaged foods by barcode number (Open Food Facts), or add your own.
- Friends: leaderboard, activity feed, cheers. Shared recipes with tips.
- Admin tools: add people, reset passwords, turn people off, download a backup. Nightly backups are kept in your appdata folder.

## Put it on GitHub

1. On github.com click **+ → New repository**. Name it `gympulse`. Leave it empty (no README). Click **Create repository**.
2. On the new repo page click **uploading an existing file**.
3. Drag in **everything** from the unzipped `gympulse` folder, including the `static`, `tests`, `unraid` and `.github` folders. On a Mac press **Cmd + Shift + .** in Finder to show the hidden `.github` folder.
4. Click **Commit changes**.
5. Click the **Actions** tab. A run called "Build and publish image" starts by itself and takes a few minutes. Wait for the green check.
6. Go to your profile → **Packages → gympulse → Package settings** and set **Change visibility → Public**, so Unraid can pull it without a login.

## Install on Unraid

1. **Docker** tab → **Add Container**.
2. Fill in:
   - Name: `GymPulse`
   - Repository: `ghcr.io/thepixlpirate/gympulse:latest`
   - Add a **Port**: container 8080, host 8765.
   - Add a **Path**: container `/config`, host `/mnt/user/appdata/gympulse`.
   - Add a **Variable**: `GYMPULSE_SECURE_COOKIES` = `1` (use `0` if you only use plain http on your LAN).
   - Add a **Variable**: `TZ` = `America/Indiana/Indianapolis`.
3. **Apply**. Open `http://YOUR-UNRAID-IP:8765` and create the admin account.

(`unraid/gympulse.xml` is the same thing as a template if you want to drop it in `/boot/config/plugins/dockerMan/templates-user/`.)

## HTTPS and Cloudflare

iPhones only allow home-screen apps to send alerts over https. Add a Cloudflare Tunnel public hostname (for example `gym.yourdomain.com`) pointing to `http://YOUR-UNRAID-IP:8765`.

## Install on iPhone

1. Open your https address in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open GymPulse from the Home Screen icon.
4. **More → Turn on lock-screen alerts** and allow notifications. Needs iOS 16.4 or newer.
5. Tap **Send a test**, then lock your phone.

## Optional: more foods from the USDA

1. Download "SR Legacy" (CSV) from <https://fdc.nal.usda.gov/download-datasets> and unzip it.
2. Copy the unzipped folder into `/mnt/user/appdata/gympulse/usda`.
3. In Unraid, open the GymPulse container's **Console** and run:

       python import_usda.py /config/usda

Values are per 100 g.

## Updating

Push changes to GitHub, wait for the green check, then in Unraid click the container's icon → **Force update**. Your data stays in appdata.

## Not included yet

Apple Health (a web app cannot read it; it needs a native app), progress photos, badges, personal records, per-set weights and reps, camera barcode scanning (type the number instead), a kg option, and "Easy" difficulty tags on recipes.

## Backups

Everything lives in `/config`: `gympulse.db`, `vapid_private.pem` (alert key), `secret_key` (keeps people signed in) and `backups/`.

Fonts (Inter and JetBrains Mono) are bundled in `static/fonts` under the SIL Open Font License, so the app never calls Google Fonts.

Built from scratch for personal use. GymPulse does not contain code from other fitness apps.
