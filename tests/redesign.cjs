const { chromium } = require(process.env.AIRWARD_PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 fs.mkdirSync('tmp',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.AIRWARD_BROWSER_PATH || undefined,headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://airward.test/**',route=>{const u=new URL(route.request().url()),n=path.join(process.cwd(),u.pathname==='/'?'index.html':u.pathname);return route.fulfill({body:fs.readFileSync(n),contentType:n.endsWith('.js')?'text/javascript':n.endsWith('.css')?'text/css':n.endsWith('.svg')?'image/svg+xml':n.endsWith('.ttf')?'font/ttf':'text/html'});});
 await page.goto('http://airward.test');await page.locator('#sGo').click();await page.evaluate(()=>{speed=0;daylight='midday';build();});await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'tmp/desktop.png',fullPage:true});
 for(const tab of ['overview','fleet','routes','fuel','auto','company','airport']){
  await page.locator('#nav [data-arg="'+tab+'"]').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,tab+' overflow');
  if(tab==='routes')await page.screenshot({path:'tmp/routes.png',fullPage:true});
 }
 await page.locator('[data-act=view][data-arg=term]').click();
 await page.locator('[data-act=mode][data-arg=seats]').click();
 await page.screenshot({path:'tmp/terminal.png',fullPage:true});
 const separation=await page.evaluate(()=>{const c=document.querySelector('#scene').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect();return d.top>=c.bottom;});assert.equal(separation,true,'Build controls must not cover the map');
 await page.keyboard.press('Escape');
 const floors=await page.evaluate(()=>{const cash=G.cash,tok=G.tok;G.cash=1e7;G.tok=100;const results=[];while(nFloors()<3){const n=nFloors(),before=G.cash;buyFloor();results.push(G.cash===before-FLOOR_COST[n]);}floor=2;mode='vending';applyBuild(5,7);results.push(facAt(5,7)?.k==='vending');floor=0;results.push(!facAt(5,7));G.cash=cash;G.tok=tok;mode='sel';build();return results;});assert(floors.every(Boolean),'Floor cost and isolation');
 // Building uses the existing tile pricing and the selected floor only.
 const cashBefore=await page.evaluate(()=>G.cash);
 await page.locator('[data-act=mode][data-arg=seats]').click();
 const point=await page.evaluate(()=>{const [x,y]=iso(5.5,7.5),r=document.querySelector('#scene').getBoundingClientRect();return {x:r.x+x*r.width/CW,y:r.y+y*r.height/CH};});
 await page.mouse.click(point.x,point.y);
 const construction=await page.evaluate(()=>({cash:G.cash,kind:facAt(5,7)?.k,expected:FAC.seats.cost}));assert.equal(construction.kind,'seats');assert.equal(cashBefore-construction.cash,construction.expected);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{save();build();});const before=await page.evaluate(()=>({fac:JSON.stringify(G.fac),fleet:G.fleet.length,geo:G.geo,cash:G.cash}));await page.reload();await page.evaluate(()=>{speed=0;});const after=await page.evaluate(()=>({fac:JSON.stringify(G.fac),fleet:G.fleet.length,geo:G.geo,cash:G.cash}));assert.deepEqual(after,before);
 await page.locator('[data-act=openFlightRoute]').click();await page.locator('#route-destination').selectOption('CDG');assert.equal(await page.evaluate(()=>G.fleet[0].route),'CDG');await page.locator('.assignment [data-act=dispatch]').click();assert.equal(await page.evaluate(()=>G.fleet[0].state),'flying');
 await page.evaluate(()=>{const t=G.time;tick(1);if(G.time<=t)throw Error('Simulation did not advance');});
 await page.locator('#nav [data-arg=airport]').click();
 for(const width of [390,768,1024]){await page.setViewportSize({width,height:844});await page.evaluate(()=>{buildOpen=false;build();});await page.screenshot({path:'tmp/view-'+width+'.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' overflow');}
 await page.setViewportSize({width:390,height:844});await page.locator('#nav .more-tab').click();await page.locator('#nav [data-arg=fuel]').click();assert.equal(await page.locator('#stage').isVisible(),false);assert.equal(await page.locator('#drawer').isVisible(),true);await page.locator('.dclose').click();assert.equal(await page.locator('#scene').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS: seven tabs, desktop/tablet/mobile widths, floor construction cost, save reload, route selection, dispatch, simulation, mobile More and drawer navigation; no JS errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
