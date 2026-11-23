# GymPulse

A self-hosted workout timer, food diary, body-stats tracker and friends feed. One small container, one database file, no outside services needed to run. Installs on an iPhone as a web app.

## What it does

- Sign in with a username and password. The first account is the admin. The admin adds people, or sends them an **invite link** so they pick their own password.
- Everyone can set a display name (Settings). Friends, the leaderboard, activity and recipes show the display name, never the login username.
- A beginner routine you can fully change, with any number of named workouts. Tap sets as you finish them and the rest timer starts. Timed exercises (treadmill, elliptical) have a Start button.
- **Weight and reps for every set**, a "last time" reminder under each exercise, and automatic **personal bests**.
- **Works with no signal.** A workout in progress is kept on the phone and uploaded when you are back online. Weight, water, food and measurement entries made offline wait in a queue and sync later.
- **How-to cards** for 26 common exercises (written steps, no videos), plus an "add to my workout" library.
- Lock-screen alerts when a rest ends, and **scheduled workout reminders** (Web Push, mirrors to Apple Watch).
- Body stats in lb and ft/in: BMI, healthy range, daily calories, weight chart, **body measurements**, **private progress photos**, streak and CDC weekly goals.
- Food diary with calories and macros: 38 built-in foods, the free USDA database (optional import), packaged foods by **camera barcode scan** or number (Open Food Facts), your own foods, **saved meals**, **copy yesterday**, **water tracking**, and a **grocery list** you can fill from any recipe.
- Friends: leaderboard, activity feed, **emoji reactions**, **nudges**, **challenges** (team or race), **20 badges**, and in-app notifications. Shared recipes with tips.
- **Apple Health steps** by an iPhone Shortcut (see below).
- Admin tools: add people, invite links, reset passwords, turn people off, download a backup. Nightly backups are kept in your appdata folder.
- **Ready for a future phone app.** Every person runs their own server; an app only needs the server address. See `docs/NATIVE-APP.md` and `docs/API.md`.

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

## Apple Health steps

A web app cannot read Apple Health itself. Instead, in **Body → Apple Health steps → Set up** the app makes a private key and shows the exact Shortcut steps. The key can only send health numbers; it cannot read anything. You can remove it any time in Settings.

## Optional: another layer of protection with Cloudflare Access

Your Cloudflare tunnel makes the app reachable from the internet. GymPulse has its own login, rate limiting and secure cookies, which is enough for most people. If you want a second door, add a Cloudflare Access policy (Zero Trust → Access → Applications) for your hostname, such as "allow these email addresses". Two cautions: the iPhone home-screen app then needs you to sign in through Cloudflare as well, and a future phone app would need a bypass rule for `/api/v1/*` because it cannot do the Cloudflare web login. Start without it and add it later if you want.

## Not included yet

Apple Watch app, a kg option, "Easy" tags on recipes, and a store-ready phone app (the server is built for one, see `docs/NATIVE-APP.md`). Lock-screen alerts need iOS 16.4+ and the Home Screen install. Safari on iPhone has no built-in barcode reader, so scanning uses a bundled one that works but can be slower than typing in dim light.

## Backups

Everything lives in `/config`: `gympulse.db`, `photos/` (progress photos), `vapid_private.pem` (alert key), `secret_key` (keeps people signed in) and `backups/`. The nightly backup copies the database; copy `photos/` too if you want those safe.

Fonts (Inter and JetBrains Mono) are bundled in `static/fonts` under the SIL Open Font License, so the app never calls Google Fonts. The barcode reader (ZXing, Apache 2.0) is bundled in `static/vendor`.

Optional setting: `GYMPULSE_SERVER_NAME` changes the name apps and invite pages show.

Built from scratch for personal use. GymPulse does not contain code from other fitness apps.
