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
  shop:   {name:'Shops & Restaurants', icon:'🛍️', base:12000, g:2.0, max:15, desc:'Duty-free and food courts earn from every passenger.', eff:l=>`+${l*6}% revenue`},
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
  {t:'🎟️ Airshow charter signed — 2 flight tokens!',       f:()=>{G.tok+=2}},
];

/* Flight tokens: the second currency, spent on land far from your terminal. */
const TOKEN = '🎟️', TOKEN_MAP = '🗺️';
const ACH = [
  {id:'fly10',   t:'10 flights flown',       n:1, ok:()=>G.flights>=10},
  {id:'fly100',  t:'100 flights flown',      n:2, ok:()=>G.flights>=100},
  {id:'fly500',  t:'500 flights flown',      n:3, ok:()=>G.flights>=500},
  {id:'fly2k',   t:'2,000 flights flown',    n:5, ok:()=>G.flights>=2000},
  {id:'net5',    t:'5 routes open',          n:1, ok:()=>Object.keys(G.routes).length>=5},
  {id:'net15',   t:'15 routes open',         n:3, ok:()=>Object.keys(G.routes).length>=15},
  {id:'net30',   t:'30 routes open',         n:5, ok:()=>Object.keys(G.routes).length>=30},
  {id:'fleet10', t:'10 aircraft based',      n:2, ok:()=>G.fleet.length>=10},
  {id:'fleet25', t:'25 aircraft based',      n:4, ok:()=>G.fleet.length>=25},
  {id:'rev1m',   t:'$1M lifetime revenue',   n:2, ok:()=>G.lifetime>=1e6},
  {id:'rev10m',  t:'$10M lifetime revenue',  n:4, ok:()=>G.lifetime>=1e7},
  {id:'rev100m', t:'$100M lifetime revenue', n:6, ok:()=>G.lifetime>=1e8},
  {id:'star',    t:'Brand rating 80 or more',n:3, ok:()=>rating()>=80},
  {id:'happy',   t:'Terminal mood 90% or more', n:2, ok:()=>pax.length>=10 && paxHappy()>=90},
  {id:'ipo',     t:'Went public',            n:5, ok:()=>G.ipos>=1},
];
function achStep(){
  for(const a of ACH) if(!G.ach[a.id] && a.ok()){
    G.ach[a.id] = 1; G.tok += a.n;
    logMsg('🏅 ' + a.t + ' — +' + a.n + ' flight token' + (a.n>1?'s':'') + '.');
    toast('🏅 ' + a.t + ' · +' + a.n + ' ' + TOKEN);
    dirty = true;
  }
}

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

// coarse continent outlines [lon, lat] for the route map
const LAND = [
  [[-165,62],[-155,71],[-125,70],[-95,73],[-80,68],[-62,58],[-55,48],[-70,42],[-76,35],[-81,25],[-90,29],[-97,26],[-97,19],[-88,16],[-83,9],[-78,8],[-86,13],[-95,16],[-105,20],[-112,30],[-118,34],[-124,40],[-125,49],[-135,57],[-150,60]],
  [[-55,60],[-45,60],[-20,70],[-20,82],[-60,82],[-70,76]],
  [[-78,8],[-62,11],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-66,-46],[-69,-54],[-74,-50],[-72,-30],[-70,-18],[-81,-5]],
  [[-10,36],[-9,43],[-2,48],[-5,52],[5,60],[5,63],[20,70],[40,68],[70,73],[100,77],[140,72],[180,68],[180,62],[160,58],[142,52],[135,44],[128,35],[122,40],[121,30],[110,20],[108,12],[100,8],[104,1],[98,8],[93,20],[88,22],[80,12],[77,8],[72,20],[67,25],[57,25],[50,28],[56,17],[45,13],[38,22],[35,31],[27,37],[22,38],[13,38],[8,44],[0,38]],
  [[-17,21],[-10,35],[10,37],[32,31],[35,28],[43,12],[51,12],[40,-3],[40,-15],[35,-25],[20,-35],[18,-31],[12,-17],[13,-5],[9,4],[-8,4],[-17,14]],
  [[114,-22],[122,-18],[131,-12],[142,-11],[146,-19],[153,-27],[150,-37],[140,-38],[131,-31],[115,-34]],
  [[-5,50],[1,51],[-2,56],[-5,58],[-6,55]],
  [[130,31],[135,34],[141,38],[142,44],[140,41],[133,35]],
  [[172,-34],[178,-38],[174,-41],[168,-46],[172,-41]],
  [[95,5],[106,-3],[104,-6],[96,2]],
  [[109,1],[118,7],[119,0],[114,-4]],
];

/* ---------- aircraft artwork (side view, nose to the right) ---------- */
// len/h = fuselage size, fin = tail height, w = wing drop, eng = engine layout
const PLANE = [
  {len:100, h:14, fin:20, w:0,  eng:'prop1'},                       // Skylark C9: single-prop, high wing
  {len:132, h:15, fin:24, w:14, eng:'propwing', n:2, ttail:true},   // Swift T76: twin turboprop
  {len:152, h:16, fin:26, w:16, eng:'rear', n:2, ttail:true},       // Falcon J120: rear-engined regional jet
  {len:172, h:18, fin:30, w:19, eng:'under', n:2, er:6},            // Meridian N180
  {len:190, h:19, fin:32, w:21, eng:'under', n:2, er:7},            // Meridian N240
  {len:208, h:24, fin:36, w:25, eng:'under', n:2, er:9},            // Atlas W300
  {len:222, h:25, fin:38, w:27, eng:'under', n:2, er:10},           // Atlas W400
  {len:228, h:28, fin:40, w:28, eng:'under', n:4, er:8, hump:true}, // Titan S550
];
function planeSVG(i, color){
  const C = PLANE[i], L = C.len, h = C.h, yc = 56, cx = 120;
  const xr = cx - L/2, xn = cx + L/2, top = yc - h/2, bot = yc + h/2, cid = 'fz'+i+'_'+color.slice(1);
  const body = `M${xr+L*0.08},${top} L${xn-h*1.3},${top} Q${xn+1},${top+h*0.08} ${xn},${yc+h*0.18} Q${xn-h*0.1},${bot} ${xn-h*1.4},${bot} L${xr+L*0.24},${bot} Q${xr+L*0.08},${bot-h*0.12} ${xr},${top+h*0.2} Z`;
  let s = `<svg viewBox="${cx-Math.min(240,100+L*0.6)/2} 0 ${Math.min(240,100+L*0.6)} 104" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${cid}"><path d="${body}"/></clipPath></defs>`;
  const wy = yc + h*0.25;
  // far wing + far engine (behind fuselage)
  if(C.w){
    s += `<polygon points="${cx+L*0.04},${wy-2} ${cx-L*0.1},${wy-2} ${cx-L*0.2},${wy-C.w*0.55} ${cx-L*0.12},${wy-C.w*0.55}" fill="#8696b3"/>`;
  }
  // tail
  const fx = xr + L*0.1;
  s += `<polygon points="${fx+L*0.12},${top+3} ${fx-L*0.07},${top-C.fin} ${fx+L*0.04},${top-C.fin} ${fx+L*0.2},${top+3}" fill="${color}" stroke="#0a1222" stroke-width=".8"/>`;
  if(C.ttail) s += `<polygon points="${fx-L*0.07},${top-C.fin} ${fx-L*0.07-14},${top-C.fin-3} ${fx+L*0.04-6},${top-C.fin-3} ${fx+L*0.04+5},${top-C.fin}" fill="#aab8d0" stroke="#0a1222" stroke-width=".8"/>`;
  else s += `<polygon points="${xr+L*0.14},${yc-1} ${xr-8},${yc-h*0.35} ${xr+2},${yc-h*0.35} ${xr+L*0.28},${yc+2}" fill="#aab8d0" stroke="#0a1222" stroke-width=".8"/>`;
  // rear-mounted engines
  if(C.eng==='rear') s += `<ellipse cx="${xr+L*0.3}" cy="${top+3}" rx="13" ry="5.5" fill="#7f8da8" stroke="#0a1222" stroke-width=".8"/><rect x="${xr+L*0.3-13}" y="${top-1}" width="4" height="9" rx="2" fill="#2d3a55"/>`;
  // humpback upper deck
  if(C.hump) s += `<path d="M${xn-h*3.4},${top} Q${xn-h*3.2},${top-h*0.55} ${xn-h*2.1},${top-h*0.5} L${xn-h*1.5},${top}" fill="#fff" stroke="#9fb0cc" stroke-width=".8"/>`;
  // fuselage
  s += `<path d="${body}" fill="#f4f7fc" stroke="#7d90b0" stroke-width="1"/>`;
  s += `<g clip-path="url(#${cid})"><rect x="${xr}" y="${yc+h*0.12}" width="${L}" height="${h*0.2}" fill="${color}"/><rect x="${xr}" y="${bot-h*0.1}" width="${L}" height="${h*0.2}" fill="#d3dcec"/></g>`;
  // cockpit + windows
  s += `<path d="M${xn-h*1.25},${top+1.5} L${xn-h*0.35},${top+1.5} Q${xn-h*0.05},${top+h*0.3} ${xn-h*0.15},${top+h*0.45} L${xn-h*1.15},${top+h*0.45} Z" fill="#37577f"/>`;
  const wStart = xr + L*0.3, wEnd = xn - h*1.6, step = Math.max(4.2, L/36);
  for(let x = wStart; x < wEnd; x += step) s += `<circle cx="${x}" cy="${top+h*0.3}" r="${h>20?1.6:1.3}" fill="#4d6a96"/>`;
  // wing (near)
  if(C.w){
    s += `<polygon points="${cx+L*0.08},${wy} ${cx-L*0.12},${wy} ${cx-L*0.27},${wy+C.w} ${cx-L*0.15},${wy+C.w}" fill="#cbd6e8" stroke="#6f83a6" stroke-width="1"/>`;
  } else {
    s += `<polygon points="${cx+L*0.08},${top-1} ${cx-L*0.14},${top-1} ${cx-L*0.2},${top-7} ${cx-L*0.02},${top-7}" fill="#cbd6e8" stroke="#6f83a6" stroke-width="1"/><line x1="${cx-L*0.03}" y1="${top-1}" x2="${cx+L*0.02}" y2="${bot-1}" stroke="#6f83a6" stroke-width="1.2"/>`;
  }
  // engines
  if(C.eng==='under'){
    const ex = [cx-L*0.14]; const ey = [wy + C.w*0.55 + C.er*0.35];
    if(C.n===4){ ex.push(cx-L*0.2); ey.push(wy + C.w*0.85 + C.er*0.35); }
    ex.forEach((x,k) => {
      const er = k ? C.er*0.85 : C.er;
      s += `<ellipse cx="${x}" cy="${ey[k]}" rx="${er*1.7}" ry="${er*0.8}" fill="${k?'#8d9bb5':'#6f7e9a'}" stroke="#0a1222" stroke-width=".8"/><ellipse cx="${x+er*1.5}" cy="${ey[k]}" rx="${er*0.3}" ry="${er*0.65}" fill="#2d3a55"/>`;
    });
    if(C.n===2) s += `<ellipse cx="${cx-L*0.22}" cy="${wy+C.w*0.9}" rx="${C.er*1.4}" ry="${C.er*0.6}" fill="#98a6bf"/>`;
  }
  if(C.eng==='propwing'){
    const ex = cx - L*0.12, ey = wy + C.w*0.45;
    s += `<rect x="${ex-13}" y="${ey-4}" width="24" height="8" rx="4" fill="#6f7e9a" stroke="#0a1222" stroke-width=".8"/><line x1="${ex+12}" y1="${ey-12}" x2="${ex+12}" y2="${ey+12}" stroke="#222c42" stroke-width="2.2"/>`;
  }
  if(C.eng==='prop1'){
    s += `<ellipse cx="${xn+1}" cy="${yc+1}" rx="3" ry="4" fill="#6f7e9a"/><line x1="${xn+4}" y1="${yc-14}" x2="${xn+4}" y2="${yc+14}" stroke="#222c42" stroke-width="2.4"/>`;
  }
  // landing gear
  s += `<line x1="${cx+L*0.28}" y1="${bot-1}" x2="${cx+L*0.28}" y2="${bot+8}" stroke="#222c42" stroke-width="2"/><circle cx="${cx+L*0.28}" cy="${bot+10}" r="3.4" fill="#222c42"/>`;
  s += `<line x1="${cx-L*0.06}" y1="${bot-1}" x2="${cx-L*0.06}" y2="${bot+8}" stroke="#222c42" stroke-width="2"/><circle cx="${cx-L*0.06}" cy="${bot+10}" r="3.8" fill="#222c42"/>`;
  return s + '</svg>';
}

