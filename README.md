# Airward (SkyIdle)

An idle airline manager. Start a brand, build a pixel-art airport, buy aircraft, open routes, and unlock automation as you level up.

**Play:** https://airward-six.vercel.app

## How to play
- **Airport tab:** an isometric airport you lay out yourself. Use the toolbar to switch tools:
  - **Select** — tap a plot to build a facility, a building to upgrade it, or a plane to dispatch/service it.
  - **Stand** — drop a 3x3 parking stand (one per gate slot you own). Plane *n* parks at stand *n*.
  - **Taxiway** — paint the route from each stand to the runway. A plane with no connected route cannot depart.
  - **Runway** — lay tiles in a straight line; the longest line is your active runway, 250 m per tile. Bigger aircraft need longer runways, so you must extend it before you can buy them.
  - **Demolish** — remove a tile or stand; tiles refund half.
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
