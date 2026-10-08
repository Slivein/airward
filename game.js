'use strict';
/* SkyIdle — an idle airline manager. Pure client-side, saves to localStorage. */

const SAVE_KEY = 'skyidle_save_v1';
const GROUND = 30;           // condition below which an aircraft is grounded
const OFFLINE_CAP = 12 * 3600;

/* ---------- static data ---------- */
const AIRPORTS = [
  ['JFK','New York',40.64,-73.78,10],['LAX','Los Angeles',33.94,-118.41,9],['ORD','Chicago',41.97,-87.9,8],
  ['ATL','Atlanta',33.64,-84.43,8],['MIA','Miami',25.79,-80.29,6],['SFO','San Francisco',37.62,-122.38,7],
  ['YYZ','Toronto',43.68,-79.63,6],['MEX','Mexico City',19.44,-99.07,7],['GRU','São Paulo',-23.43,-46.47,8],
  ['EZE','Buenos Aires',-34.82,-58.54,5],['BOG','Bogotá',4.7,-74.15,5],['HNL','Honolulu',21.32,-157.92,3],
  ['LHR','London',51.47,-0.45,10],['CDG','Paris',49.01,2.55,9],['AMS','Amsterdam',52.31,4.76,7],
  ['FRA','Frankfurt',50.04,8.56,8],['MAD','Madrid',40.47,-3.56,6],['FCO','Rome',41.8,12.25,6],
  ['ARN','Stockholm',59.65,17.92,4],['IST','Istanbul',41.26,28.74,8],['DXB','Dubai',25.25,55.36,9],
  ['DOH','Doha',25.27,51.61,5],['CAI','Cairo',30.12,31.4,6],['JNB','Johannesburg',-26.14,28.24,5],
  ['LOS','Lagos',6.58,3.32,5],['NBO','Nairobi',-1.32,36.93,4],['DEL','Delhi',28.56,77.1,9],
  ['BOM','Mumbai',19.09,72.87,8],['SIN','Singapore',1.36,103.99,8],['KUL','Kuala Lumpur',2.75,101.71,5],
  ['BKK','Bangkok',13.69,100.75,7],['CGK','Jakarta',-6.13,106.66,6],['MNL','Manila',14.51,121.02,5],
  ['HKG','Hong Kong',22.31,113.91,8],['PEK','Beijing',40.08,116.58,9],['PVG','Shanghai',31.14,121.81,9],
  ['ICN','Seoul',37.46,126.44,7],['HND','Tokyo',35.55,139.78,9],['SYD','Sydney',-33.94,151.18,6],
  ['MEL','Melbourne',-37.67,144.84,5],['AKL','Auckland',-37.01,174.79,3],
].map(a => ({c:a[0], city:a[1], lat:a[2], lon:a[3], pop:a[4]}));
const AP = Object.fromEntries(AIRPORTS.map(a => [a.c, a]));

// fictional aircraft family
const TYPES = [
  {name:'Skylark C9',    cost:25e3,  seats:9,   range:1500,  speed:60,  burn:0.30, lvl:1},
  {name:'Swift T76',     cost:180e3, seats:76,  range:2500,  speed:90,  burn:2.0,  lvl:2},
  {name:'Falcon J120',   cost:650e3, seats:120, range:4000,  speed:110, burn:3.4,  lvl:4},
  {name:'Meridian N180', cost:2.2e6, seats:180, range:6000,  speed:125, burn:5.2,  lvl:6},
  {name:'Meridian N240', cost:5.5e6, seats:240, range:9000,  speed:130, burn:7.4,  lvl:9},
  {name:'Atlas W300',    cost:14e6,  seats:300, range:13000, speed:140, burn:10.5, lvl:12},
  {name:'Atlas W400',    cost:32e6,  seats:410, range:15000, speed:145, burn:14.5, lvl:15},
  {name:'Titan S550',    cost:80e6,  seats:550, range:16500, speed:150, burn:20,   lvl:19},
];

const UPG = {
  gates:  {name:'Gates & Stands',      icon:'🛫', base:8000,  g:1.55, max:80, desc:'Each gate lets you base one more aircraft.', eff:l=>`${2+l} gates`},
  tank:   {name:'Fuel Farm',           icon:'🛢️', base:4000,  g:1.9,  max:30, desc:'Bigger tanks let you buy fuel when it is cheap.', eff:l=>`${fmt(Math.round(600*Math.pow(1.8,l)))} units`},
  crew:   {name:'Ground Crew',         icon:'🧑‍🔧', base:6000,  g:2.1,  max:15, desc:'Faster turnarounds between flights.', eff:l=>`${(4*Math.pow(0.9,l)).toFixed(1)}s turnaround`},
  term:   {name:'Terminal & Lounge',   icon:'🏢', base:15000, g:2.3,  max:10, desc:'Better passenger experience raises your brand rating.', eff:l=>`+${l*5} rating`},
  eng:    {name:'Efficient Engines',   icon:'⚙️', base:30000, g:2.6,  max:12, desc:'Retrofit fleet to burn 7% less fuel per level.', eff:l=>`-${Math.round((1-Math.pow(0.93,l))*100)}% fuel burn`},
  saf:    {name:'Sustainable Fuel Blend', icon:'🌱', base:25000, g:2.5, max:12, desc:'Cuts CO₂ by 12% per level, fuel costs 2% more per level.', eff:l=>`-${Math.round((1-Math.pow(0.88,l))*100)}% CO₂`},
  forest: {name:'Reforestation Program', icon:'🌳', base:20000, g:2.2, max:15, desc:'Passive carbon removal, works 24/7.', eff:l=>`${(l*0.01).toFixed(2)} t/s offset`},
};

const AUTO = {
  dispatch:{name:'Airport Operations Center', icon:'🛬', lvl:3,  desc:'Automates gate turnaround, boarding and dispatch. Aircraft depart on their own as soon as they are ready.'},
  fuel:    {name:'Fuel Procurement Desk',     icon:'⛽', lvl:5,  desc:'Buys fuel automatically when the market price is at or below your target. Emergency-buys when the tank runs dry.'},
  check:   {name:'Maintenance Control',       icon:'🔧', lvl:7,  desc:'Schedules A-checks between flights once an aircraft drops below your condition target.'},
  offset:  {name:'Sustainability Office',     icon:'🌍', lvl:9,  desc:'Purchases carbon credits automatically to keep your CO₂ debt under control and avoid levies.'},
  expand:  {name:'Network Planning AI',       icon:'🧠', lvl:12, desc:'Buys aircraft, gates and opens routes for you when you can comfortably afford it.'},
};