/* ---------- state ---------- */
let G = null;
let dirty = false;      // structure changed, UI should rebuild when safe
let tab = 'airport';

function newGame(brand, prev){
  const hub = AP[brand.hub];
  const others = AIRPORTS.filter(a => a.c !== hub.c).map(a => ({a, d:dist(hub,a)})).sort((x,y)=>x.d-y.d);
  const near = others[0];
  G = {
    v:1, brand, cash:60000, xp:0, level:1, lifetime:0, allTime: prev ? prev.allTime : 0,
    shares: prev ? prev.shares : 0, ipos: prev ? prev.ipos : 0,
    fuel:400, fuelMult:1, fuelHist:[1], creditMult:1, debt:0, totalCO2:0, totalOffset:0,
    tok: prev ? prev.tok||0 : 0, ach: prev ? prev.ach||{} : {},
    land: prev && prev.land ? prev.land : Object.fromEntries(START_LAND.map(b => [b, 1])),
    ticket:1, upg:{}, routes:{}, fleet:[], nextId:101, time:0, evt:{}, nextEvt:90, taxT:20,
    mAcc:0, xAcc:0, charterCD:0, flights:0, rate:0, lfEma:0.6, acc:0, log:[], lastSave:Date.now(),
    auto:{dispatch:{on:true}, fuel:{on:true, below:1.0}, check:{on:true, below:55},
          offset:{on:true, above:10}, expand:{on:true, reserve:0.5}},
  };
  G.routes[near.a.c] = 1;
  // starter aircraft: smallest type that can fly the nearest route
  const ti = Math.max(0, TYPES.findIndex(t => t.range >= near.d));
  addAircraft(ti, near.a.c);
  seedAirport(); seedHall();
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
const revMult = () => (1 + 0.05*G.shares) * (1 + 0.06*(G.upg.shop||0));
const demandEvt = () => G.evt.demandUntil > G.time ? 1.25 : 1;
const xpNeed = l => Math.round(60 * Math.pow(1.55, l-1));
const autoReq = id => G.ipos > 0 ? 1 : AUTO[id].lvl;
const autoUnlocked = id => G.level >= autoReq(id);
const autoOn = id => autoUnlocked(id) && G.auto[id].on;
function ecoScore(){ return clamp(70 + 4*(G.upg.saf||0) + 3*(G.upg.forest||0) - 40*(G.debt/allowance()), 0, 100); }
function avgCond(){ return G.fleet.length ? G.fleet.reduce((s,a)=>s+a.cond,0)/G.fleet.length : 100; }
function rating(){ return clamp(10 + 5*(G.upg.term||0) + 0.2*avgCond() + 0.25*ecoScore() + 0.8*G.level + (paxHappy()-60)*0.08, 0, 100); }
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
  if(G.level < t.lvl || G.cash < t.cost || G.fleet.length >= gates() || RWY[ti] > runwayLen()) return false;
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
    const tk = 1 + (G.level % 5 === 0 ? 2 : 0);
    G.cash += bonus; G.tok += tk;
    logMsg(`⭐ Level ${G.level} reached! Bonus ${money(bonus)} and ${tk} flight token${tk>1?'s':''}.`);
    toast(`⭐ Level ${G.level}! +${money(bonus)} · +${tk} ${TOKEN}`);
    if(tab === 'airport') showResult(`Level ${G.level}`, [
      ['Bonus', money(bonus)], ['Flight tokens', '+' + tk], ['Flights flown', fmt(G.flights)],
      ['Passengers in terminal', pax.length], ['Terminal mood', Math.round(paxHappy()) + '%'],
      ['Brand rating', Math.round(rating()) + '/100']], 'Your airline is growing.');
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
  const air = 2*d/t.speed;
  const si = G.fleet.indexOf(a), stood = si < G.stands.length;
  const routes = stood ? taxiRoutes(si) : (longestRunway() ? [{R: longestRunway()}] : []);
  if(stood && !routes.length){ a.state='notaxi'; return false; }
  const fits = routes.filter(r => r.R.len*M_TILE >= RWY[a.type]);
  if(!fits.length){ a.state='shortrwy'; return false; }
  const use = fits.find(r => rwFree(r.R, gndTime(r), flightTime(air, gndTime(r))));   // longest clear runway
  if(!use){ a.state='hold'; return false; }
  const R = use.R;
  const need = fuelNeed(a);
  if(need > tankCap()){ a.state='nofuel'; a.tooBig = true; return false; }
  a.tooBig = false;
  if(G.fuel < need){ a.state='nofuel'; return false; }
  G.fuel -= need;
  const co2 = need * 0.01 * co2Mult();
  G.debt += co2; G.totalCO2 += co2;
  a.rw = R.id; a.gnd = gndTime(use);
  a.state='flying'; a.t=0; a.dur=flightTime(air, a.gnd);
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
  floats.push({i:G.fleet.indexOf(a), txt:"+"+money(net), t:0}); if(floats.length>12) floats.shift();
  paxArrive(t.seats*lf);
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
      case 'nofuel': case 'notaxi': case 'shortrwy': case 'hold': { const was=a.state; tryDepart(a); if(a.state===was) return; break; }
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
  if(G.stands.length < gates() && G.fleet.length >= G.stands.length && autoPlaceStand()) return;
  const biggest = TYPES.reduce((m, t, i) => G.level >= t.lvl && G.cash >= t.cost*r ? i : m, -1);
  if(biggest >= 0 && RWY[biggest] > runwayLen() && G.cash >= runCost()*r*3 && autoExtendRunway()) return;
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
  if(!offline) paxStep(dt);                 // the terminal only trades while you are watching
  for(const a of G.fleet) stepAircraft(a, dt);
  autoOffsetStep();
  G.taxT -= dt; if(G.taxT <= 0){ G.taxT = 20; carbonLevy(); }
  G.xAcc += dt; if(G.xAcc >= 3){ G.xAcc = 0; autoExpandStep(); achStep(); }
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
  try{
    const s = localStorage.getItem(SAVE_KEY); if(!s) return false;
    G = JSON.parse(s); if(!G || G.v !== 1) return false;
    G.tok = G.tok || 0; G.ach = G.ach || {};
    if(!G.land || !Object.keys(G.land).length){ G.land = {}; for(const b of START_LAND) G.land[b] = 1; }
    return true;
  }catch(e){ return false; }
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
    case 'tok': return G.tok + ' ' + TOKEN;
    case 'toknote': return ACH.filter(a => G.ach[a.id]).length + '/' + ACH.length + ' achievements';
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
      if(x==='info') return `${a.flights} flights flown · ${money(a.earned)} earned`;
      if(x==='cond') return Math.round(a.cond)+'%';
      if(x==='fl') return a.state==='flying'||a.state==='turn'||a.state==='check' ? fmtT(a.dur-a.t)+' left' : '–';
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
    case 'hold': return 'Holding short — runway busy';
    case 'notaxi': return 'No taxiway route from this stand to a runway';
    case 'shortrwy': return `Runway too short — needs ${RWY[a.type]} m`;
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
    el.disabled = G.cash < +el.dataset.cost || (el.dataset.gate && G.fleet.length >= gates())
      || (el.dataset.tok && G.tok < +el.dataset.tok);
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
const TABS = [['airport','🛫 Airport'],['overview','🌍 Network'],['fleet','✈️ Fleet'],['routes','🗺️ Routes'],
              ['fuel','⛽ Fuel & Carbon'],['auto','🤖 Automation'],['company','🏆 Company']];
const SPEEDS = [[0,'⏸','Pause'],[1,'▶','Normal speed'],[2,'2×','Double speed'],[4,'4×','Quadruple speed']];
let speed = 1;                                 // session only: a reload always comes back at normal speed

function buildNav(){
  $('#nav').innerHTML = TABS.map(([id,l]) => `<button data-act="tab" data-arg="${id}" class="${id===tab?'on':''}">${l}</button>`).join('')
    + '<span class="navgap"></span>'
    + SPEEDS.map(([v,l,t]) => `<button class="spd ${v===speed?'on':''}" data-act="speed" data-arg="${v}" title="${t}">${l}</button>`).join('');
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
  const col = G.brand.color;
  const cat = TYPES.map((t,i) => {
    const locked = G.level < t.lvl;
    return `<div class="cat ${locked?'locked':''}">
      <div class="cat-img">${planeSVG(i, col)}</div>
      <div><b>${t.name}</b>
        <div class="specs"><span><em>Seats</em> ${t.seats}</span><span><em>Range</em> ${fmt(t.range)} km</span><span><em>Runway</em> ${RWY[i]} m</span><span><em>Speed</em> ${t.speed} km/s</span><span><em>Fuel</em> ${t.burn}/km</span></div></div>
      ${locked ? `<span class="tag">🔒 Unlocks at level ${t.lvl}</span>` : RWY[i] > runwayLen() ? `<span class="tag">🛫 Needs a ${RWY[i]} m runway</span>` :
        `<button class="btn pri" data-act="buy" data-arg="${i}" data-cost="${t.cost}" data-gate="1">Buy · ${money(t.cost)}</button>`}
    </div>`;
  }).join('');
  const rows = G.fleet.map(a => {
    const t = TYPES[a.type];
    const opts = Object.keys(G.routes).filter(c => routeDist(c) <= t.range && tripFuel(t,c) <= tankCap())
      .map(c => `<option value="${c}" ${a.route===c?'selected':''}>${G.brand.hub} ⇄ ${c} (${fmt(Math.round(routeDist(c)))} km)</option>`).join('');
    return `<div class="ac" data-id="${a.id}" data-state="${a.state}">
      <div class="ac-img">${planeSVG(a.type, col)}</div>
      <div>
        <div class="ac-head"><div><span class="ac-name">${G.brand.code}-${a.id}</span><span class="ac-type">${t.name} · ${t.seats} seats</span></div>
          <span class="chip" data-bind="ac:${a.id}:st"></span></div>
        <div class="meter"><div class="ml"><span>Flight progress</span><span data-bind="ac:${a.id}:fl"></span></div><div class="bar"><i data-w="acp:${a.id}"></i></div></div>
        <div class="meter"><div class="ml"><span>Condition</span><b data-bind="ac:${a.id}:cond"></b></div><div class="bar"><i class="good" data-w="acc:${a.id}"></i></div></div>
        <div class="ac-route row"><select data-in="route" data-arg="${a.id}"><option value="">— choose a route —</option>${opts}</select>
          <span class="muted small" data-bind="ac:${a.id}:est"></span></div>
        <div class="ac-actions">
          <button class="btn sm pri b-disp" data-act="dispatch" data-arg="${a.id}">Dispatch</button>
          <button class="btn sm b-check" data-act="check" data-arg="${a.id}">Maintenance check · ${money(checkCost(a))}</button>
          <button class="btn sm danger" data-act="sell" data-arg="${a.id}">Sell · ${money(sellValue(a))}</button>
        </div>
        <div class="muted small" style="margin-top:8px" data-bind="ac:${a.id}:info"></div>
      </div>
    </div>`;
  }).join('');
  return `
  <div class="card"><div class="row spread" style="margin-bottom:12px"><h3 style="margin:0">Your fleet <span class="muted" data-bind="fleetcount"></span></h3>
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

/* ---------- airport scene: close-up isometric terminal you fill, Kairosoft style ---------- */
const BUILD = Object.keys(UPG).filter(id => id !== 'gates');
const BCOL = {tank:'#b7bdc8', crew:'#e0a050', term:'#6fa8dc', eng:'#9aa1ad', saf:'#7ccf7a', forest:'#3f9a45', shop:'#e8645f'};
const RWY = [500, 750, 1000, 1500, 1750, 2250, 2500, 3000];   // runway metres each aircraft type needs
const ZOOM = [{TW:44, TH:22, WP:11}, {TW:28, TH:14, WP:17}, {TW:16, TH:8, WP:16}];  // close / wide / whole map
const CW = 660, CH = 430, HUD = 30;                           // viewport and the chrome bar on top
const GW = 60, GH = 60, BS = 12, BW = GW/BS, M_TILE = 250, SS = 3, MIN_RUN = 2;
const HALL0 = 2, HALL1 = 5, AIR = 6;                          // terminal interior rows, then the airside
const GEO = 4;                                                // layout generation; older saves get migrated
const START_LAND = [0];                                       // you start on one 12x12 block and buy outward
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
let zoom = 0, cam = {x:0, y:0, set:false};
const TW = () => ZOOM[zoom].TW, TH = () => ZOOM[zoom].TH, WP = () => ZOOM[zoom].WP;
const iso = (gx, gy, z = 0) => [cam.x + (gx-gy)*TW()/2, cam.y + (gx+gy)*TH()/2 - z];
const bldH = lvl => (6 + 5*Math.min(4, 1 + Math.floor(lvl/3))) * TW()/26;
const bIdx = (gx, gy) => ((gy/BS)|0)*BW + ((gx/BS)|0);
const owned = b => !!(G.land && G.land[b]);
const open = (gx, gy) => gx >= 0 && gx < GW && gy >= 0 && gy < GH && owned(bIdx(gx, gy));
let landC;                                                    // cached edges of the land you own
function landInfo(){
  if(landC) return landC;
  let x1 = BS-1, y1 = BS-1, hx1 = BS-1;
  for(const b in G.land){
    const bx = +b % BW, by = (+b / BW)|0;
    x1 = Math.max(x1, bx*BS + BS-1); y1 = Math.max(y1, by*BS + BS-1);
    if(by === 0) hx1 = Math.max(hx1, bx*BS + BS-1);
  }
  return landC = {x1, y1, hx1};
}
const hallW = () => landInfo().hx1 + 1;                       // the hall runs the width of the blocks you own in row 1
const nPlots = () => Math.max(1, hallW() - 1);
const landRing = b => (b % BW) + ((b / BW)|0);
const landCost = b => ({cash: Math.round(20000 * Math.pow(1.7, landRing(b))), tok: Math.max(0, landRing(b) - 2)});
function buyableLand(){                                       // locked blocks touching one you already own
  const out = new Set();
  for(let b = 0; b < BW*BW; b++){
    if(owned(b)) continue;
    const bx = b % BW, by = (b/BW)|0;
    for(const [dx, dy] of DIRS){
      const nx = bx+dx, ny = by+dy;
      if(nx >= 0 && nx < BW && ny >= 0 && ny < BW && owned(ny*BW + nx)){ out.add(b); break; }
    }
  }
  return out;
}
function buyLand(b){
  if(owned(b) || !buyableLand().has(b)) return false;
  const c = landCost(b);
  if(G.cash < c.cash){ toast('That block costs ' + money(c.cash) + '.'); return false; }
  if(G.tok < c.tok){ toast('That block also needs ' + c.tok + ' flight tokens — you have ' + G.tok + '.'); return false; }
  G.cash -= c.cash; G.tok -= c.tok; G.land[b] = 1; landC = undefined; invalidate();
  logMsg(TOKEN_MAP + ' Bought land block ' + ((b%BW)+1) + '-' + (((b/BW)|0)+1) + ' for ' + money(c.cash) + (c.tok ? ' and ' + c.tok + ' tokens' : '') + '.');
  toast(TOKEN_MAP + ' New land unlocked!');
  return true;
}
const isPlot = (gx, gy) => gy === 0 && gx >= 1 && open(gx, gy);
const plotAt = (gx, gy) => gx - 1;
const inHall = (gx, gy) => gy >= HALL0 && gy <= HALL1 && open(gx, gy);
const inAir = (gx, gy) => gy >= AIR && gy < GH && open(gx, gy);
let sel = null, mode = 'sel';
let floats = [], pax = [], drag = null, paint = null;
function showResult(title, rows, flavour){
  const m = $('#modal'); if(!m) return;
  m.hidden = false;
  m.innerHTML = `<div class="box kbox"><div class="kbar">${title}</div>
    <table class="krows">${rows.map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join('')}</table>
    ${flavour ? `<p class="muted" style="text-align:center">${flavour}</p>` : ''}
    <button class="btn pri" id="kok" style="width:100%">OK</button></div>`;
  $('#kok').onclick = () => { m.hidden = true; m.innerHTML = ''; };
}
const PCOL = ['#e8645f','#ffd166','#4be3a3','#8ec5ff','#c79bff','#ff9ad5','#9fe8e0'];
const SKIN = ['#f1c9a0','#e0b088','#c98f63','#8d5a3b'];
const HAIR = ['#3b2a1e','#6b4423','#111820','#a8742f','#d9c08a'];

/* --- airside model (stands, taxiways, runways) --- */
const tkey = (gx, gy) => gx*100 + gy;
const unkey = k => [k/100|0, k%100];
const tType = (gx, gy) => G.tiles[tkey(gx, gy)];
const standIdxAt = (gx, gy) => G.stands.findIndex(s => gx >= s.x && gx < s.x+SS && gy >= s.y && gy < s.y+SS);
const standCtr = i => { const s = G.stands[i]; return s ? [s.x + SS/2, s.y + SS/2] : null; };
const nTiles = t => Object.values(G.tiles).filter(v => v === t).length;
const taxiCost = () => Math.round(1200 * (1 + 0.05*nTiles('taxi')));
const runCost = () => Math.round(7000 * (1 + 0.07*nTiles('run')));
const layCost = (n, base, g) => { let c = 0; for(let k = 0; k < n; k++) c += Math.round(base*(1 + g*k)); return c; };
let rwCache, pathCache = {};
function invalidate(){ rwCache = undefined; pathCache = {}; landC = undefined; }

function runways(){
  if(rwCache !== undefined) return rwCache;
  const list = [];
  for(let gy = AIR; gy < GH; gy++){
    let run = 0;
    for(let gx = 0; gx <= GW; gx++){
      if(gx < GW && tType(gx, gy) === 'run') run++;
      else { if(run >= MIN_RUN) list.push({gy, x0:gx-run, x1:gx-1, len:run, id:tkey(gx-run, gy)}); run = 0; }
    }
  }
  return rwCache = list;
}
const longestRunway = () => runways().reduce((m, R) => !m || R.len > m.len ? R : m, null);
const runwayLen = () => { const r = longestRunway(); return r ? r.len*M_TILE : 0; };
/* Ground moves run on their own clock so a short hop does not taxi at a sprint:
   the taxi takes as long as the route is, and the roll is the same every time. */
const TAXI_TPS = 1.6, ROLL = 1.8;                             // taxiway tiles per second, seconds of roll
const gndTime = r => ((r && r.len) || 6)/TAXI_TPS + ROLL;     // seconds on the ground at each end
const flightTime = (air, gnd) => Math.max(air, 2*gnd + 2.5);  // a short hop still has to taxi both ends
const gndF = a => Math.min(0.48, (a.gnd || 5) / Math.max(a.dur, 0.1));   // ...as a share of the flight
const taxiF = a => Math.max(0, 1 - ROLL / Math.max(a.gnd || 5, ROLL + 0.1));  // taxi's share of that
function rwBooked(R){                                         // every roll and landing already due on R
  const w = [];
  for(const a of G.fleet){
    if(a.state !== 'flying' || a.rw !== R.id) continue;
    const t0 = G.time - a.t, g = gndF(a)*a.dur, tf = taxiF(a);
    w.push([t0 + g*tf, t0 + g], [t0 + a.dur - g, t0 + a.dur - g*tf]);
  }
  return w;
}
function rwFree(R, gnd, dur){        // keep clear of every roll and landing already due on this strip
  if(!R) return true;
  const g = Math.min(0.48*dur, gnd), tf = 1 - ROLL/gnd, PAD = 0.3;
  const mine = [[G.time + g*tf, G.time + g], [G.time + dur - g, G.time + dur - g*tf]];
  const booked = rwBooked(R);
  return !mine.some(([s, e]) => booked.some(([x, y]) => s - PAD < y && x < e + PAD));
}

function taxiRoutes(i){
  if(i in pathCache) return pathCache[i];
  const s = G.stands[i], RS = runways();
  if(!s || !RS.length) return pathCache[i] = [];
  const prev = new Map(), q = [];
  for(let gx = s.x-1; gx <= s.x+SS; gx++) for(let gy = s.y-1; gy <= s.y+SS; gy++){
    const ox = gx < s.x || gx >= s.x+SS, oy = gy < s.y || gy >= s.y+SS;
    if(ox === oy || !inAir(gx, gy) || tType(gx, gy) !== 'taxi') continue;
    const k = tkey(gx, gy); if(!prev.has(k)){ prev.set(k, null); q.push(k); }
  }
  for(let h = 0; h < q.length; h++){
    const [gx, gy] = unkey(q[h]);
    for(const [dx, dy] of DIRS){
      const nx = gx+dx, ny = gy+dy, nk = tkey(nx, ny);
      if(prev.has(nk) || !inAir(nx, ny) || tType(nx, ny) !== 'taxi') continue;
      prev.set(nk, q[h]); q.push(nk);
    }
  }
  const out = [];
  for(const R of RS){
    let goal = null;
    for(let gx = R.x0; gx <= R.x1 && goal === null; gx++) for(const [dx, dy] of DIRS){
      const k = tkey(gx+dx, R.gy+dy);
      if(prev.has(k)){ goal = k; break; }
    }
    if(goal === null) continue;
    const pts = [];
    for(let k = goal; k != null; k = prev.get(k)){ const [gx, gy] = unkey(k); pts.unshift([gx+.5, gy+.5]); }
    pts.unshift(standCtr(i));
    const [ggx, ggy] = unkey(goal), ex = ggy === R.gy ? (ggx < R.x0 ? R.x0 : R.x1) : ggx;
    pts.push([ex+.5, R.gy+.5]);
    if(ex !== R.x0) pts.push([R.x0+.5, R.gy+.5]);
    let len = 0;
    for(let n = 1; n < pts.length; n++) len += Math.hypot(pts[n][0]-pts[n-1][0], pts[n][1]-pts[n-1][1]);
    out.push({pts, R, len});
  }
  out.sort((a, b) => b.R.len - a.R.len);
  return pathCache[i] = out;
}
const taxiPath = i => taxiRoutes(i)[0] || null;
const routeFor = (i, id) => taxiRoutes(i).find(r => r.R.id === id) || taxiPath(i);
function walkPath(pts, f){
  const seg = []; let tot = 0;
  for(let i = 1; i < pts.length; i++){ const d = Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]); seg.push(d); tot += d; }
  if(!tot) return [pts[0][0], pts[0][1], 0];
  let want = clamp(f, 0, 1)*tot;
  for(let i = 0; i < seg.length; i++){
    if(want > seg[i] && i < seg.length-1){ want -= seg[i]; continue; }
    const u = seg[i] ? clamp(want/seg[i], 0, 1) : 0, a = pts[i], b = pts[i+1];
    return [a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u, Math.atan2(b[0]-a[0], -(b[1]-a[1]))];
  }
}

/* --- terminal interior --- */
const FAC = {
  checkin:  {name:'Check-in Desk', icon:'\u{1F6C4}', cost:9000,  dwell:2.6, fee:0,  mood:0,  col:'#5b8fd4', desc:'Every passenger must check in. Without one they give up and walk out.'},
  security: {name:'Security Lane', icon:'\u{1F6C2}', cost:14000, dwell:2.2, fee:0,  mood:-4, col:'#8a93a6', desc:'Every passenger must clear security before boarding.'},
  cafe:     {name:'Cafe',          icon:'☕',    cost:11000, dwell:3.0, fee:11, mood:10, col:'#d08b4a', desc:'Sells food to waiting passengers and lifts their mood.'},
  dutyfree: {name:'Duty-free',     icon:'\u{1F6CD}', cost:17000, dwell:3.2, fee:22, mood:8,  col:'#e8645f', desc:'The big earner. Happy passengers spend far more here.'},
  seats:    {name:'Seating',       icon:'\u{1FA91}', cost:4000,  dwell:3.6, fee:0,  mood:14, col:'#7ccf7a', desc:'Somewhere to rest. Cheap, and keeps moods high.'},
  toilet:   {name:'Restroom',      icon:'\u{1F6BB}', cost:6000,  dwell:2.0, fee:0,  mood:9,  col:'#6fc6d0', desc:'Basic comfort. Moods sag without one.'},
  vending:  {name:'Vending Machine', icon:'\u{1F964}', cost:3000,  dwell:1.1, fee:5,  mood:3,  col:'#c05fa8', desc:'Cheap and very fast. Serves a crowd a restaurant never could.'},
  news:     {name:'Newsstand',       icon:'\u{1F4F0}', cost:7000,  dwell:1.8, fee:9,  mood:5,  col:'#9a8f7a', desc:'Quick impulse buys on the way to the gate.'},
  exchange: {name:'Currency Exchange', icon:'\u{1F4B1}', cost:13000, dwell:2.4, fee:17, mood:0, col:'#4fae87', desc:'Steady commission, but nobody enjoys the queue.'},
  restaurant:{name:'Restaurant',     icon:'\u{1F37D}', cost:26000, dwell:4.2, fee:38, mood:16, col:'#d4603f', desc:'Big spend and a big mood lift, but it ties a passenger up for ages.'},
  lounge:   {name:'Premium Lounge',  icon:'\u{1F6CB}', cost:40000, dwell:5.0, fee:55, mood:22, col:'#b98cd8', desc:'The richest stop in the terminal. Slow, pricey, and passengers love it.'},
  play:     {name:"Kids' Play Area", icon:'\u{1F9F8}', cost:9000,  dwell:4.0, fee:0,  mood:18, col:'#f2a93b', desc:'No income, but families leave in a far better mood.'},
  garden:   {name:'Indoor Garden',   icon:'\u{1FAB4}', cost:8000,  passive:true, aura:3.2, rate:2.4, col:'#4f9a52', desc:'No queue. Slowly lifts the mood of every passenger standing near it.'},
  info:     {name:'Information Desk', icon:'\u2139',   cost:10000, passive:true, aura:3.6, col:'#5fa8d8', desc:'No queue. Passengers queueing nearby lose patience far more slowly.'},
};
const AMEN = ['cafe','dutyfree','seats','toilet','vending','news','exchange','restaurant','lounge','play'];
// True when a passenger stands within reach of a passive facility of this kind.
function nearPassive(p, kind){
  for(const e of facList(kind)) if(Math.hypot(e.gx+.5-p.x, e.gy+.5-p.y) <= FAC[kind].aura) return true;
  return false;
}
const facAt = (gx, gy) => G.fac[tkey(gx, gy)];
const facList = k => Object.keys(G.fac).filter(j => G.fac[j].k === k).map(j => ({key:+j, f:G.fac[j], gx:(+j/100|0), gy:(+j)%100}));
const facCount = k => facList(k).length;
const ENTRY = () => [hallW()-1.5, HALL0 + 0.5];

function seedHall(){
  G.fac = {};
  G.fac[tkey(7, 3)] = {k:'checkin', q:[]};                    // passengers come in at the right and work left
  G.fac[tkey(3, 4)] = {k:'security', q:[]};
}
const freeHallTile = () => {
  for(let gy = HALL0; gy <= HALL1; gy++) for(let gx = 0; gx < hallW(); gx++)
    if(!G.fac[tkey(gx, gy)]) return [gx, gy];
  return null;
};
function ensureHall(){
  if(!G.fac) seedHall();
  for(const j in G.fac){
    const f = G.fac[j];
    if(!f.q) f.q = [];
    else if(f.q.length && f.q.some(p => !p || p.s !== SESS)) f.q = f.q.filter(p => p && p.s === SESS);
  }
}

/* --- passengers --- */
const PAX_MAX = 70, SESS = Math.random();
const paxFee = f => Math.round(FAC[f].fee * (1 + G.level*0.16) * revMult());
function spawnPax(n){
  for(let i = 0; i < n && pax.length < PAX_MAX; i++){
    const [ex, ey] = ENTRY();
    pax.push({s:SESS, x:ex, y:ey + (Math.random()-0.5)*1.2, step:'checkin', at:null, slot:0, t:0,
      mood:62 + Math.random()*22, c1:PCOL[(Math.random()*PCOL.length)|0],
      sk:SKIN[(Math.random()*SKIN.length)|0], hr:HAIR[(Math.random()*HAIR.length)|0],
      em:null, et:0, spent:0, visits:0, flip:true, bag:Math.random() < .55, bob:Math.random()*6});
  }
}
function paxArrive(seats){ spawnPax(clamp(Math.round(seats/28), 1, 6)); }
function emote(p, e){ p.em = e; p.et = 2.2; }
function pickFac(p, kind){
  const list = facList(kind);
  if(!list.length) return null;
  let best = null;
  for(const e of list){
    const d = Math.hypot(e.gx+.5-p.x, e.gy+.5-p.y) + e.f.q.length*2.2;   // nearest with the shortest queue
    if(!best || d < best.d) best = {d, e};
  }
  return best.e;
}
function leaveFac(p){
  if(!p.at) return;
  const f = G.fac[p.at.key];
  if(f) f.q = f.q.filter(z => z !== p);
  p.at = null;
}
function paxStep(dt){
  for(let i = pax.length - 1; i >= 0; i--){
    const p = pax[i];
    if(p.et > 0) p.et -= dt;
    p.bob += dt*9;
    if(facCount('garden') && nearPassive(p, 'garden')) p.mood = Math.min(100, p.mood + dt*FAC.garden.rate);
    if(p.step === 'gone'){ pax.splice(i, 1); continue; }
    if(p.step === 'leave' || p.step === 'board'){                       // walk out of the hall
      const ty = p.step === 'board' ? HALL1 + 1.7 : HALL0 - 1.4;
      const dy = ty - p.y, v = Math.min(dt*1.6, Math.abs(dy));
      p.y += Math.sign(dy)*v;
      if(Math.abs(ty - p.y) < 0.06) p.step = 'gone';
      continue;
    }
    if(!p.at){                                                          // decide where to go next
      let kind = p.step === 'checkin' || p.step === 'security' ? p.step : null;
      if(p.step === 'amenity'){
        const open = AMEN.filter(k => facCount(k));
        if(!open.length || p.visits >= (p.mood > 70 ? 3 : 2)){ p.step = 'board'; continue; }
        kind = open[(Math.random()*open.length)|0];
      }
      const e = kind ? pickFac(p, kind) : null;
      if(!e){
        p.t += dt;                                                      // nothing to use: give up and leave
        if(p.t > 5){ p.mood = 12; emote(p, 'angry'); p.step = 'leave'; G.paxLost = (G.paxLost||0) + 1; }
        continue;
      }
      p.at = {key:e.key, gx:e.gx, gy:e.gy}; e.f.q.push(p); p.t = 0;
    }
    const f = G.fac[p.at.key];
    if(!f){ leaveFac(p); continue; }
    p.slot = Math.max(0, f.q.indexOf(p));
    const qn = Math.min(p.slot, 5), row = Math.floor(p.slot/6)*0.42;
    const tx = p.at.gx + .5 + qn*0.42 - row, ty = p.at.gy + .5 + (p.slot ? 0.58 + row : 0.66);
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if(d > 0.06){ const v = Math.min(dt*1.3, d); p.x += dx/d*v; p.y += dy/d*v; p.flip = dx < 0; continue; }
    if(p.slot > 0){
      const drain = facCount('info') && nearPassive(p, 'info') ? 0.6 : 1.7;
      p.mood = Math.max(0, p.mood - dt*drain);
      if(p.mood < 30 && !p.em) emote(p, 'wait');
      continue;
    }
    p.t += dt;
    const D = FAC[f.k];
    if(p.t < D.dwell) continue;
    if(D.fee){                                                          // served: take their money
      const m = paxFee(f.k) * (0.6 + p.mood/140);
      G.cash += m; G.acc += m; G.paxRev = (G.paxRev||0) + m; p.spent += m; emote(p, 'buy');
    }
    p.mood = clamp(p.mood + D.mood, 0, 100);
    if(D.mood >= 9 && !p.em) emote(p, 'happy');
    if(f.k !== 'checkin' && f.k !== 'security') p.visits++;
    leaveFac(p); p.t = 0;
    p.step = f.k === 'checkin' ? 'security' : 'amenity';
  }
}
const paxHappy = () => pax.length ? pax.reduce((s, p) => s + p.mood, 0)/pax.length : 70;


/* --- airport setup and migration --- */
function ensureAirport(){
  G.layout = G.layout || {};
  ensureHall();
  if(!G.tiles || !G.stands) seedAirport();
  else migrateGeo();
  if(Object.values(G.layout).some(p => p >= nPlots())) G.layout = {};
  const used = new Set(Object.values(G.layout));
  for(const id of BUILD) if(G.upg[id] && G.layout[id] == null){
    let p = 0; while(used.has(p)) p++;
    G.layout[id] = p; used.add(p);
  }
}
function migrateGeo(){
  if((G.geo||0) < 2){                                   // older saves: slide the airside below the hall
    const shift = 5, t = {};
    for(const k in G.tiles){ const [gx, gy] = unkey(+k); t[tkey(gx, gy + shift)] = G.tiles[k]; }
    G.tiles = t;
    G.stands = G.stands.map(s => ({x:s.x, y:s.y + shift}));
    G.geo = 2; invalidate();
  }
  if((G.geo||0) >= GEO) return;
  const old = G.land, own = (gx, gy) => { if(gx >= 0 && gx < GW && gy >= 0 && gy < GH) G.land[bIdx(gx, gy)] = 1; };
  G.land = {0:1};                                       // block size changed: re-derive ownership from the map
  if((G.geo||0) === 3) for(const b in old){             // land bought as 10x10 blocks, re-owned as 12x12 ones
    const bx = +b % 6, by = (+b / 6)|0;
    for(const [dx, dy] of [[0,0],[9,0],[0,9],[9,9]]) own(bx*10 + dx, by*10 + dy);
  }
  for(const k in G.tiles){ const [gx, gy] = unkey(+k); own(gx, gy); }
  for(const st of G.stands){ own(st.x, st.y); own(st.x+SS-1, st.y+SS-1); }
  for(const j in G.fac){ const [gx, gy] = unkey(+j); own(gx, gy); }
  for(const p of Object.values(G.layout)) own(p+1, 0);
  landC = undefined;
  for(const j of Object.keys(G.fac)){                   // the hall is shallower now: rescue anything outside it
    const [gx, gy] = unkey(+j);
    if(gy >= HALL0 && gy <= HALL1 && open(gx, gy)) continue;
    const spot = freeHallTile();
    if(spot) G.fac[tkey(spot[0], spot[1])] = G.fac[j];
    else G.cash += FAC[G.fac[j].k].cost*0.5;
    delete G.fac[j];
  }
  G.geo = GEO; invalidate();
}
function seedAirport(){
  G.tiles = {}; G.stands = []; G.geo = GEO;
  const W = hallW(), per = Math.max(1, Math.floor((W-1)/3));
  const put = (gx, gy, t) => { if(inAir(gx, gy)) G.tiles[tkey(gx, gy)] = t; };
  const want = clamp(G.fleet.length || 1, 1, Math.min(gates(), per*2));
  const rowA = Math.min(want, per), rowB = Math.max(0, want - per);
  for(let i = 0; i < rowA; i++) G.stands.push({x: 1 + i*3, y: AIR});
  for(let i = 0; i < rowB; i++) G.stands.push({x: 1 + i*3, y: AIR + 4});
  G.stands = G.stands.filter(st => inAir(st.x, st.y) && inAir(st.x+SS-1, st.y+SS-1));
  const lane = AIR + 3, lane2 = AIR + 7;
  const maxx = rowB ? W-1 : Math.min(W-1, 1 + rowA*3);
  for(let gx = 0; gx <= maxx; gx++) put(gx, lane, 'taxi');
  if(rowB){
    for(let gx = 0; gx <= maxx; gx++) put(gx, lane2, 'taxi');
    for(let gy = lane+1; gy < lane2; gy++) put(W-1, gy, 'taxi');
  }
  const down = rowB ? lane2 : lane, rwy = down + 2;
  for(let gy = down+1; gy < rwy; gy++) put(0, gy, 'taxi');
  const need = G.fleet.reduce((m, a) => Math.max(m, RWY[a.type]), 500);
  const len = clamp(Math.ceil(need/M_TILE), 3, W);
  for(let gx = 0; gx < len; gx++) put(gx, rwy, 'run');
  invalidate();
}
// Charged in full and never refunded, so it can't be looped against demolition refunds for free cash.
function reseedAirport(confirmFn){
  const old = {tiles: G.tiles, stands: G.stands};
  seedAirport();
  const fee = layCost(nTiles('taxi'), 1200, 0.05) + layCost(nTiles('run'), 7000, 0.07);
  const undo = () => { G.tiles = old.tiles; G.stands = old.stands; invalidate(); };
  if(G.cash < fee){ undo(); toast(`Rebuilding costs ${money(fee)} — not enough cash.`); return false; }
  if(confirmFn && !confirmFn(fee)){ undo(); return false; }
  G.cash -= fee; sel = null;
  logMsg(`\u{1F3D7}️ Airport rebuilt on the standard layout for ${money(fee)}.`);
  return true;
}
function autoExtendRunway(){
  const R = longestRunway();
  if(!R) return false;
  for(const gx of [R.x0-1, R.x1+1]) if(inAir(gx, R.gy) && !tType(gx, R.gy) && standIdxAt(gx, R.gy) < 0){
    const c = runCost(); if(G.cash < c) return false;
    G.cash -= c; G.tiles[tkey(gx, R.gy)] = 'run'; invalidate(); return true;
  }
  return false;
}
function autoPlaceStand(){
  for(let gy = AIR; gy + SS <= GH; gy++) for(let gx = 0; gx + SS <= GW; gx++){
    let clear = true, linked = false;
    for(let a = 0; a < SS && clear; a++) for(let b = 0; b < SS; b++)
      if(tType(gx+a, gy+b) || standIdxAt(gx+a, gy+b) >= 0){ clear = false; break; }
    if(!clear) continue;
    for(let a = 0; a < SS && !linked; a++) for(const [cx, cy] of [[gx+a, gy-1], [gx+a, gy+SS], [gx-1, gy+a], [gx+SS, gy+a]])
      if(inAir(cx, cy) && tType(cx, cy) === 'taxi'){ linked = true; break; }
    if(linked){ G.stands.push({x:gx, y:gy}); invalidate(); return true; }
  }
  return false;
}

/* --- drawing helpers --- */
function shade(hex, f){
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.min(255,(n>>16)*f|0)},${Math.min(255,(n>>8&255)*f|0)},${Math.min(255,(n&255)*f|0)})`;
}
function poly(x, pts, fill, line){
  x.beginPath(); pts.forEach(([a,b], i) => i ? x.lineTo(a,b) : x.moveTo(a,b)); x.closePath();
  if(fill){ x.fillStyle = fill; x.fill(); }
  if(line){ x.strokeStyle = line; x.lineWidth = 1; x.stroke(); }
}
function tile(x, gx, gy, w, d, fill, line, z = 0){ poly(x, [iso(gx,gy,z), iso(gx+w,gy,z), iso(gx+w,gy+d,z), iso(gx,gy+d,z)], fill, line); }
function box(x, gx, gy, w, d, h, top, left, right){
  poly(x, [iso(gx+w,gy,0), iso(gx+w,gy+d,0), iso(gx+w,gy+d,h), iso(gx+w,gy,h)], right, 'rgba(0,0,0,.4)');
  poly(x, [iso(gx,gy+d,0), iso(gx+w,gy+d,0), iso(gx+w,gy+d,h), iso(gx,gy+d,h)], left, 'rgba(0,0,0,.4)');
  poly(x, [iso(gx,gy,h), iso(gx+w,gy,h), iso(gx+w,gy+d,h), iso(gx,gy+d,h)], top, 'rgba(0,0,0,.3)');
}

// Chibi passenger: big head, two eyes, little body. Scales with the zoom level.
function drawPerson(x, gx, gy, p, night){
  const s = TW()/44, [X, Y] = iso(gx, gy);
  const hop = p.at || p.step === 'gone' ? 0 : Math.abs(Math.sin(p.bob))*1.6*s;
  const bx = X, by = Y - hop;
  x.fillStyle = 'rgba(0,0,0,.22)';
  x.beginPath(); x.ellipse(X, Y+1, 6*s, 2.6*s, 0, 0, 7); x.fill();
  x.fillStyle = p.c1; x.fillRect(bx-3.4*s, by-10*s, 6.8*s, 7*s);          // body
  x.fillStyle = shade(p.c1, .75); x.fillRect(bx-3.4*s, by-3.6*s, 6.8*s, 1.4*s);
  if(p.bag){ x.fillStyle = '#4a3b2a'; x.fillRect(bx + (p.flip?-6.4:3.6)*s, by-7*s, 3*s, 4*s); }
  x.fillStyle = p.sk;                                                      // head
  x.beginPath(); x.arc(bx, by-13.6*s, 5.2*s, 0, 7); x.fill();
  x.fillStyle = p.hr;                                                      // hair
  x.beginPath(); x.arc(bx, by-14.6*s, 5.2*s, Math.PI*1.04, Math.PI*2.0); x.fill();
  const ex = p.flip ? -1 : 1;
  x.fillStyle = '#20252e';
  x.fillRect(bx + (ex*0.6-2.4)*s, by-13.8*s, 1.5*s, 1.9*s);
  x.fillRect(bx + (ex*0.6+1.0)*s, by-13.8*s, 1.5*s, 1.9*s);
  const sad = p.mood < 35;
  x.fillStyle = sad ? '#b4404a' : '#8a5a4a';
  x.fillRect(bx-1.2*s, by-(sad?10.6:11.0)*s, 2.4*s, 0.9*s);
  if(p.em && p.et > 0){                                                    // emote bubble
    const T = {happy:['♥','#ff8fb0'], buy:['$','#ffd166'], wait:['…','#cbd6e8'], angry:['!','#ff6b6b']}[p.em];
    const px = bx + 7*s, py = by - 20*s;
    x.fillStyle = 'rgba(255,255,255,.94)';
    x.beginPath(); x.arc(px, py, 6.2*s, 0, 7); x.fill();
    x.beginPath(); x.moveTo(px-3*s, py+4*s); x.lineTo(px-1*s, py+8*s); x.lineTo(px+1*s, py+4.5*s); x.closePath(); x.fill();
    x.fillStyle = T[1]; x.font = `bold ${Math.round(9*s)}px system-ui`; x.textAlign = 'center';
    x.fillText(T[0], px, py + 3.4*s);
  }
}

function drawFacility(x, gx, gy, f, night){
  const D = FAC[f.k], s = TW()/44, h = 11*s;
  if(D.passive){
    const [PX, PY] = iso(gx+.5, gy+.5);
    x.fillStyle = 'rgba(255,255,255,.10)';
    x.beginPath(); x.ellipse(PX, PY, D.aura*TW()/2, D.aura*TH()/2, 0, 0, 7); x.fill();
    box(x, gx+.28, gy+.28, .44, .44, 7*s, shade(D.col,1.2), D.col, shade(D.col,.7));
  } else if(f.k === 'seats'){
    for(let r = 0; r < 2; r++){
      box(x, gx+.12, gy+.12+r*.45, .76, .3, 5*s, shade(D.col,1.2), D.col, shade(D.col,.7));
    }
  } else {
    box(x, gx+.1, gy+.14, .8, .62, h, shade(D.col,1.25), D.col, shade(D.col,.68));
    const [TX, TY] = iso(gx+.5, gy+.45, h);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(TX-8*s, TY-2*s, 16*s, 3.2*s);   // counter top
  }
  const [X, Y] = iso(gx+.5, gy+.5, h + 4*s);
  x.font = `${Math.round(15*s)}px serif`; x.textAlign = 'center'; x.fillText(D.icon, X, Y);
  if(f.q && f.q.length > 1){
    x.fillStyle = f.q.length > 3 ? '#ff7b7b' : '#ffd166';
    x.fillRect(X+9*s, Y-9*s, 11*s, 9*s);
    x.fillStyle = '#10204a'; x.font = `bold ${Math.round(8*s)}px monospace`;
    x.fillText(f.q.length, X+14.5*s, Y-2*s);
  }
  if(sel && sel.fac === tkey(gx, gy)){ x.lineWidth = 2; tile(x, gx, gy, 1, 1, null, '#ffe36b'); }
}

function drawPlane(x, wx, wy, t, col, rot, z){
  const w = WP(), L = 14 + t*3.2, S = 16 + Math.round(t*3.4), fw = t > 4 ? 7 : 5, k = TW()/(2*w);
  const [X, Y] = iso(wx, wy);
  const wz = Math.max(2, Math.round(1.2*k)), bh = Math.max(3, Math.round((2 + t*0.55)*k));
  const hull = () => { x.fillRect(-fw/2, -L/2+1, fw, L-1); x.fillRect(-fw/2+1, -L/2, fw-2, 1); };
  const wing = mono => {
    const C = c => mono || c;
    x.fillStyle = C('#cbd6e8');
    for(let q = 0; q < S/2; q++){ const o = Math.floor(q*0.4); x.fillRect(-fw/2-q-1, o, 1, 4); x.fillRect(fw/2+q, o, 1, 4); }
    x.fillStyle = C('#aab8d0'); x.fillRect(-S*0.2, L/2-3, S*0.4, 3);
  };
  const eng = mono => {
    x.fillStyle = mono || '#5a6478';
    if(t === 0) x.fillRect(-4, -L/2-1, 8, 2);
    else for(const sx of (t === 7 ? [-.32,-.17,.17,.32] : [-.26,.26])) x.fillRect(Math.round(S*sx)-1, 3 + Math.floor(Math.abs(S*sx)*0.4), 3, 5);
  };
  const body = mono => {
    if(mono){ x.fillStyle = mono; return hull(); }
    x.fillStyle = '#f7fafe'; hull();
    x.fillStyle = col; x.fillRect(-fw/2, -L/2+L*0.3, fw, 3);
    x.fillStyle = '#37577f'; x.fillRect(-fw/2+1, -L/2+1, fw-2, 3);
  };
  const at = (f, oy, mono) => { x.setTransform(k, k/2, -k, k/2, X, Y-z+oy); x.rotate(rot); f(mono); };
  const edge = (f, oy) => { for(const [ox, oy2] of DIRS){ x.setTransform(k, k/2, -k, k/2, X+ox, Y-z+oy+oy2); x.rotate(rot); f('#13213f'); } };
  x.setTransform(k, k/2, -k, k/2, X + (z > 0.5 ? z*0.4 : 1), Y);  // ground shadow
  x.rotate(rot); wing('rgba(0,0,0,.28)'); body('rgba(0,0,0,.28)');
  for(let d = 0; d < wz; d++) at(eng, -d, '#39425a');           // engine pods hang under the wing
  at(eng, -wz);
  edge(wing, -wz-1);
  at(wing, -wz, '#8e9cb6'); at(wing, -wz-1);
  edge(body, -wz-bh);
  for(let d = 0; d < bh; d++) at(body, -wz-d, shade('#d4deef', 0.62 + 0.38*d/bh));   // fuselage sides
  at(body, -wz-bh);
  x.setTransform(1, 0, 0, 1, 0, 0);
  const lx = -Math.sin(rot)*L/2, ly = Math.cos(rot)*L/2, tx = X + (lx-ly)*k, ty = Y - z + (lx+ly)*k/2 - wz - bh;
  const dl = Math.hypot((lx-ly)*k, (lx+ly)*k/2) || 1, ux = (lx-ly)*k/dl, uy = (lx+ly)*k/2/dl;   // nose -> tail, on screen
  const fh = (3.5 + t*0.8)*k, root = 3.4*k, sweep = 2.3*k;
  poly(x, [[tx - ux*root, ty - uy*root], [tx + ux*k*0.5, ty + uy*k*0.5],
           [tx + ux*k*0.8 - 0, ty + uy*k*0.8 - fh], [tx - ux*(root-sweep), ty - uy*(root-sweep) - fh]], col, '#13213f');
}
function drawBuilding(x, gx, gy, id, lvl, night){
  const h = bldH(lvl), fl = Math.min(4, 1 + Math.floor(lvl/3)), b = BCOL[id], s = TW()/44;
  box(x, gx+.1, gy+.1, .8, .8, h, shade(b, 1.25), shade(b, 1), shade(b, .68));
  const [X, Y] = iso(gx+.5, gy+.5, h);
  x.font = `${Math.round(13*s)}px serif`; x.textAlign = 'center'; x.fillText(UPG[id].icon, X, Y+3*s);
  x.fillStyle = '#10204a'; x.fillRect(X+5*s, Y+3*s, 13*s, 9*s);
  x.fillStyle = '#fff'; x.font = `bold ${Math.round(8*s)}px monospace`; x.fillText(lvl, X+11.5*s, Y+10*s);
}
function drawTree(x, gx, gy){
  const s = TW()/44, [X, Y] = iso(gx+.5, gy+.5);
  x.fillStyle = '#6b4a2b'; x.fillRect(X-1.4*s, Y-6*s, 2.8*s, 7*s);
  poly(x, [[X, Y-26*s], [X+10*s, Y-15*s], [X, Y-5*s], [X-10*s, Y-15*s]], '#2f8a3c', 'rgba(0,0,0,.3)');
  poly(x, [[X, Y-26*s], [X+7*s, Y-18*s], [X, Y-12*s], [X-7*s, Y-18*s]], '#43a64f');
}

function drawFlying(x, a, i, col){
  const p = a.t/a.dur, P = routeFor(i, a.rw);
  if(!P) return;
  const R = P.R, up = 26*TW()/44, G0 = gndF(a), TF = taxiF(a), nt = 1 - TF;
  if(p < G0){
    const u = p/G0;
    if(u < TF){ const [wx, wy, r] = walkPath(P.pts, u/TF); drawPlane(x, wx, wy, a.type, col, r, 0); }
    else { const v = (u-TF)/nt, z = v > 0.7 ? (v-0.7)/0.3*up : 0;
      drawPlane(x, R.x0+.5 + (R.x1-R.x0)*v*v, R.gy+.5, a.type, col, Math.PI/2, z); }
  } else if(p > 1-G0){
    const v = (p-(1-G0))/G0;
    if(v < nt*0.59){ const u = v/(nt*0.59); drawPlane(x, R.x1+.5 + (1-u)*9, R.gy+.5, a.type, col, -Math.PI/2, (1-u)*up); }
    else if(v < nt){ const u = (v-nt*0.59)/(nt*0.41); drawPlane(x, R.x1+.5 - (R.x1-R.x0)*(1-(1-u)*(1-u)), R.gy+.5, a.type, col, -Math.PI/2, 0); }
    else { const u = (v-nt)/TF, [wx, wy, r] = walkPath(P.pts, 1-u); drawPlane(x, wx, wy, a.type, col, r+Math.PI, 0); }
  }
}

/* --- the Kairosoft chrome bar --- */
const DAY = 150;                                     // real seconds in one in-game day
function gameClock(){
  const d = G.time/DAY, days = Math.floor(d);
  const frac = d - days, mins = Math.floor(frac*24*60);
  return {yr: Math.floor(days/48) + 1, mo: Math.floor(days/4)%12 + 1, dy: days%4 + 1,
    hh: String(Math.floor(mins/60)).padStart(2,'0'), mm: String(Math.floor(mins%60/10)*10).padStart(2,'0')};
}
function drawHUD(x){
  const C = gameClock();
  x.fillStyle = '#2a2d6e'; x.fillRect(0, 0, CW, HUD);
  x.fillStyle = '#4448a8'; x.fillRect(0, 0, CW, 3);
  x.fillStyle = '#1b1d50'; x.fillRect(0, HUD-3, CW, 3);
  x.textAlign = 'left'; x.font = 'bold 15px monospace'; x.fillStyle = '#ffd166';
  x.fillText(`${C.yr}yr`, 12, 21);
  x.fillStyle = '#fff'; x.font = 'bold 13px monospace';
  x.fillText(`${C.mo}mo ${C.dy}d`, 52, 21);
  x.fillStyle = '#9fb6e8'; x.fillText(`${C.hh}:${C.mm}`, 126, 21);
  if(speed !== 1){
    x.fillStyle = speed ? '#4be3a3' : '#ffd166';
    x.fillText(speed ? speed + '×' : 'PAUSED', 400, 21);
  }
  x.fillStyle = '#0e1030'; x.fillRect(CW-212, 5, 204, HUD-10);
  x.textAlign = 'right'; x.fillStyle = '#ffe36b'; x.font = 'bold 15px monospace';
  x.fillText(money(G.cash) + 'G', CW-14, 21);
  x.textAlign = 'left'; x.fillStyle = '#8ec5ff'; x.font = 'bold 12px monospace';
  x.fillText(`\u{1F464} ${pax.length}`, 188, 21);
  x.fillStyle = paxHappy() > 60 ? '#4be3a3' : paxHappy() > 35 ? '#ffd166' : '#ff7b7b';
  x.fillText(`♥ ${Math.round(paxHappy())}%`, 248, 21);
  x.fillStyle = '#cbd6e8'; x.fillText(`✈ ${fmt(G.flights)}`, 318, 21);
}


/* --- main render --- */
function centreCam(){
  const [X, Y] = iso(hallW()/2, HALL1 + 1.5);
  cam.x += CW/2 - X; cam.y += (CH+HUD)/2 - Y + 20; cam.set = true;
}
function drawScene(dt){
  const c = $('#scene'); if(!c) return;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  ensureAirport();
  if(!cam.set) centreCam();
  const night = Math.max(0, Math.sin(G.time/110)) * 0.42, col = G.brand.color;
  const RS = runways(), s = TW()/44;
  const painting = mode !== 'sel' && mode !== 'del';
  x.fillStyle = '#2d6b35'; x.fillRect(0, 0, CW, CH);

  const LI = landInfo(), SALE = buyableLand();
  const gx1 = Math.min(GW-1, LI.x1 + BS), gy1 = Math.min(GH-1, LI.y1 + BS);
  for(let gy = 0; gy <= gy1; gy++) for(let gx = 0; gx <= gx1; gx++){
    const [sx, sy] = iso(gx, gy);
    if(sx < -TW() || sx > CW + TW() || sy < -TH()*4 || sy > CH + TH()*6) continue;   // cull offscreen
    const ch = (gx+gy) & 1;
    if(!open(gx, gy)){
      if(SALE.has(bIdx(gx, gy))) tile(x, gx, gy, 1, 1, ch ? '#2b5f33' : '#27582f', ch ? '#2b5f33' : '#27582f');
      continue;
    }
    let f;
    if(gy === 0) f = ch ? '#6cc15a' : '#62b650';
    else if(gy === 1) f = ch ? '#d9d0b4' : '#cdc4a8';
    else if(gy <= HALL1) f = ch ? '#efe6d8' : '#e7ddcd';                  // terminal floor
    else {
      const t = tType(gx, gy);
      f = t === 'run' ? (ch ? '#3d424a' : '#363b42') : t === 'taxi' ? (ch ? '#767c87' : '#6e747f')
        : standIdxAt(gx, gy) >= 0 ? (ch ? '#9aa0ab' : '#929aa3') : (ch ? '#5aa84a' : '#52a043');
    }
    tile(x, gx, gy, 1, 1, f, f);
    if(painting){
      const ok = mode === 'taxi' || mode === 'run' || mode === 'stand'
        ? inAir(gx, gy) && !tType(gx, gy) && standIdxAt(gx, gy) < 0
        : inHall(gx, gy) && !facAt(gx, gy);
      if(ok) tile(x, gx+.1, gy+.1, .8, .8, 'rgba(255,255,255,.16)', 'rgba(255,255,255,.34)');
    }
    if(gy >= AIR && tType(gx, gy) === 'taxi'){ const [X, Y] = iso(gx+.5, gy+.5); x.fillStyle = '#f0c34a'; x.fillRect(X-6*s, Y-1.5*s, 12*s, 3*s); }
  }
  for(const R of RS){
    for(let gx = R.x0; gx <= R.x1; gx++){ const [X, Y] = iso(gx+.5, R.gy+.5); x.fillStyle = '#fff'; x.fillRect(X-8*s, Y-1.5*s, 16*s, 3*s); }
    const [LX, LY] = iso(R.x0+.5, R.gy+.5);
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = `bold ${Math.round(9*s)}px monospace`; x.textAlign = 'center';
    x.fillText(R.len*M_TILE + 'm', LX - 22*s, LY + 12*s);
    if(sel && sel.rwy === R.id){ x.lineWidth = 2; tile(x, R.x0, R.gy, R.len, 1, null, '#ffe36b'); }
  }
  for(let i = 0; i < G.stands.length; i++){
    const st = G.stands[i], [X, Y] = iso(st.x+SS/2, st.y+SS/2);
    tile(x, st.x+.06, st.y+.06, SS-.12, SS-.12, null, '#f0c34a');
    x.fillStyle = 'rgba(255,255,255,.5)'; x.font = `bold ${Math.round(9*s)}px monospace`; x.textAlign = 'center';
    x.fillText(i+1, X, Y + 22*s);
    if(sel && sel.stand === i){ x.lineWidth = 2; tile(x, st.x, st.y, SS, SS, null, '#ffe36b'); }
  }
  for(const b of SALE){                                   // price tag on each block you could buy next
    const bx = b % BW, by = (b/BW)|0, c = landCost(b);
    const [LX, LY] = iso(bx*BS + BS/2, by*BS + BS/2);
    if(LX < -90 || LX > CW + 90 || LY < -40 || LY > CH + 40) continue;
    x.lineWidth = 2;
    tile(x, bx*BS+.25, by*BS+.25, BS-.5, BS-.5, null, sel && sel.land === b ? '#ffe36b' : 'rgba(255,255,255,.28)');
    x.textAlign = 'center';
    x.fillStyle = 'rgba(8,20,14,.72)'; x.fillRect(LX-40*s, LY-13*s, 80*s, c.tok ? 26*s : 17*s);
    x.fillStyle = G.cash >= c.cash ? '#ffe36b' : '#ff9a9a';
    x.font = `bold ${Math.round(11*s)}px monospace`;
    x.fillText(money(c.cash), LX, LY);
    if(c.tok){
      x.fillStyle = G.tok >= c.tok ? '#9fe8ff' : '#ff9a9a';
      x.font = `bold ${Math.round(10*s)}px monospace`;
      x.fillText(TOKEN + ' ' + c.tok, LX, LY + 11*s);
    }
  }
  // landside row: upgrade buildings and trees
  const bAt = {}; BUILD.forEach(id => { bAt[G.layout[id]] = id; });
  for(let gx = 0; gx < hallW(); gx++){
    if(isPlot(gx, 0)){
      const p = plotAt(gx, 0), id = bAt[p];
      if(id) drawBuilding(x, gx, 0, id, G.upg[id], night);
      else {
        const [X, Y] = iso(gx+.5, .5);
        tile(x, gx+.12, .12, .76, .76, 'rgba(255,255,255,.16)', 'rgba(255,255,255,.4)');
        x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(X-1.5*s, Y-5*s, 3*s, 10*s); x.fillRect(X-6*s, Y-1.5*s, 12*s, 3*s);
      }
      if(sel && (sel.plot === p || (id && sel.bld === id))){ x.lineWidth = 2; tile(x, gx, 0, 1, 1, null, '#ffe36b', id ? bldH(G.upg[id]) : 0); }
    } else drawTree(x, gx, 0);
  }
  // terminal back wall, with the entrance doors at the right
  const HW = hallW();
  box(x, 0, HALL0-0.14, HW, 0.14, 20*s, '#e4ecf6', '#cdd8e8', '#9fb0c8');
  box(x, -0.14, HALL0-0.14, 0.14, HALL1-HALL0+1.14, 20*s, '#e4ecf6', '#cdd8e8', '#9fb0c8');
  box(x, HW, HALL0-0.14, 0.14, HALL1-HALL0+1.14, 20*s, '#dbe4f0', '#c3cfe0', '#95a6be');
  const [EX, EY] = iso(HW-2, HALL0);
  x.fillStyle = night > .3 ? '#ffe9a0' : '#5b8fd4'; x.fillRect(EX-10*s, EY-16*s, 26*s, 14*s);
  // interior contents and people, painter-ordered by depth
  const items = [];
  for(const j in G.fac){ const [gx, gy] = unkey(+j); items.push({d:gx+gy, fn:() => drawFacility(x, gx, gy, G.fac[j], night)}); }
  for(const p of pax) items.push({d:p.x+p.y+0.4, fn:() => drawPerson(x, p.x, p.y, p, night)});
  for(let i = 0; i < G.stands.length; i++){
    const a = G.fleet[i], ctr = standCtr(i);
    if(!a || !ctr) continue;
    if(a.state === 'flying'){ items.push({d:999, fn:() => drawFlying(x, a, i, col)}); continue; }
    items.push({d:ctr[0]+ctr[1], fn:() => {
      drawPlane(x, ctr[0], ctr[1], a.type, col, 0, 0);
      const bad = ['grounded','nofuel','noroute','notaxi','shortrwy'].includes(a.state);
      if(bad || a.state === 'check' || a.state === 'hold'){
        const [X, Y] = iso(ctr[0]+1, ctr[1]-1, 34*s);
        x.fillStyle = bad ? '#ff7b7b' : '#ffd166'; x.fillRect(X-7*s, Y-7*s, 15*s, 15*s);
        x.fillStyle = '#10204a'; x.font = `bold ${Math.round(11*s)}px monospace`; x.textAlign = 'center';
        x.fillText(bad ? '!' : a.state === 'hold' ? 'H' : '*', X, Y+4*s);
      }
      if(sel && sel.ac === a.id){ x.lineWidth = 2; tile(x, G.stands[i].x, G.stands[i].y, SS, SS, null, '#ffe36b'); }
    }});
  }
  for(let i = G.stands.length; i < G.fleet.length; i++)
    if(G.fleet[i].state === 'flying') items.push({d:999, fn:() => drawFlying(x, G.fleet[i], i, col)});
  items.sort((a, b) => a.d - b.d).forEach(it => it.fn());

  x.font = `bold ${Math.round(10*s)}px monospace`; x.textAlign = 'center';
  floats = floats.filter(f => (f.t += dt) < 1.6);
  for(const f of floats){ const ctr = standCtr(f.i); if(!ctr) continue; const [X, Y] = iso(ctr[0], ctr[1], 30*s); x.fillStyle = `rgba(255,227,107,${1-f.t/1.6})`; x.fillText(f.txt, X, Y - f.t*16); }
  if(night > 0.02){ x.fillStyle = `rgba(8,14,48,${night})`; x.fillRect(0, 0, CW, CH); }
  drawHUD(x);
}

/* --- interaction --- */
const MODE_GROUPS = [
  ['', [['sel','\u{1F5B1} Select'], ['del','\u26CF Demolish']]],
  ['Terminal', [['checkin'],['security'],['vending'],['news'],['cafe'],['restaurant'],['dutyfree'],
                ['exchange'],['lounge'],['seats'],['play'],['toilet'],['garden'],['info']]],
  ['Airside', [['stand','\u{1F17F} Stand'], ['taxi','\u{1F6E3} Taxiway'], ['run','\u{1F6EB} Runway']]],
];
const modeLabel = m => { const e = MODE_GROUPS.flatMap(g => g[1]).find(z => z[0] === m); return e && e[1] ? e[1] : FAC[m].icon + ' ' + FAC[m].name; };
const MODES = MODE_GROUPS.flatMap(g => g[1]).map(z => [z[0], modeLabel(z[0])]);
function toolbarHTML(){
  return MODE_GROUPS.map(g => {
    const lab = g[0] ? '<span class="glab">' + g[0] + '</span>' : '';
    const btns = g[1].map(z => '<button class="btn sm ' + (z[0] === mode ? 'pri' : '') +
      '" data-act="mode" data-arg="' + z[0] + '">' + modeLabel(z[0]) + '</button>').join('');
    const view = g[0] ? '' : '<button class="btn sm" data-act="zoom">\u{1F50D} ' + ['Close', 'Wide', 'Whole map'][zoom] +
      '</button><button class="btn sm" data-act="centre">\u2316 Centre</button>';
    return '<div class="row tools">' + lab + btns + view + '</div>';
  }).join('');
}
const pick = (px, py) => { const u = (px-cam.x)/(TW()/2), v = (py-cam.y)/(TH()/2); return [Math.floor((u+v)/2), Math.floor((v-u)/2)]; };
const evPos = (e, c) => { const r = c.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*CW, (e.clientY-r.top)/r.height*CH]; };

