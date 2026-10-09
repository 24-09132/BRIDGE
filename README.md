# FLOOD-SENTINEL

Rainfall and River Water Level Based Road Impassability Probability Model with Automated SMS Notification – Pook, Barangay Simlong.

| Part | File(s) |
|---|---|
| ESP32 firmware (sensors, model, LEDs, SIM800L SMS, cloud upload) | `BRIDGE.ino` |
| Website – Sign-in page | `index.html` |
| Website – Live Monitor | `live.html`, `live.js` |
| Website – Simulation (weather presets) | `simulation.html`, `sim.js` |
| Website – Trial Results (Figure 2) | `trial.html`, `trial.js` |
| Shared website code | `common.js` (monitor panels, Excel recorder), `model.js` (model), `xlsx.js` (Excel writer), `style.css` |
| Cloud API (Vercel serverless + Upstash Redis) | `api/telemetry.js`, `api/history.js`, `api/control.js`, `api/login.js`, `api/session.js`, `api/_db.js` |
| Local test server (no Vercel needed) | `web_dashboard/server.js` (`npm start`) |

## Sensors (3 water level sensors)

| No. | Sensor | ESP32 pin | Measures |
|---|---|---|---|
| S1 | Rain collector water level sensor | 33 | Rainfall (mm) and rain rate (mm/h) |
| S2 | Pook-side river water level sensor | 34 | Pook-side water level (cm) |
| S3 | Bay-connected river water level sensor | 35 | Bay-connected river water level (cm) |

LEDs: Green 25, Blue 14, Yellow 26, Red 27 · SIM800L: RX 16, TX 17.

## Flood probability model

```
z = −3.9822 + 0.2208·Rainfall(mm) + 0.7994·Pook-side level(cm) + 1.2461·Bay-connected level(cm)
P = 100 / (1 + e^(−z))   (%)
```

| Flood probability | Road condition | LED | SMS |
|---|---|---|---|
| below 10 % | Passable | Green | ROAD PASSABLE |
| 10 % to below 50 % | Restricted | Blue | ROAD RESTRICTED |
| 50 % to below 75 % | More Restricted | Yellow | ROAD HIGHLY RESTRICTED |
| 75 % and above | Impassable | Red | ROAD IMPASSABLE |

The same coefficients and thresholds are in `BRIDGE.ino`, `model.js` and the Excel workbook (`Model` sheet).
They reproduce every flood probability in the paper's Figure 2. If you change one, change all three.

## Deploy the website to Vercel

1. **GitHub** – put this folder in a GitHub repository on your account.
2. **Vercel** – sign in at vercel.com with GitHub → **Add New → Project** → import the repository → **Deploy**.
   No build settings are needed.
3. **Database** – in the project: **Storage → Create Database → Upstash (Redis)** → connect it to the project.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
4. **API key** – **Settings → Environment Variables** → add `bridge_key` = `bridgingthegap`
   (or your own key; then use the same key in `BRIDGE.ino`, `VERCEL_API_KEY`).
5. **Sign-in** – in the same place add `ADMIN_USER` and `ADMIN_PASS` (the username and password for the website).
   If they are not set, the sign-in is `admin` / `admin`. Optionally add `SESSION_SECRET` (any long random text).
   The password is checked on the server; it is never written in the website's code.
6. **Redeploy** – **Deployments → ⋯ → Redeploy** so the database, key and sign-in are picked up.
7. Your site is at `https://<project-name>.vercel.app`. It opens on the sign-in page; every page and the
   website's data need sign-in. Sign-in lasts 12 hours or until **Sign out**.

## Connect the ESP32

In `BRIDGE.ino` set:

```cpp
const char* WIFI_SSID     = "your Wi-Fi name";
const char* WIFI_PASSWORD = "your Wi-Fi password";
#define VERCEL_HOST       "<project-name>.vercel.app"   // no https://, no slash
#define VERCEL_API_KEY    "bridgingthegap"
```

`VERCEL_API_KEY` must be the same as `bridge_key` in Vercel (default `bridgingthegap`).

Upload. The Serial Monitor shows `[VERCEL] Telemetry pushed ... HTTP 200` every 60 s and the website's
**Live Monitor** page shows "Online". If no data arrives for 150 s it shows "Offline".

The ESP32 uploads every 60 s, and immediately when the road condition changes. It checks `/api/control`
every 10 s. This keeps usage inside the free Vercel Hobby (1,000,000 function invocations/month) and
Upstash (500,000 commands/month) limits.

## Drive the real device from the website (demonstration)

On **Simulation** or **Trial Results**, tick **Send to the FLOOD-SENTINEL device**. The ESP32 then uses the
website's values instead of its sensors: the same 4 LEDs light and the Live Monitor shows **DEMO MODE**.
**Also send real SMS to the 10 numbers** is on by default; untick it to show the LEDs only.

- During a demonstration the SMS rule is shortened: a new condition is sent after it has stayed the same
  for 15 s (Impassable immediately). A jump from Clear to Flood sends one SMS only.
- Untick the box, or close the page, and the device returns to its real sensors (within 60 s at most).
- The Serial Monitor shows `DEMO` lines while the website is in control.

## Test without hardware

- Website: open **Simulation**, pick a weather preset (Clear & Dry … Flood Emergency) and press Start.
  **Trial Results** replays Figure 2. Every page has a **Download Excel** button (paper Figure 2 format).
- Local server: `npm install`, then `npm start`, open `http://localhost:3000`, sign in, then post a reading:

```bash
curl -X POST http://localhost:3000/api/telemetry -H "x-api-key: bridgingthegap" \
  -d '{"rainfall_mm":11.6,"pook_cm":1.8,"bay_cm":1.3,"flood_prob":83.7,"road_class":3,"road_condition":"IMPASSABLE"}'
```

## Serial Monitor commands (115200 baud, Newline)

`AUTOCAL` automatic calibration of all sensors (dry → water touching → strips covered, no ruler) · `AUTOCAL S1..S3` one sensor ·
`MON` status on/off · `SMSTEST` test SMS · `SMSRESET` reset saved road state ·
`CAL S1..S3`, `CAL <mm>`, `CAL LIST`, `CAL UNDO`, `CAL CLEAR`, `CAL DEFAULT`, `CAL DONE` (calibration; SMS paused while calibrating)

FLOOD-SENTINEL is a research and decision-support prototype. It does not replace official flood warnings,
road closures, evacuation orders or instructions from local authorities.