const EVENTS = [
  {t:'🛢️ Oil supplier dispute — fuel prices spike!',      f:()=>{G.fuelMult=Math.min(2.4,G.fuelMult+0.55)}},
  {t:'🛢️ Fuel glut — prices are tumbling. Stock up!',      f:()=>{G.fuelMult=Math.max(0.5,G.fuelMult-0.35)}},
  {t:'🎉 Travel boom! Demand +25% for 90s.',               f:()=>{G.evt.demandUntil=G.time+90}},
  {t:'🪧 Ground staff strike — turnarounds doubled for 45s.', f:()=>{G.evt.strikeUntil=G.time+45}},
  {t:'🌐 Climate summit — carbon credits +50% for 120s.',  f:()=>{G.evt.carbonUntil=G.time+120}},
];

const COLORS = ['#3aa0ff','#ff6b6b','#3ddc97','#ffc857','#b388ff','#ff8fd0','#4dd0e1','#ff9a3c'];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
function fmt(n){
  if(!isFinite(n)) return '0';
  const a = Math.abs(n);
  if(a < 1000) return (a<10 && a%1 ? n.toFixed(2) : a<100 && a%1 ? n.toFixed(1) : Math.round(n)).toString();
  const s = ['K','M','B','T','Qa','Qi','Sx'];
  let i = -1, v = a;
  while(v >= 1000 && i < s.length-1){ v /= 1000; i++; }
  return (n<0?'-':'') + v.toFixed(v<10?2:v<100?1:0) + s[i];
}
const money = n => (n<0?'-$':'$') + fmt(Math.abs(n));
const fmtT = s => { s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
function dist(a,b){
  const R=6371, r=Math.PI/180;
  const dLat=(b.lat-a.lat)*r, dLon=(b.lon-a.lon)*r;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function logoSVG(color, code){
  return `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="${color}"/><path d="M8 27l14-4 8-12 3 1-4 11 9-2 3-4 2 1-2 6 2 6-2 1-3-4-9-2 4 11-3 1-8-12-14-4z" fill="#04101f" opacity=".85" transform="translate(0,-1) scale(.98)"/><text x="24" y="44" font-size="0" fill="#fff">${code}</text></svg>`;
}

/* ---------- state ---------- */
let G = null;
let dirty = false;      // structure changed, UI should rebuild when safe
let tab = 'overview';

function newGame(brand, prev){
  const hub = AP[brand.hub];
  const others = AIRPORTS.filter(a => a.c !== hub.c).map(a => ({a, d:dist(hub,a)})).sort((x,y)=>x.d-y.d);
  const near = others[0];
  G = {
    v:1, brand, cash:60000, xp:0, level:1, lifetime:0, allTime: prev ? prev.allTime : 0,
    shares: prev ? prev.shares : 0, ipos: prev ? prev.ipos : 0,
    fuel:400, fuelMult:1, fuelHist:[1], creditMult:1, debt:0, totalCO2:0, totalOffset:0,
    ticket:1, upg:{}, routes:{}, fleet:[], nextId:101, time:0, evt:{}, nextEvt:90, taxT:20,
    mAcc:0, xAcc:0, charterCD:0, flights:0, rate:0, lfEma:0.6, acc:0, log:[], lastSave:Date.now(),
    auto:{dispatch:{on:true}, fuel:{on:true, below:1.0}, check:{on:true, below:55},
          offset:{on:true, above:10}, expand:{on:true, reserve:0.5}},
  };
  G.routes[near.a.c] = 1;
  // starter aircraft: smallest type that can fly the nearest route
  const ti = Math.max(0, TYPES.findIndex(t => t.range >= near.d));
  addAircraft(ti, near.a.c);
  logMsg(`Welcome to ${brand.name}! Your first route is ${hub.c} ⇄ ${near.a.c}.`);
}

/* ---------- derived values ---------- */
const hubAp = () => AP[G.brand.hub];
const gates = () => 2 + (G.upg.gates||0);
const tankCap = () => Math.round(600 * Math.pow(1.8, G.upg.tank||0));
const turnTime = () => Math.max(0.8, 4 * Math.pow(0.9, G.upg.crew||0)) * (G.evt.strikeUntil > G.time ? 2 : 1);
const burnMult = () => Math.pow(0.93, G.upg.eng||0);
const co2Mult = () => Math.pow(0.88, G.upg.saf||0);
const fuelPrice = () => G.fuelMult * (1 + 0.02*(G.upg.saf||0));
const creditPrice = () => 30 * G.creditMult * (1+G.level*0.03) * (G.evt.carbonUntil > G.time ? 1.5 : 1);
const allowance = () => 25 + 6*G.level;
const revMult = () => 1 + 0.05*G.shares;
const demandEvt = () => G.evt.demandUntil > G.time ? 1.25 : 1;
const xpNeed = l => Math.round(60 * Math.pow(1.55, l-1));
const autoReq = id => G.ipos > 0 ? 1 : AUTO[id].lvl;
const autoUnlocked = id => G.level >= autoReq(id);
const autoOn = id => autoUnlocked(id) && G.auto[id].on;
function ecoScore(){ return clamp(70 + 4*(G.upg.saf||0) + 3*(G.upg.forest||0) - 40*(G.debt/allowance()), 0, 100); }
function avgCond(){ return G.fleet.length ? G.fleet.reduce((s,a)=>s+a.cond,0)/G.fleet.length : 100; }
function rating(){ return clamp(10 + 5*(G.upg.term||0) + 0.2*avgCond() + 0.25*ecoScore() + 0.8*G.level, 0, 100); }
const routeDist = code => dist(hubAp(), AP[code]);
const routeDemand = code => Math.sqrt(hubAp().pop * AP[code].pop) / 10;
const routeCost = code => Math.round((1500 + routeDist(code)*5)/100)*100;
const fare = code => 25 + 0.11*routeDist(code);
const gateCost = () => Math.round(UPG.gates.base * Math.pow(UPG.gates.g, G.upg.gates||0));
const checkCost = a => TYPES[a.type].cost * 0.001 * (100 - a.cond) + 50;
const sellValue = a => Math.round(TYPES[a.type].cost * 0.5 * (0.5 + 0.5*a.cond/100));
const acOnRoute = code => G.fleet.filter(a => a.route === code).length;

function loadFactor(code, n){
  const lf = (0.3 + 0.65*routeDemand(code)) * (0.75 + rating()/200) / Math.pow(G.ticket, 1.3)
           / (1 + 0.12*(Math.max(1,n)-1)) * demandEvt();
  return clamp(lf, 0.08, 0.98);
}
function estimate(t, code, n){
  const d = routeDist(code), lf = loadFactor(code, n);
  const rev = t.seats * lf * fare(code) * G.ticket * 2 * revMult();
  const fuelC = t.burn * d * 2 * burnMult() * fuelPrice();
  const costs = fuelC + 2*(40 + t.seats*1.6) + 30 + t.seats*0.9;
  const dur = 2*d/t.speed + turnTime();
  return {rev, lf, profit: rev-costs, perSec: (rev-costs)/dur};
}
const tripFuel = (t, code) => t.burn * routeDist(code) * 2 * burnMult();
function findBestRoute(t){
  let best = null;
  for(const code in G.routes){
    if(routeDist(code) > t.range || tripFuel(t, code) > tankCap()) continue;
    const e = estimate(t, code, acOnRoute(code)+1);
    if(e.profit > 0 && (!best || e.perSec > best.perSec)) best = {code, perSec:e.perSec};
  }
  return best;
}

/* ---------- logging ---------- */
function logMsg(m){ G.log.unshift(m); if(G.log.length>40) G.log.pop(); }
function toast(m){
  const el = document.createElement('div'); el.className='toast'; el.textContent=m;
  $('#toasts').appendChild(el); setTimeout(()=>el.remove(), 4200);
}

/* ---------- economy actions ---------- */
function addAircraft(ti, route){
  const a = {id:G.nextId++, type:ti, cond:100, route:route||null, state:'ready', t:0, dur:0, dist:0, flights:0, earned:0};
  G.fleet.push(a); dirty = true; return a;
}
function buyAircraft(ti){
  const t = TYPES[ti];
  if(G.level < t.lvl || G.cash < t.cost || G.fleet.length >= gates()) return false;
  G.cash -= t.cost;
  const best = findBestRoute(t);
  addAircraft(ti, best ? best.code : null);
  return true;
}
function openRoute(code){
  const c = routeCost(code);
  if(G.routes[code] || G.cash < c) return false;
  G.cash -= c; G.routes[code] = 1; dirty = true; return true;
}
function buyUpgrade(id){
  const U = UPG[id], l = G.upg[id]||0;
  const c = Math.round(U.base * Math.pow(U.g, l));
  if(l >= U.max || G.cash < c) return false;
  G.cash -= c; G.upg[id] = l+1; dirty = true; return true;
}
function buyFuel(frac){
  const room = tankCap() - G.fuel;
  let amt = Math.min(room, tankCap()*frac);
  const p = fuelPrice();
  if(amt*p > G.cash) amt = G.cash/p;
  if(amt <= 0.01) return 0;
  G.cash -= amt*p; G.fuel += amt; return amt;
}
function offsetCO2(t){
  t = Math.min(t, G.debt);
  const p = creditPrice();
  if(t*p > G.cash) t = G.cash/p;
  if(t <= 0.0001) return 0;
  G.cash -= t*p; G.debt -= t; G.totalOffset += t; return t;
}
function grantXP(x){
  G.xp += x;
  while(G.xp >= xpNeed(G.level)){
    G.xp -= xpNeed(G.level); G.level++;
    const bonus = Math.round(2000 * Math.pow(G.level, 1.8));
    G.cash += bonus;
    logMsg(`⭐ Level ${G.level} reached! Bonus ${money(bonus)}.`);
    toast(`⭐ Level ${G.level}! +${money(bonus)}`);
    for(const k in AUTO) if(G.level === autoReq(k) && G.ipos === 0) toast(`🔓 Unlocked: ${AUTO[k].name}`);
    TYPES.forEach(t => { if(t.lvl === G.level) toast(`✈️ New aircraft available: ${t.name}`); });
    dirty = true;
  }
}
const charterValue = () => Math.round(200 * Math.pow(1+G.level, 1.4) * revMult());

/* ---------- aircraft simulation ---------- */
function fuelNeed(a){ return TYPES[a.type].burn * a.dist * 2 * burnMult(); }

function tryDepart(a){
  const t = TYPES[a.type];
  if(!a.route){ a.state='noroute'; return false; }
  const d = routeDist(a.route);
  if(d > t.range){ a.route=null; a.state='noroute'; return false; }
  a.dist = d;
  const need = fuelNeed(a);
  if(need > tankCap()){ a.state='nofuel'; a.tooBig = true; return false; }
  a.tooBig = false;
  if(G.fuel < need){ a.state='nofuel'; return false; }
  G.fuel -= need;
  const co2 = need * 0.01 * co2Mult();
  G.debt += co2; G.totalCO2 += co2;
  a.state='flying'; a.t=0; a.dur=2*d/t.speed;
  return true;
}
function startCheck(a, auto){
  const c = checkCost(a);
  if(G.cash < c) return false;
  G.cash -= c; G.acc -= c;
  a.state='check'; a.t=0; a.dur=8; return true;
}
function land(a){
  const t = TYPES[a.type];
  const n = acOnRoute(a.route);
  const lf = loadFactor(a.route, n);
  const rev = t.seats * lf * fare(a.route) * G.ticket * 2 * revMult();
  const costs = 2*(40 + t.seats*1.6) + 30 + t.seats*0.9;
  const net = rev - costs;
  G.cash += net; G.acc += net; G.lifetime += rev; G.allTime += rev;
  a.earned += net; a.flights++; G.flights++;
  G.lfEma = G.lfEma*0.95 + lf*0.05;
  a.cond = Math.max(0, a.cond - (2 + a.dist/1500));
  grantXP(4 + rev/100);
  a.state='turn'; a.t=0; a.dur=turnTime();
}
function stepAircraft(a, dt){
  let rem = dt, guard = 0;
  while(rem > 1e-9 && guard++ < 60){
    switch(a.state){
      case 'flying': case 'turn': case 'check': {
        const use = Math.min(rem, a.dur - a.t); a.t += use; rem -= use;
        if(a.t < a.dur - 1e-9) return;
        if(a.state==='flying') land(a);
        else if(a.state==='turn') { a.state='ready'; a.t=0; }
        else { a.cond=100; a.state='ready'; a.t=0; }
        break;
      }
      case 'ready': {
        if(a.cond < GROUND){ a.state='grounded'; break; }
        if(autoOn('check') && a.cond < G.auto.check.below && startCheck(a,true)) break;
        if(!a.route){ a.state='noroute'; return; }
        if(!autoOn('dispatch')) return;
        tryDepart(a);
        if(a.state==='ready') return;
        break;
      }
      case 'nofuel': tryDepart(a); if(a.state==='nofuel') return; break;
      case 'grounded':
        if(autoOn('check')) startCheck(a,true);
        if(a.state==='grounded') return;
        break;
      case 'noroute': if(a.route) { a.state='ready'; break; } return;
      default: a.state='ready';
    }
  }
}

/* ---------- automation + markets ---------- */
function autoFuelStep(){
  if(!autoOn('fuel')) return;
  const frac = G.fuel / tankCap();
  if(frac < 0.15) buyFuel(0.35);
  else if(frac < 0.9 && fuelPrice() <= G.auto.fuel.below) buyFuel(1);
}
function autoOffsetStep(){
  if(autoOn('offset') && G.debt >= G.auto.offset.above) offsetCO2(G.debt);
}
function openBestRoute(maxRange){
  let best=null;
  for(const a of AIRPORTS){
    if(a.c===G.brand.hub || G.routes[a.c]) continue;
    const d = routeDist(a.c);
    if(d > maxRange) continue;
    const c = routeCost(a.c);
    if(c > G.cash*0.25) continue;
    const score = routeDemand(a.c) * fare(a.c) / c;
    if(!best || score > best.score) best = {code:a.c, score};
  }
  if(best) openRoute(best.code);
}
function autoExpandStep(){
  if(!autoOn('expand')) return;
  const r = 1 + G.auto.expand.reserve;
  if(G.fleet.length >= gates()){
    if(G.cash >= gateCost()*r*2) buyUpgrade('gates');
    return;
  }
  // keep the fuel farm big enough for the best aircraft we can afford
  const top0 = TYPES.filter(t => G.level>=t.lvl && G.cash >= t.cost*r).pop();
  if(top0 && tankCap() < 2*top0.burn*Math.min(top0.range,5000)*2*burnMult()){
    const tc = Math.round(UPG.tank.base*Math.pow(UPG.tank.g, G.upg.tank||0));
    if(G.cash >= tc*r*2 && buyUpgrade('tank')) return;
  }
  let pick=null;
  TYPES.forEach((t,i) => {
    if(G.level < t.lvl || G.cash < t.cost*r) return;
    const b = findBestRoute(t);
    if(b && (!pick || b.perSec > pick.perSec)) pick = {i, perSec:b.perSec};
  });
  if(pick){ buyAircraft(pick.i); return; }
  const top = TYPES.filter(t => G.level>=t.lvl && G.cash >= t.cost*r).pop();
  if(top) openBestRoute(top.range);
}
function marketStep(){
  G.fuelMult = clamp(G.fuelMult + (1-G.fuelMult)*0.03 + (Math.random()-0.5)*0.07, 0.5, 2.4);
  G.creditMult = clamp(G.creditMult + (1-G.creditMult)*0.02 + (Math.random()-0.5)*0.03, 0.7, 1.8);
  G.fuelHist.push(fuelPrice()); if(G.fuelHist.length>90) G.fuelHist.shift();
}
function carbonLevy(){
  const excess = G.debt - allowance();
  if(excess <= 0) return;
  const rate = creditPrice()*1.8;
  const pay = Math.min(G.cash, excess*rate);
  G.cash -= pay; G.debt -= pay/rate; G.totalOffset += pay/rate;
  logMsg(`🏛️ Carbon levy: ${money(pay)} for ${excess.toFixed(1)} t over your allowance.`);
}

function tick(dt, offline){
  G.time += dt;
  G.mAcc += dt; while(G.mAcc >= 2){ G.mAcc -= 2; marketStep(); }
  if(!offline){
    G.nextEvt -= dt;
    if(G.nextEvt <= 0){
      const e = EVENTS[Math.floor(Math.random()*EVENTS.length)];
      e.f(); logMsg(e.t); toast(e.t);
      G.nextEvt = 90 + Math.random()*120;
    }
  }
  const f = G.upg.forest||0;
  if(f && G.debt>0){ const o = Math.min(G.debt, f*0.01*dt); G.debt -= o; G.totalOffset += o; }
  autoFuelStep();
  for(const a of G.fleet) stepAircraft(a, dt);
  autoOffsetStep();
  G.taxT -= dt; if(G.taxT <= 0){ G.taxT = 20; carbonLevy(); }
  G.xAcc += dt; if(G.xAcc >= 3){ G.xAcc = 0; autoExpandStep(); }
  G.charterCD = Math.max(0, G.charterCD - dt);
  G.rate = G.rate*Math.pow(0.97, dt) + (G.acc/Math.max(dt,1e-3))*(1-Math.pow(0.97, dt));
  G.acc = 0;
}
function catchUp(sec){
  const before = G.cash, step = sec > 600 ? 5 : 1;
  for(let left = sec; left > 0; left -= step) tick(Math.min(step, left), true);
  return G.cash - before;
}

/* ---------- save / load ---------- */
function save(){ if(!G) return; G.lastSave = Date.now(); try{ localStorage.setItem(SAVE_KEY, JSON.stringify(G)); }catch(e){} }
function load(){
  try{ const s = localStorage.getItem(SAVE_KEY); if(!s) return false; G = JSON.parse(s); return !!G && G.v===1; }catch(e){ return false; }
}

/* ---------- UI: binds ---------- */
function bindVal(key){
  const [k, id, x] = key.split(':');
  switch(k){
    case 'bname': return G.brand.name;
    case 'btag': return G.brand.hub + ' hub' + (G.shares ? ` · ${G.shares} shares` : '');
    case 'cash': return money(G.cash);
    case 'rate': return (G.rate>=0?'+':'')+money(G.rate)+'/s';
    case 'hr': return money(G.rate*3600)+'/hr';
    case 'fuel': return `${fmt(G.fuel)}/${fmt(tankCap())}`;
    case 'debt': return G.debt.toFixed(1)+' t';
    case 'level': return G.level;
    case 'xp': return `${fmt(G.xp)}/${fmt(xpNeed(G.level))} XP`;
    case 'flights': return fmt(G.flights);
    case 'lf': return Math.round(G.lfEma*100)+'%';
    case 'rating': return Math.round(rating())+'/100';
    case 'fleetcount': return `${G.fleet.length}/${gates()}`;
    case 'ticketlbl': return `${Math.round(G.ticket*100)}% of base fare`;
    case 'ticketnote': return G.ticket>1.15 ? 'Premium pricing: fewer passengers, higher yield.' : G.ticket<0.85 ? 'Discount pricing: packed cabins, thin margins.' : 'Balanced pricing.';
    case 'charter': return G.charterCD>0 ? `Charter (${Math.ceil(G.charterCD)}s)` : `✈️ Sell a charter  +${money(charterValue())}`;
    case 'log': return G.log.map(l=>`<div>${l}</div>`).join('');
    case 'fuelprice': return `${money(fuelPrice())}/unit`;
    case 'fuelnote': { const p=fuelPrice(); return p<0.85?'🟢 Cheap — stock up!':p>1.3?'🔴 Expensive — wait if you can.':'🟡 Normal market.'; }
    case 'creditprice': return `${money(creditPrice())}/t`;
    case 'allow': return `${G.debt.toFixed(1)} / ${allowance()} t allowance`;
    case 'eco': return Math.round(ecoScore())+'/100';
    case 'totco2': return `${G.totalCO2.toFixed(1)} t emitted · ${G.totalOffset.toFixed(1)} t offset`;
    case 'cond': return Math.round(avgCond())+'%';
    case 'shares': return `${G.shares} shares (+${G.shares*5}% revenue)`;
    case 'ipogain': return ipoGain()+' new shares';
    case 'ac': {
      const a = G.fleet.find(z=>z.id==id); if(!a) return '';
      if(x==='st') return stateLabel(a);
      if(x==='info') return `${a.flights} flights · ${money(a.earned)} earned · condition ${Math.round(a.cond)}%`;
      if(x==='est'){ const e = a.route ? estimate(TYPES[a.type], a.route, acOnRoute(a.route)) : null; return e ? `~${Math.round(e.lf*100)}% load · ${money(e.profit)}/flight` : ''; }
    }
  }
  return '';
}
function widthVal(key){
  const [k,id] = key.split(':');
  switch(k){
    case 'fuelpct': return G.fuel/tankCap()*100;
    case 'debtpct': return clamp(G.debt/allowance()*100,0,100);
    case 'xppct': return G.xp/xpNeed(G.level)*100;
    case 'ecopct': return ecoScore();
    case 'ratingpct': return rating();
    case 'acp': { const a=G.fleet.find(z=>z.id==id); return a && a.dur ? (a.state==='flying'||a.state==='turn'||a.state==='check' ? a.t/a.dur*100 : 0) : 0; }
    case 'acc': { const a=G.fleet.find(z=>z.id==id); return a ? a.cond : 0; }
  }
  return 0;
}
function stateLabel(a){
  switch(a.state){
    case 'flying': return `Flying ${G.brand.hub} ⇄ ${a.route} · ${fmtT(a.dur-a.t)}`;
    case 'turn': return 'Turnaround';
    case 'check': return `A-check in progress · ${fmtT(a.dur-a.t)}`;
    case 'grounded': return 'Grounded — needs maintenance check';
    case 'nofuel': return a.tooBig ? 'Tank too small for this route — upgrade Fuel Farm' : 'Waiting for fuel';
    case 'noroute': return 'No route assigned';
    default: return autoOn('dispatch') ? 'Ready' : 'At gate — awaiting dispatch';
  }
}
function updateUI(){
  if(!G) return;
  const cache = (el, key, v, prop) => { if(el._v !== v){ el._v = v; el[prop] = v; } };
  document.querySelectorAll('[data-bind]').forEach(el => cache(el, 0, bindVal(el.dataset.bind), 'textContent'));
  document.querySelectorAll('[data-html]').forEach(el => cache(el, 0, bindVal(el.dataset.html), 'innerHTML'));
  document.querySelectorAll('[data-w]').forEach(el => { const w = widthVal(el.dataset.w).toFixed(1)+'%'; if(el._v!==w){ el._v=w; el.style.width=w; } });
  document.querySelectorAll('[data-cost]').forEach(el => {
    el.disabled = G.cash < +el.dataset.cost || (el.dataset.gate && G.fleet.length >= gates());
  });
  document.querySelectorAll('.ac').forEach(el => {
    const a = G.fleet.find(z=>z.id==el.dataset.id); if(!a) return;
    if(el.dataset.state !== a.state) el.dataset.state = a.state;
    const cb = el.querySelector('.b-check'); if(cb) cb.disabled = G.cash < checkCost(a);
  });
  const co = $('#charterBtn'); if(co) co.disabled = G.charterCD > 0;
  if(dirty && !(document.activeElement && /SELECT|INPUT/.test(document.activeElement.tagName))){ dirty=false; build(); }
  if(tab==='overview') drawMap();
  if(tab==='fuel') drawSpark();
}

/* ---------- UI: tabs ---------- */
const TABS = [['overview','🌍 Overview'],['fleet','✈️ Fleet'],['routes','🗺️ Routes'],['airport','🏢 Airport'],
              ['fuel','⛽ Fuel & Carbon'],['auto','🤖 Automation'],['company','🏆 Company']];

function buildNav(){
  $('#nav').innerHTML = TABS.map(([id,l]) => `<button data-act="tab" data-arg="${id}" class="${id===tab?'on':''}">${l}</button>`).join('');
}
function build(){
  buildNav();
  const v = $('#view');
  v.innerHTML = ({overview:bOverview, fleet:bFleet, routes:bRoutes, airport:bAirport, fuel:bFuel, auto:bAuto, company:bCompany})[tab]();
  updateUI();
}
const costBtn = (label, cost, act, arg, extra='') =>
  `<button class="btn pri" data-act="${act}" data-arg="${arg}" data-cost="${cost}" ${extra}>${label} · ${money(cost)}</button>`;

function bOverview(){
  return `
  <div class="grid g4">
    <div class="card kpi"><label>Net income</label><b data-bind="hr"></b></div>
    <div class="card kpi"><label>Flights flown</label><b data-bind="flights"></b></div>
    <div class="card kpi"><label>Avg load factor</label><b data-bind="lf"></b></div>
    <div class="card kpi"><label>Brand rating</label><b data-bind="rating"></b><div class="bar"><i class="good" data-w="ratingpct"></i></div></div>
  </div>
  <div class="card"><canvas id="map"></canvas></div>
  <div class="grid g2">
    <div class="card">
      <h3>Operations</h3>
      <p class="muted">Early on you do it all by hand. Level up to unlock automation for the airport, fuel, checks and carbon.</p>
      <div class="row"><button class="btn pri" id="charterBtn" data-act="charter" data-bind="charter"></button></div>
      <div class="field"><label>Ticket price: <b data-bind="ticketlbl"></b></label>
        <input type="range" min="60" max="160" value="${Math.round(G.ticket*100)}" data-in="ticket">
        <div class="muted" data-bind="ticketnote"></div></div>
    </div>
    <div class="card"><h3>News & log</h3><div id="log" data-html="log"></div></div>
  </div>`;
}

function bFleet(){
  const cat = TYPES.map((t,i) => {
    const locked = G.level < t.lvl;
    return `<div class="cat ${locked?'locked':''}">
      <div><b>${t.name}</b><small>${t.seats} seats · ${fmt(t.range)} km range · ${t.speed} km/s · burns ${t.burn}/km</small></div>
      ${locked ? `<span class="tag">🔒 Level ${t.lvl}</span>` :
        `<button class="btn pri" data-act="buy" data-arg="${i}" data-cost="${t.cost}" data-gate="1">Buy · ${money(t.cost)}</button>`}
    </div>`;
  }).join('');
  const rows = G.fleet.map(a => {
    const t = TYPES[a.type];
    const opts = Object.keys(G.routes).filter(c => routeDist(c) <= t.range && tripFuel(t,c) <= tankCap())
      .map(c => `<option value="${c}" ${a.route===c?'selected':''}>${G.brand.hub} ⇄ ${c} (${fmt(Math.round(routeDist(c)))} km)</option>`).join('');
    return `<div class="ac" data-id="${a.id}" data-state="${a.state}">
      <div class="row spread"><div><b>${G.brand.code}-${a.id}</b> <span class="muted">${t.name}</span></div><span class="state" data-bind="ac:${a.id}:st"></span></div>
      <div class="bar"><i data-w="acp:${a.id}"></i></div>
      <div class="row spread" style="margin-top:8px">
        <div class="row"><select data-in="route" data-arg="${a.id}"><option value="">— no route —</option>${opts}</select>
          <span class="muted" data-bind="ac:${a.id}:est"></span></div>
        <div class="row">
          <button class="btn sm b-disp" data-act="dispatch" data-arg="${a.id}">Dispatch</button>
          <button class="btn sm b-check" data-act="check" data-arg="${a.id}">Check · ${money(checkCost(a))}</button>
          <button class="btn sm danger" data-act="sell" data-arg="${a.id}">Sell ${money(sellValue(a))}</button>
        </div></div>
      <div class="bar" style="width:140px"><i class="warn" data-w="acc:${a.id}"></i></div>
      <div class="muted" data-bind="ac:${a.id}:info"></div>
    </div>`;
  }).join('');
  return `
  <div class="card"><div class="row spread"><h3>Your fleet <span class="muted" data-bind="fleetcount"></span></h3>
    <div class="row"><button class="btn" data-act="dispatchAll">Dispatch all</button><button class="btn" data-act="checkAll">Check all</button></div></div>
    ${rows || '<p class="muted">No aircraft yet.</p>'}</div>
  <div class="card"><h3>Aircraft dealer</h3>${cat}</div>`;
}

function bRoutes(){
  const rows = AIRPORTS.filter(a => a.c !== G.brand.hub).map(a => ({a, d:routeDist(a.c)})).sort((x,y)=>x.d-y.d)
    .map(({a,d}) => {
      const open = !!G.routes[a.c];
      return `<tr><td><b>${a.c}</b> ${a.city}</td><td>${fmt(Math.round(d))} km</td>
        <td><div class="bar" style="width:70px"><i style="width:${routeDemand(a.c)*100}%"></i></div></td>
        <td>${money(fare(a.c))}</td><td>${acOnRoute(a.c) || '–'}</td>
        <td>${open ? '<span class="tag on">Open</span>' : `<button class="btn sm pri" data-act="openRoute" data-arg="${a.c}" data-cost="${routeCost(a.c)}">Open · ${money(routeCost(a.c))}</button>`}</td></tr>`;
    }).join('');
  return `<div class="card"><h3>Route network</h3>
    <p class="muted">Longer routes pay more per flight but burn more fuel and need aircraft with enough range. Several aircraft on one route dilute demand — spread out.</p>
    <div style="overflow-x:auto"><table><tr><th>Destination</th><th>Distance</th><th>Demand</th><th>Base fare</th><th>Aircraft</th><th></th></tr>${rows}</table></div></div>`;
}

function bAirport(){
  const cards = Object.entries(UPG).map(([id,U]) => {
    const l = G.upg[id]||0, c = Math.round(U.base*Math.pow(U.g,l));
    return `<div class="card"><h3>${U.icon} ${U.name} <span class="tag">Lv ${l}${U.max<99?'/'+U.max:''}</span></h3>
      <p class="muted">${U.desc}</p><p>Now: <b>${U.eff(l)}</b>${l<U.max?` → <b class="good">${U.eff(l+1)}</b>`:''}</p>
      ${l>=U.max ? '<span class="tag on">Maxed</span>' : costBtn('Upgrade', c, 'upgrade', id)}</div>`;
  }).join('');
  return `<div class="grid g2">${cards}</div>`;
}

function bFuel(){
  return `<div class="grid g2">
  <div class="card"><h3>⛽ Fuel tank</h3>
    <div class="row spread"><b data-bind="fuel"></b><span data-bind="fuelprice"></span></div>
    <div class="bar"><i data-w="fuelpct"></i></div>
    <p data-bind="fuelnote"></p>
    <canvas id="spark"></canvas>
    <div class="row" style="margin-top:10px">
      <button class="btn pri" data-act="fuel" data-arg="0.25">Buy 25%</button>
      <button class="btn pri" data-act="fuel" data-arg="0.5">Buy 50%</button>
      <button class="btn pri" data-act="fuel" data-arg="1">Fill tank</button></div>
    <p class="muted">Prices swing with the market. Without fuel, aircraft sit on the ramp. Buy low, burn high.</p></div>
  <div class="card"><h3>🌍 Carbon</h3>
    <div class="row spread"><b data-bind="allow"></b><span data-bind="creditprice"></span></div>
    <div class="bar"><i class="bad" data-w="debtpct"></i></div>
    <p class="muted" data-bind="totco2"></p>
    <p>Eco score <b data-bind="eco"></b></p><div class="bar"><i class="good" data-w="ecopct"></i></div>
    <div class="row" style="margin-top:10px">
      <button class="btn pri" data-act="offset" data-arg="10">Offset 10 t</button>
      <button class="btn pri" data-act="offset" data-arg="100">Offset 100 t</button>
      <button class="btn pri" data-act="offset" data-arg="1e9">Offset all</button></div>
    <p class="muted">Every flight adds CO₂ debt. Above your allowance a government levy hits you at 1.8× the credit price every 20s. A low eco score also drags down your brand rating.</p></div>
  </div>`;
}

function bAuto(){
  const cards = Object.entries(AUTO).map(([id,A]) => {
    const unlocked = autoUnlocked(id), s = G.auto[id];
    let ctl = '';
    if(unlocked){
      if(id==='fuel') ctl = slider('Buy fuel when price ≤', 'afuel', 0.6, 1.6, 0.05, s.below, v=>v.toFixed(2)+'×');
      if(id==='check') ctl = slider('Check when condition <', 'acheck', 35, 90, 5, s.below, v=>v+'%');
      if(id==='offset') ctl = slider('Offset when debt ≥', 'aoffset', 1, 100, 1, s.above, v=>v+' t');
      if(id==='expand') ctl = slider('Keep reserve (× cost)', 'aexpand', 0, 3, 0.25, s.reserve, v=>v+'×');
    }
    return `<div class="card ${unlocked?'':'lock'}"><div class="row spread"><h3>${A.icon} ${A.name}</h3>
      ${unlocked ? `<div class="switch ${s.on?'on':''}" data-act="toggleAuto" data-arg="${id}"></div>` : `<span class="tag">🔒 Level ${autoReq(id)}</span>`}</div>
      <p class="muted">${A.desc}</p>${ctl}</div>`;
  }).join('');
  return `<p class="muted">Automations unlock as your airline levels up. After your first IPO they stay unlocked permanently.</p><div class="grid g2">${cards}</div>`;
}
function slider(label, key, min, max, step, val, f){
  return `<div class="field"><label>${label} <b id="lbl-${key}">${f(val)}</b></label>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-in="${key}"></div>`;
}

function ipoGain(){ return Math.floor(Math.sqrt(G.lifetime/250000)); }
function bCompany(){
  const canIPO = G.level >= 10 && ipoGain() >= 1;
  return `<div class="grid g2">
  <div class="card"><h3>🎨 Brand</h3>
    <div class="field"><label>Airline name</label><input type="text" id="nameIn" maxlength="24" value="${G.brand.name}" data-in="name"></div>
    <div class="field"><label>Livery colour</label><div class="swatches">${COLORS.map(c=>`<div class="sw ${c===G.brand.color?'on':''}" style="background:${c}" data-act="color" data-arg="${c}"></div>`).join('')}</div></div>
    <p class="muted">Hub: ${hubAp().city} (${G.brand.hub}) · Code ${G.brand.code}</p></div>
  <div class="card"><h3>📈 Go public (IPO)</h3>
    <p class="muted">Reach level 10 and earn enough lifetime revenue, then list on the exchange. You restart with a fresh fleet, but each share gives permanent +5% revenue and all automations stay unlocked.</p>
    <p>Current: <b data-bind="shares"></b><br>Lifetime revenue this run: <b>${money(G.lifetime)}</b><br>IPO would grant: <b class="good" data-bind="ipogain"></b></p>
    <button class="btn pri" data-act="ipo" ${canIPO?'':'disabled'}>Go public</button>
    ${canIPO?'':'<span class="muted"> Needs level 10 and ≥ $250K lifetime revenue.</span>'}</div>
  <div class="card"><h3>💾 Save</h3><p class="muted">Autosaves every few seconds. Offline progress (up to 12h) only counts for what you have automated!</p>
    <div class="row"><button class="btn" data-act="saveNow">Save now</button><button class="btn danger" data-act="reset">Delete save & restart</button></div></div>
  </div>`;
}

/* ---------- map & chart ---------- */
function fit(c){
  const r = c.getBoundingClientRect(), d = window.devicePixelRatio||1;
  if(c.width !== Math.round(r.width*d) || c.height !== Math.round(r.height*d)){ c.width = Math.round(r.width*d); c.height = Math.round(r.height*d); }
  const x = c.getContext('2d'); x.setTransform(d,0,0,d,0,0); return {x, W:r.width, H:r.height};
}
function drawMap(){
  const c = $('#map'); if(!c) return;
  const {x, W, H} = fit(c);
  const P = a => [(a.lon+180)/360*W, (78-a.lat)/140*H];
  x.clearRect(0,0,W,H);
  x.strokeStyle='#15233d'; x.lineWidth=1;
  for(let i=1;i<12;i++){ x.beginPath(); x.moveTo(W*i/12,0); x.lineTo(W*i/12,H); x.stroke(); }
  for(let i=1;i<6;i++){ x.beginPath(); x.moveTo(0,H*i/6); x.lineTo(W,H*i/6); x.stroke(); }
  const hub = P(hubAp()), col = G.brand.color;
  const ctrl = (p) => [(hub[0]+p[0])/2, Math.min(hub[1],p[1]) - Math.abs(hub[0]-p[0])*0.18 - 10];
  const bez = (p, t) => { const q=ctrl(p), u=1-t; return [u*u*hub[0]+2*u*t*q[0]+t*t*p[0], u*u*hub[1]+2*u*t*q[1]+t*t*p[1]]; };
  for(const a of AIRPORTS){
    const p = P(a), open = G.routes[a.c];
    if(open){
      const q = ctrl(p); x.strokeStyle = col+'66'; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(hub[0],hub[1]); x.quadraticCurveTo(q[0],q[1],p[0],p[1]); x.stroke();
    }
    x.fillStyle = open ? '#fff' : '#3a4d70';
    x.beginPath(); x.arc(p[0],p[1],open?3.5:2.2,0,7); x.fill();
    if(open){ x.fillStyle='#b9c8e6'; x.font='10px system-ui'; x.fillText(a.c,p[0]+5,p[1]-5); }
  }
  x.fillStyle = col; x.beginPath(); x.arc(hub[0],hub[1],7,0,7); x.fill();
  x.strokeStyle='#fff'; x.lineWidth=2; x.beginPath(); x.arc(hub[0],hub[1],11,0,7); x.stroke();
  for(const a of G.fleet){
    if(a.state!=='flying' || !a.route) continue;
    const p = P(AP[a.route]), pr = a.t/a.dur;
    const t = pr<0.5 ? pr*2 : 1-(pr-0.5)*2;
    const pt = bez(p,t), pt2 = bez(p, clamp(t+(pr<0.5?0.02:-0.02),0,1));
    const ang = Math.atan2(pt2[1]-pt[1], pt2[0]-pt[0]);
    x.save(); x.translate(pt[0],pt[1]); x.rotate(ang); x.fillStyle=col; x.strokeStyle='#fff'; x.lineWidth=1;
    x.beginPath(); x.moveTo(7,0); x.lineTo(-5,-4.5); x.lineTo(-2.5,0); x.lineTo(-5,4.5); x.closePath(); x.fill(); x.stroke(); x.restore();
  }
}
function drawSpark(){
  const c = $('#spark'); if(!c) return;
  const {x, W, H} = fit(c), h = G.fuelHist; x.clearRect(0,0,W,H);
  if(h.length<2) return;
  const lo = 0.4, hi = 2.5, Y = v => H - (v-lo)/(hi-lo)*(H-10) - 5;
  x.strokeStyle='#2a3b5c'; x.setLineDash([4,4]); x.beginPath(); x.moveTo(0,Y(1)); x.lineTo(W,Y(1)); x.stroke(); x.setLineDash([]);
  x.strokeStyle = G.brand.color; x.lineWidth = 2; x.beginPath();
  h.forEach((v,i) => { const px = i/(89)*W; i?x.lineTo(px,Y(v)):x.moveTo(px,Y(v)); }); x.stroke();
}

/* ---------- events ---------- */
const ACT = {
  tab: a => { tab = a; build(); },
  buy: a => { if(buyAircraft(+a)) build(); },
  dispatch: a => { const ac = G.fleet.find(z=>z.id==a); if(ac && ac.state==='ready') tryDepart(ac); },
  check: a => { const ac = G.fleet.find(z=>z.id==a); if(ac && ['ready','grounded','nofuel','noroute'].includes(ac.state)) startCheck(ac); },
  dispatchAll: () => G.fleet.forEach(ac => { if(ac.state==='ready') tryDepart(ac); }),
  checkAll: () => G.fleet.forEach(ac => { if(['ready','grounded'].includes(ac.state) && ac.cond<95) startCheck(ac); }),
  sell: a => { const i = G.fleet.findIndex(z=>z.id==a); if(i<0 || G.fleet[i].state==='flying') return; G.cash += sellValue(G.fleet[i]); G.fleet.splice(i,1); build(); },
  openRoute: a => { if(openRoute(a)) build(); },
  upgrade: a => { if(buyUpgrade(a)) build(); },
  fuel: a => buyFuel(+a),
  offset: a => offsetCO2(+a),
  charter: () => { if(G.charterCD<=0){ const v=charterValue(); G.cash+=v; G.acc+=v; G.lifetime+=v; G.allTime+=v; G.charterCD=10; grantXP(3);} },
  toggleAuto: a => { G.auto[a].on = !G.auto[a].on; build(); },
  color: a => { G.brand.color = a; applyBrand(); build(); },
  saveNow: () => { save(); toast('Saved.'); },
  reset: () => { if(confirm('Delete your airline and start over?')){ localStorage.removeItem(SAVE_KEY); G=null; location.reload(); } },
  ipo: () => {
    const g = ipoGain();
    if(!(G.level>=10 && g>=1)) return;
    if(!confirm(`Go public for ${g} new shares? You will restart with a new fleet.`)) return;
    const b = G.brand, prev = {allTime:G.allTime, shares:G.shares+g, ipos:G.ipos+1};
    newGame(b, prev); tab='overview'; applyBrand(); build(); toast(`📈 IPO complete! You now hold ${G.shares} shares.`);
  },
};
const INP = {
  ticket: el => { G.ticket = el.value/100; },
  route: (el, id) => { const a = G.fleet.find(z=>z.id==id); if(a){ a.route = el.value || null; if(a.state==='noroute' && a.route) a.state='ready'; } },
  name: el => { G.brand.name = el.value.trim() || 'SkyIdle Air'; },
  afuel: el => { G.auto.fuel.below = +el.value; lbl(el, el.value+'×'); },
  acheck: el => { G.auto.check.below = +el.value; lbl(el, el.value+'%'); },
  aoffset: el => { G.auto.offset.above = +el.value; lbl(el, el.value+' t'); },
  aexpand: el => { G.auto.expand.reserve = +el.value; lbl(el, el.value+'×'); },
};
const lbl = (el, t) => { const l = $('#lbl-'+el.dataset.in); if(l) l.textContent = t; };

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if(!t || !G || t.disabled) return;
  ACT[t.dataset.act](t.dataset.arg); updateUI();
});
document.addEventListener('input', e => {
  const t = e.target.closest('[data-in]'); if(!t || !G) return;
  INP[t.dataset.in](t, t.dataset.arg);
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-in]'); if(t && t.dataset.in==='route') dirty = true;
});

