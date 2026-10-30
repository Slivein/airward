# Airward (SkyIdle)

An idle airline manager. Start a brand, build a pixel-art airport, buy aircraft, open routes, and unlock automation as you level up.

**Play:** https://airward-six.vercel.app

## How to play
- **Airport tab:** a close-up isometric airport you lay out yourself, on a 60×60 map you unlock a block at a time. With Select active, drag to pan; with a build tool active, drag to lay a whole run of tiles in one go. The zoom button cycles close / wide / whole map. Pinch with two fingers, or pinch the trackpad, to zoom around the point you are holding. Two views, **Terminal** and **Airside**, each with its own camera and zoom: indoors is drawn at nearly twice the scale so the amenities actually read, and each shows only its own tools. Picking a tool takes you to the half it belongs to. Use the toolbar to switch tools: on a phone the Terminal and Airside groups fold behind a header that names the tool you have selected.
  - **Land** — the 60×60 map is twenty-five 12×12 blocks and you start on one of them: a narrow hall, one stand and a short runway. Every locked block next to land you own shows its price on the map; tap it in Select mode to buy. Blocks further from your terminal cost more, and anything three blocks out also costs **flight tokens**. Blocks in the top row widen the terminal hall and the landside plots; the rest give you more airside.
  - **Terminal interior** (14 types: Check-in, Security, Vending, Newsstand, Cafe, Restaurant, Duty-free, Currency Exchange, Premium Lounge, Seating, Play Area, Restroom, plus two that work by proximity — Indoor Garden and Information Desk) — place these inside the terminal hall. Passengers walk in, queue at check-in, clear security, then spend money at your shops. Every passenger needs a check-in desk and a security lane or they give up and walk out. Long queues sour their mood, which feeds your brand rating. Shops trade off speed against spend — a vending machine serves a crowd for pennies, a lounge earns a fortune but ties a passenger up. A garden lifts the mood of anyone standing near it; an information desk placed beside a queue makes people far more patient. Happy passengers browse an extra shop. **Your terminal sets your load factor:** anyone who runs out of patience in a queue, or finds no desk to use, walks out, and your flights leave with the seats those people would have filled — from x1.00 down to x0.55. More desks, a garden or an information desk beside a queue all cut the walk-outs.
  - **Select** — tap a plot to build a facility, a building to upgrade it, or a plane to dispatch/service it. Anything you tap on the map — a plot, a building, a facility, a stand, an aircraft, a runway or a block of land for sale — opens its card floating over the scene, on the side away from what you tapped, so you can still see it. The card under the scene keeps showing the airport summary.
  - **Stand** — drop a 3x3 parking stand (one per gate slot you own). Plane *n* parks at stand *n*.
  - **Taxiway** — drag to paint the route from each stand to a runway. A plane with no connected route cannot depart, and taxiways cannot cross a runway.
  - **Runway** — drag sideways to lay tiles; the run stays in the row you started on. One aircraft uses a runway at a time: a departure holds at its stand rather than rolling while another is landing, so a busy airport needs roughly one runway per four aircraft. Every line of 2+ tiles is its own runway at 250 m per tile, so you can build several. Bigger aircraft need longer runways. A stand uses the longest runway its taxiways reach, and one runway launches one aircraft at a time, so a second runway clears a departure queue.
  - **Demolish** — remove a tile or stand; tiles refund half.
  - **Rebuild airport layout** (in the Select panel) — clears the airside and lays the current standard layout, sized to your fleet. You pay full price for the new tiles and the old ones are not refunded.
- **Speed:** the buttons beside the tabs pause the game or run it at normal, 2x or 4x. Pause really stops everything — no time passes for the airline — and the speed resets to normal when you reload. Time away from the game always counts at normal speed.
- **Departures board:** under the airport scene, every aircraft with its route, what it is waiting for and which strip it uses, blocked ones first. If several are queueing it says so and tells you to build another runway.
- **Early game is manual:** dispatch flights, buy fuel, run maintenance checks and offset carbon yourself.
- **Automation unlocks by level:** airport operations (3), fuel procurement (5), maintenance (7), carbon offsets (9), network planning (12), which also lays a second runway when aircraft start queueing for the first. They stay unlocked after your first IPO.
- **Fuel and carbon:** fuel prices swing with the market; CO₂ above your allowance is hit with a levy.
- **Runway licences:** a licence caps how long a runway you may build, and a longer runway is what lets a bigger aircraft fly at all. Each of the seven tiers opens exactly one more aircraft, and each needs more of the map unlocked before you can buy it — 2 blocks for 1000 m up to 18 for 3000 m — plus cash and flight tokens. Runways you already built are never shortened.
- **Flight tokens:** a second currency, spent only on distant land. You earn one per level (three every fifth level), a lump for each of the 15 achievements (flights flown, routes open, fleet size, lifetime revenue, brand rating, terminal mood, first IPO), and two whenever an airshow charter event fires. The Company tab lists them all. Tokens, achievements and land survive an IPO.
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
