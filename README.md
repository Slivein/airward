# Airward (SkyIdle)

An idle airline manager. Start a brand, build a pixel-art airport, buy aircraft, open routes, and unlock automation as you level up.

**Play:** https://airward-six.vercel.app

## How to play
- **Airport tab:** tap an empty plot to build a facility, tap a building to upgrade it, tap a plane to dispatch or service it, and tap the dashed `+` stand to add a gate.
- **Early game is manual:** dispatch flights, buy fuel, run maintenance checks and offset carbon yourself.
- **Automation unlocks by level:** airport operations (3), fuel procurement (5), maintenance (7), carbon offsets (9), network planning (12). They stay unlocked after your first IPO.
- **Fuel and carbon:** fuel prices swing with the market; CO₂ above your allowance is hit with a levy.
- **IPO:** from level 10, restart with permanent shares that boost revenue.
- Progress is saved in your browser. Offline earnings (up to 12h) only count for what you have automated.

## Run locally
No build step. Open `index.html` in a browser, or serve the folder:

```bash
npx http-server -p 8080
```

## Project layout
- `index.html`: page shell
- `style.css`: UI styles
- `game.js`: game state, economy, simulation, pixel airport scene and UI

Balance numbers live in the `TYPES`, `UPG` and `AUTO` tables at the top of `game.js`.

## Deploy
Static site, hosted on Vercel. Every push to `main` redeploys.