/* ---------- boot ---------- */
function applyBrand(){
  document.documentElement.style.setProperty('--brand', G.brand.color);
  $('#logo').innerHTML = logoSVG(G.brand.color, G.brand.code);
  document.title = `${G.brand.name} — SkyIdle`;
}
function showSetup(){
  const m = $('#modal'); m.hidden = false;
  let color = COLORS[0];
  const opts = AIRPORTS.slice().sort((a,b)=>a.city.localeCompare(b.city)).map(a => {
    const near = Math.min(...AIRPORTS.filter(z=>z!==a).map(z=>dist(a,z)));
    return `<option value="${a.c}">${a.city} (${a.c})${near>1500?' — remote, hard start':''}</option>`;
  }).join('');
  m.innerHTML = `<div class="box"><h2>✈️ Launch your airline</h2><p class="muted">Pick a brand and a home hub. You start with one aircraft and one route — automate the rest as you grow.</p>
    <div class="field"><label>Airline name</label><input type="text" id="sName" maxlength="24" value="Skyward Air"></div>
    <div class="field"><label>3-letter code</label><input type="text" id="sCode" maxlength="3" value="SKY"></div>
    <div class="field"><label>Livery colour</label><div class="swatches" id="sSw">${COLORS.map((c,i)=>`<div class="sw ${i?'':'on'}" data-c="${c}" style="background:${c}"></div>`).join('')}</div></div>
    <div class="field"><label>Home hub</label><select id="sHub">${opts}</select></div>
    <button class="btn pri" id="sGo" style="width:100%;padding:11px">Start flying</button></div>`;
  $('#sHub').value = 'LHR';
  $('#sSw').onclick = e => { const s=e.target.closest('.sw'); if(!s) return; color=s.dataset.c; document.querySelectorAll('#sSw .sw').forEach(z=>z.classList.toggle('on',z===s)); };
  $('#sGo').onclick = () => {
    const name = $('#sName').value.trim() || 'Skyward Air';
    const code = ($('#sCode').value.trim().toUpperCase() || 'SKY').slice(0,3);
    m.hidden = true;
    newGame({name, code, color, hub:$('#sHub').value});
    startGame();
  };
}
function startGame(){
  $('#app').hidden = false; applyBrand(); build(); save();
}
function main(){
  if(load()){
    const away = Math.min((Date.now() - G.lastSave)/1000, OFFLINE_CAP);
    startGame();
    if(away > 30){
      const gain = catchUp(away);
      const m = $('#modal'); m.hidden = false;
      m.innerHTML = `<div class="box"><h2>Welcome back, captain</h2><p>You were away for <b>${fmtT(away).replace(':','m ')}s</b>.<br>Your automated operations earned <b class="${gain>=0?'good':'bad'}">${money(gain)}</b>.</p>
        <p class="muted">Anything you have not automated (dispatch, fuel, checks) waited for you.</p>
        <button class="btn pri" id="wb" style="width:100%">Back to the cockpit</button></div>`;
      $('#wb').onclick = () => { m.hidden = true; };
      build();
    }
  } else showSetup();

  let last = Date.now(), saveT = 0;
  setInterval(() => {
    if(!G) return;
    const now = Date.now(); let dt = (now-last)/1000; last = now;
    if(dt > 2) catchUp(Math.min(dt, OFFLINE_CAP)); else tick(dt);
    updateUI();
    saveT += dt; if(saveT >= 5){ saveT = 0; save(); }
  }, 100);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if(document.hidden) save(); });
}
main();