function onceToast(m){ if(!paint) return toast(m); if(!paint.said){ paint.said = 1; toast(m); } }
function applyBuild(gx, gy){
  const toast = onceToast;                                    // shadows the global: one message per drag
  if(!open(gx, gy)) return toast('You do not own that land — switch to Select and tap the block to buy it.');
  if(FAC[mode]){
    if(!inHall(gx, gy)) return toast('Interior facilities go inside the terminal hall.');
    if(facAt(gx, gy)) return toast('Something is already there.');
    const D = FAC[mode];
    if(G.cash < D.cost) return toast(`${D.name} costs ${money(D.cost)}.`);
    G.cash -= D.cost; G.fac[tkey(gx, gy)] = {k:mode, q:[]};
    return;
  }
  if(mode === 'del'){
    if(inHall(gx, gy) && facAt(gx, gy)){
      const f = facAt(gx, gy);
      for(const p of pax) if(p.at && p.at.key === tkey(gx, gy)) p.at = null;
      G.cash += FAC[f.k].cost*0.5; delete G.fac[tkey(gx, gy)];
      return;
    }
    if(!inAir(gx, gy)) return;
    const si = standIdxAt(gx, gy);
    if(si >= 0) G.stands.splice(si, 1);
    else if(tType(gx, gy)){ G.cash += (tType(gx, gy) === 'run' ? runCost() : taxiCost())*0.5; delete G.tiles[tkey(gx, gy)]; }
    else return;
    return invalidate();
  }
  if(!inAir(gx, gy)) return toast('Stands, taxiways and runways go on the green airside.');
  if(mode === 'stand'){
    if(G.stands.length >= gates()) return toast('No spare gate. Buy a gate slot first.');
    for(let a = 0; a < SS; a++) for(let b = 0; b < SS; b++)
      if(!inAir(gx+a, gy+b) || tType(gx+a, gy+b) || standIdxAt(gx+a, gy+b) >= 0) return toast(`A stand needs a clear ${SS}x${SS} area.`);
    G.stands.push({x:gx, y:gy}); return invalidate();
  }
  const t = mode === 'run' ? 'run' : 'taxi', c = t === 'run' ? runCost() : taxiCost();
  if(standIdxAt(gx, gy) >= 0) return toast('Demolish the stand first.');
  if(tType(gx, gy) === t) return;
  if(G.cash < c) return toast('Not enough cash.');
  G.cash -= c; G.tiles[tkey(gx, gy)] = t; invalidate();
}
function sceneClick(e){
  const c = e.target, [px, py] = evPos(e, c);
  if(py < HUD || mode !== 'sel') return;                      // build tools act on press, not click
  if(drag && drag.moved) return;
  const [gx, gy] = pick(px, py);
  sel = null;
  for(const dy of [30, 22, 14, 6, 0]){                       // tall things: also test the tile behind
    const [bx, by] = pick(px, py+dy);
    if(!isPlot(bx, by)) continue;
    const p = plotAt(bx, by), bld = BUILD.find(b => G.layout[b] === p);
    if(bld && bldH(G.upg[bld]) >= dy-3){ sel = {bld}; break; }
    if(dy === 0) sel = bld ? {bld} : {plot:p};
  }
  if(!sel && inHall(gx, gy) && facAt(gx, gy)) sel = {fac:tkey(gx, gy)};
  if(!sel && !open(gx, gy)){
    const b = bIdx(gx, gy);
    if(buyableLand().has(b)) sel = {land:b};
  }
  if(!sel){
    const i = standIdxAt(gx, gy);
    if(i >= 0 && G.fleet[i]) sel = {ac:G.fleet[i].id};
    else if(i >= 0) sel = {stand:i};
    else if(tType(gx, gy) === 'run'){ const R = runways().find(z => z.gy === gy && gx >= z.x0 && gx <= z.x1); if(R) sel = {rwy:R.id}; }
  }
  renderPanel();
}
function paintAt(gx, gy){
  if(mode === 'run') gy = paint.gy;                           // a runway is one straight row
  if(mode === 'stand' && paint.at) return;                    // one stand per press, not a trail of them
  const p = paint.at;
  if(p && p[0] === gx && p[1] === gy) return;
  paint.at = [gx, gy];
  if(!p) return applyBuild(gx, gy), invalidate();
  for(let n = 0, ax = p[0], ay = p[1]; (ax !== gx || ay !== gy) && n < GW+GH; n++){   // a fast drag skips tiles
    if(ax !== gx) ax += Math.sign(gx-ax); else ay += Math.sign(gy-ay);               // one axis at a time: no diagonal gaps
    applyBuild(ax, ay);
  }
  invalidate();
}
function sceneDown(e){
  const el = e.target, [px, py] = evPos(e, el);
  if(mode !== 'sel'){
    if(py < HUD) return;
    const [gx, gy] = pick(px, py);
    paint = {gy, at:null, el};
    return paintAt(gx, gy);
  }
  drag = {px, py, cx:cam.x, cy:cam.y, moved:false, el};
}
function sceneMove(e){
  const d = paint || drag;
  if(!d) return;
  const [px, py] = evPos(e, d.el);                            // the canvas, even if the cursor left it
  if(paint){ if(py < HUD) return; const [gx, gy] = pick(px, py); return paintAt(gx, gy); }
  if(Math.abs(px-drag.px) + Math.abs(py-drag.py) > 5) drag.moved = true;
  if(drag.moved){ cam.x = drag.cx + (px-drag.px); cam.y = drag.cy + (py-drag.py); }
}
function sceneUp(){ if(paint){ paint = null; renderPanel(); } setTimeout(() => { drag = null; }, 0); }

