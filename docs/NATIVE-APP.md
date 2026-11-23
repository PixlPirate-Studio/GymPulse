# Building a phone app for GymPulse

GymPulse is designed so a real iPhone or Android app can talk to **each person's own server**. There is no company server and no shared database. Whoever wants to use the app runs their own GymPulse (Unraid, a Raspberry Pi, a cheap VPS) and types its address into the app.

## How an app connects

1. **Ask for the server address**, for example `https://gym.example.com`.
2. `GET /api/v1/server` (no sign-in). If the answer has `"app": "gympulse"`, it is a GymPulse server. It also reports `api_version`, `features` (so the app can hide things an older server lacks), `needs_setup`, and the sign-in methods.
3. **Sign in** one of three ways:
   - `POST /api/v1/auth/token` with `{"username","password","device_name"}`
   - `POST /api/v1/auth/token` with `{"code":"ABCD-2345","device_name"}` using a pairing code made in the web app (Settings → Connect another device). The person never types the password on the phone.
   - `POST /api/v1/invite/<token>/accept` from an invite link, with `device_name` to get a token back.
4. Keep the returned token (`gp_...`) in the iOS Keychain or Android Keystore. Send `Authorization: Bearer <token>` on every call. No cookies or special headers are needed.
5. Sign out with `POST /api/v1/auth/revoke`. People can also remove a device from Settings.

Tokens are stored on the server only as hashes and can be limited to a `health` scope (can only send health numbers).

## Working offline

- Keep a workout on the phone and send it with `POST /api/v1/sync/workout` (see `API.md`). It is matched by an id the app makes up (`cid`), so sending it twice never duplicates.
- Add the header `Idempotency-Key: <random>` to any POST/PUT/DELETE. If the app retries after a dropped connection, the server returns the first answer instead of repeating the action.

## What a store app would still need (not built)

- **Push notifications.** The server sends Web Push, which iPhones deliver only to the web app. A store app needs Apple's push service (APNs). Because every person runs their own server, each would need their own Apple push key, or you would need to run a small relay. This is the hardest part of the "everyone self-hosts" design.
- **Apple Health.** A native app can read steps, heart rate and workouts directly and send them to `POST /api/v1/health`. The web app uses a Shortcut instead.
- **Apple Developer Program** (paid yearly) and App Store review. Apple's review will want a demo server or demo account for the reviewer.
- **HTTPS.** iOS apps only talk to https addresses by default, which the Cloudflare tunnel already provides.

## Versioning

The API is under `/api/v1/`. Fields are added over time but not removed or renamed within v1. A breaking change would appear as `/api/v2/` and `api_version` in the discovery call would list it.