/* --- panels --- */
function fitsRunway(m = runwayLen()){ return TYPES.filter((t, i) => RWY[i] <= m).pop(); }
function rwyList(){
  const RS = runways().slice().sort((a, b) => b.len - a.len);
  if(!RS.length) return '<b class="bad">No runway</b> — lay 2+ runway tiles in a line.';
  return RS.map(R => { const f = fitsRunway(R.len*M_TILE); return `<span class="tag">${R.len*M_TILE} m · ${f ? f.name : 'too short'}</span>`; }).join(' ');
}
function hallStatus(){
  const ci = facCount('checkin'), se = facCount('security');
  const warn = [];
  if(!ci) warn.push('no check-in desk');
  if(!se) warn.push('no security lane');
  const am = AMEN.filter(k => facCount(k)).length;
  return `<p>Terminal: <b>${ci}</b> check-in · <b>${se}</b> security · <b>${am}</b>/${AMEN.length} amenity kinds<br>
    <span class="muted">In the hall now: <b>${pax.length}</b> passengers, mood <b>${Math.round(paxHappy())}%</b>${G.paxRev ? ` · earned <b class="good">${money(G.paxRev)}</b>` : ''}</span></p>
    ${warn.length ? `<p class="bad">⚠ ${warn.join(' and ')} — passengers give up and walk out.</p>` : ''}`;
}
function modeHelp(){
  const info = `<p>Land: <b>${Object.keys(G.land).length}</b>/${BW*BW} blocks · <b>${G.tok}</b> ${TOKEN} flight tokens<br>
    Runways (${runways().length}): ${rwyList()}</p>` + hallStatus();
  if(mode === 'sel') return info + '<p class="muted">Drag the view to pan. Tap a facility, plane, stand or runway for details, or tap a priced block of land to buy it. Pick a tool above to build, then drag to lay a whole run at once.</p>';
  if(FAC[mode]){ const D = FAC[mode];
    return info + `<p class="muted">${D.desc} Drag across empty tiles inside the terminal hall. <b>${money(D.cost)}</b> each${D.fee ? `, earns about <b>${money(paxFee(mode))}</b> per customer` : ''}.</p>`; }
  if(mode === 'stand') return info + `<p class="muted">Tap the airside to drop a ${SS}x${SS} stand. Stands used: <b>${G.stands.length}/${gates()}</b>.</p>`;
  if(mode === 'taxi') return info + `<p class="muted">Drag to paint a taxiway from every stand to a runway — a plane cannot depart without a connected route, and taxiways cannot cross a runway, so route around it. <b>${money(taxiCost())}</b> per tile.</p>`;
  if(mode === 'run') return info + `<p class="muted">Drag sideways to lay a runway — it stays in the row you started on. Each straight line of ${MIN_RUN}+ tiles is its own runway, ${M_TILE} m per tile. A stand uses the longest runway its taxiways reach, and one runway launches one aircraft at a time. <b>${money(runCost())}</b> per tile.</p>`;
  return info + '<p class="muted">Tap or drag over facilities, tiles and stands to remove them. You get half the cost back.</p>';
}
function panelHTML(){
  ensureAirport();
  const s = sel;
  if(mode !== 'sel') return `<div class="card"><h3>${MODES.find(m => m[0]===mode)[1]}</h3>${modeHelp()}</div>`;
  if(s && s.land != null){
    const c = landCost(s.land), bx = s.land % BW + 1, by = (s.land/BW|0) + 1;
    return `<div class="card"><h3>${TOKEN_MAP} Land block ${bx}-${by}</h3>
      <p class="muted">${BS}×${BS} tiles of empty ground.${(s.land/BW|0) === 0 ? ' This row widens the terminal hall and the landside plots.' : ' Room for more stands, taxiways and runways.'}</p>
      <p>Price: <b>${money(c.cash)}</b>${c.tok ? ` plus <b>${c.tok} ${TOKEN} flight tokens</b> — you hold <b>${G.tok}</b>` : ''}</p>
      <button class="btn pri" data-act="land" data-arg="${s.land}" data-cost="${c.cash}"${c.tok ? ` data-tok="${c.tok}"` : ''}>Buy this block</button>
      <p class="muted small" style="margin-top:8px">Blocks further from your terminal cost more, and anything three blocks out also costs flight tokens. Tokens come from levels, achievements and the odd charter contract.</p></div>`;
  }
  if(s && s.fac != null && G.fac[s.fac]){
    const f = G.fac[s.fac], D = FAC[f.k];
    return `<div class="card"><h3>${D.icon} ${D.name}</h3><p class="muted">${D.desc}</p>
      <p>${D.passive ? `Works by proximity · reaches <b>${D.aura}</b> tiles` : `Queue now: <b>${f.q.length}</b> · service time ${D.dwell}s` + (D.fee ? ` · about <b>${money(paxFee(f.k))}</b> per customer` : '')}</p></div>`;
  }
  if(s && s.ac){
    const a = G.fleet.find(z => z.id == s.ac);
    if(a) return `<div class="card"><h3>${G.brand.code}-${a.id} · ${TYPES[a.type].name}</h3><p class="muted" data-bind="ac:${a.id}:st"></p>
      <div class="ac" data-id="${a.id}" data-state="${a.state}" style="display:block;border:0;padding:0;margin:0"><div class="ac-actions" style="margin:0">
      <button class="btn pri b-disp" data-act="dispatch" data-arg="${a.id}">Dispatch</button>
      <button class="btn b-check" data-act="check" data-arg="${a.id}">Maintenance · ${money(checkCost(a))}</button></div></div></div>`;
  }
  if(s && s.bld){
    const id = s.bld, U = UPG[id], l = G.upg[id]||0, c = Math.round(U.base*Math.pow(U.g, l));
    return `<div class="card"><h3>${U.icon} ${U.name} <span class="tag">Lv ${l}/${U.max}</span></h3><p class="muted">${U.desc}</p>
      <p>Now: <b>${U.eff(l)}</b>${l<U.max ? ` → <b class="good">${U.eff(l+1)}</b>` : ''}</p>
      ${l >= U.max ? '<span class="tag on">Maxed</span>' : costBtn('Upgrade', c, 'upgrade', id)}</div>`;
  }
  if(s && s.plot != null){
    const free = BUILD.filter(id => G.layout[id] == null);
    return `<div class="card"><h3>Build on this plot</h3>${free.length ? free.map(id => { const U = UPG[id];
      return `<div class="cat" style="grid-template-columns:1fr auto"><div><b>${U.icon} ${U.name}</b><div class="muted small">${U.desc}</div></div>${costBtn('Build', U.base, 'place', id)}</div>`;
    }).join('') : '<p class="muted">Every facility is built.</p>'}</div>`;
  }
  if(s && s.rwy != null){
    const R = runways().find(z => z.id === s.rwy);
    if(R){ const f = fitsRunway(R.len*M_TILE);
      return `<div class="card"><h3>\u{1F6EB} Runway ${R.len*M_TILE} m</h3><p>${R.len} tiles · takes up to <b>${f ? f.name : 'nothing yet'}</b></p>
        <p class="muted">Stands that can reach it: <b>${G.stands.filter((z, i) => taxiRoutes(i).some(r => r.R.id === R.id)).length}</b>.</p></div>`; }
  }
  if(s && s.stand != null){
    const R = taxiPath(s.stand);
    return `<div class="card"><h3>Stand ${s.stand+1}</h3><p class="muted">Empty — buy an aircraft on the Fleet tab and it will park here.</p>
      ${R ? `<span class="tag on">Uses the ${R.R.len*M_TILE} m runway</span>` : '<span class="tag">⚠ No taxiway route to a runway</span>'}</div>`;
  }
  return `<div class="card"><h3>Your airport</h3>${modeHelp()}
    <div class="row">${costBtn('Buy gate slot', gateCost(), 'upgrade', 'gates')}<span class="muted">Aircraft: <b data-bind="fleetcount"></b></span></div>
    <p class="muted small" style="margin-top:10px">Rebuild clears every stand, taxiway and runway and lays the standard layout for your fleet. You pay full price for the new tiles and the old ones are not refunded; your terminal interior is untouched.</p>
    <div class="row"><button class="btn danger" data-act="reseed">\u{1F3D7}️ Rebuild airside layout</button></div></div>`;
}
function renderPanel(){ const p = $('#apanel'); if(p){ p.innerHTML = panelHTML(); updateUI(); } }
function bAirport(){
  ensureAirport();
  return `<div class="card pix"><canvas id="scene" width="${CW}" height="${CH}"></canvas></div>
  <div class="card">${toolbarHTML()}</div>
  <div id="apanel">${panelHTML()}</div>`;
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
  <div class="card"><h3>${TOKEN} Flight tokens</h3>
    <p class="muted">Tokens buy land far from your terminal. You earn one for every level (three every fifth), one lump per achievement below, and the odd charter contract.</p>
    <p>You hold: <b>${G.tok} ${TOKEN}</b></p>
    <table class="krows">${ACH.map(a => `<tr><td>${G.ach[a.id] ? '✅' : '⬜'} ${a.t}</td><td><b>${a.n} ${TOKEN}</b></td></tr>`).join('')}</table></div>
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
  x.fillStyle='#0f2442'; x.fillRect(0,0,W,H);
  x.strokeStyle='#17304f'; x.lineWidth=1;
  for(let i=1;i<12;i++){ x.beginPath(); x.moveTo(W*i/12,0); x.lineTo(W*i/12,H); x.stroke(); }
  for(let i=1;i<6;i++){ x.beginPath(); x.moveTo(0,H*i/6); x.lineTo(W,H*i/6); x.stroke(); }
  x.fillStyle='#24456f'; x.strokeStyle='#3b6396'; x.lineWidth=1;
  for(const poly of LAND){
    x.beginPath();
    poly.forEach(([lo,la],i) => { const px=(lo+180)/360*W, py=(78-la)/140*H; i?x.lineTo(px,py):x.moveTo(px,py); });
    x.closePath(); x.fill(); x.stroke();
  }
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
    x.save(); x.translate(pt[0],pt[1]); x.rotate(ang); x.scale(1.15,1.15); x.fillStyle=col; x.strokeStyle='#fff'; x.lineWidth=1;
    x.beginPath(); x.moveTo(10,0); x.lineTo(4,-2); x.lineTo(-2,-9); x.lineTo(-5,-9); x.lineTo(-2,-1.5); x.lineTo(-8,-1); x.lineTo(-10,-4); x.lineTo(-12,-4);
    x.lineTo(-10,0); x.lineTo(-12,4); x.lineTo(-10,4); x.lineTo(-8,1); x.lineTo(-2,1.5); x.lineTo(-5,9); x.lineTo(-2,9); x.lineTo(4,2); x.closePath();
    x.fill(); x.stroke(); x.restore();
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
  speed: a => { speed = +a; buildNav(); },
  buy: a => { if(buyAircraft(+a)) build(); },
  dispatch: a => { const ac = G.fleet.find(z=>z.id==a); if(ac && ac.state==='ready') tryDepart(ac); },
  check: a => { const ac = G.fleet.find(z=>z.id==a); if(ac && ['ready','grounded','nofuel','noroute'].includes(ac.state)) startCheck(ac); },
  dispatchAll: () => G.fleet.forEach(ac => { if(ac.state==='ready') tryDepart(ac); }),
  checkAll: () => G.fleet.forEach(ac => { if(['ready','grounded'].includes(ac.state) && ac.cond<95) startCheck(ac); }),
  sell: a => { const i = G.fleet.findIndex(z=>z.id==a); if(i<0 || G.fleet[i].state==='flying') return; G.cash += sellValue(G.fleet[i]); G.fleet.splice(i,1); build(); },
  mode: a => { mode = a; sel = null; build(); },
  land: a => { if(buyLand(+a)){ sel = null; build(); } },
  zoom: () => { zoom = (zoom+1) % ZOOM.length; cam.set = false; build(); },
  centre: () => { cam.set = false; build(); },
  reseed: () => { if(reseedAirport(fee => confirm(`Rebuild the airport on the standard layout for ${money(fee)}?

Every stand, taxiway and runway you have built is removed. The old tiles are not refunded.`))) build(); },
  place: a => { if(sel && sel.plot != null && G.layout[a] == null && buyUpgrade(a)){ G.layout[a] = sel.plot; sel = {bld:a}; build(); } },
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
    const b = G.brand, prev = {allTime:G.allTime, shares:G.shares+g, ipos:G.ipos+1, tok:G.tok, ach:G.ach, land:G.land};
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

document.addEventListener('mousedown', e => { if(e.target.id === 'scene' && G) sceneDown(e); });
document.addEventListener('mousemove', e => { if((drag || paint) && G) sceneMove(e); });
document.addEventListener('mouseup', () => { if(drag || paint) sceneUp(); });
document.addEventListener('click', e => {
  if(e.target.id === 'scene' && G) return sceneClick(e);
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
  let lf = performance.now();
  (function loop(t){ const dt = Math.min(0.1, (t-lf)/1000); lf = t; if(G && tab === 'airport') drawScene(dt); requestAnimationFrame(loop); })(lf);
  setInterval(() => {
    if(!G) return;
    const now = Date.now(); let dt = (now-last)/1000; last = now;
    if(!speed){}                                       // paused: the clock on the wall keeps going, the airline does not
    else if(dt > 2) catchUp(Math.min(dt, OFFLINE_CAP));  // woke from a sleeping tab: real time only, never multiplied
    else for(let i = 0; i < speed; i++) tick(dt);
    updateUI();
    saveT += dt; if(saveT >= 5){ saveT = 0; save(); }
  }, 100);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if(document.hidden) save(); });
}
main();
