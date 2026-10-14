import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const origin='http://127.0.0.1:8765/';
const engines=[['chromium',chromium],['webkit',webkit]];
for(const [name,engine] of engines){
 const browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin+'experiment/',{waitUntil:'networkidle'});
 assert.equal(await page.title(),'ORBIT LAB｜軌跡實驗室');
 assert.equal(await page.locator('#countInput').inputValue(),'3');
 assert.equal(await page.locator('#freeMode').getAttribute('aria-pressed'),'true');
 assert.ok(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__?.model?.width>0));
 const math=await page.evaluate(()=>{
  const d=window.__ORBIT_EXPERIMENT_DEBUG__;
  const samples=Array.from({length:120},(_,i)=>({x:25+90*Math.cos(i*2*Math.PI/120),y:-15+90*Math.sin(i*2*Math.PI/120)}));
  const data=d.fitPath(samples,3);
  const wheel=data.coeffs.slice(0,3);
  let max=0;
  for(let i=0;i<64;i++){
   const p=d.wheelPosition(i/64,wheel),x=25+90*Math.cos(i*2*Math.PI/64),y=-15+90*Math.sin(i*2*Math.PI/64);
   max=Math.max(max,Math.hypot(p.x-x,p.y-y));
  }
  return {max,sampleCount:data.samples.length,frequency:wheel[1]?.f,
    radius:wheel[1]?.r,fftCalls:d.model.perf.fftCalls};
 });
 assert.ok(math.max<1.2,'FFT fit failed canonical circle: '+JSON.stringify(math));
 assert.equal(math.frequency,1);
 assert.ok(Math.abs(math.radius-90)<.6);
 assert.equal(await page.locator('#advancedPanel').isVisible(),false);
 await page.locator('#plusBtn').click();assert.equal(await page.locator('#countInput').inputValue(),'4');
 await page.locator('#minusBtn').click();assert.equal(await page.locator('#countInput').inputValue(),'3');
 await page.locator('#settingsBtn').click();
 assert.equal(await page.locator('#advancedPanel').isVisible(),true);
 await page.locator('#frequency').fill('-5');await page.locator('#frequency').press('Tab');
 assert.equal(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.wheels[0].f),-5);
 await page.locator('#closeSettings').click();
 assert.equal(await page.locator('#advancedPanel').isVisible(),false);
 const sizes=[{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}];
 for(const size of sizes){
  await page.setViewportSize(size);
  await page.waitForTimeout(95);
  const rect=await page.evaluate(()=>{
   const top=document.querySelector('.topbar').getBoundingClientRect();
   const bottom=document.querySelector('.bottom').getBoundingClientRect();
   const canvas=document.querySelector('#plot').getBoundingClientRect();
   return {sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,
    top:top.bottom,bottom:bottom.top,end:bottom.bottom,width:canvas.width,height:canvas.height};
  });
  assert.ok(rect.sw<=size.width+1&&rect.sh<=size.height+1,'Page scroll at '+JSON.stringify({size,rect}));
  assert.ok(rect.width>=size.width-2&&rect.height>=size.height-2,'Canvas must be full viewport');
  assert.ok(rect.top<rect.bottom,'Toolbar and bottom controls overlap '+JSON.stringify({size,rect}));
  assert.ok(rect.end<=size.height+1,'Bottom controls outside viewport '+JSON.stringify({size,rect}));
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#drawMode').click();
 const box=await page.locator('#plot').boundingBox();
 const cx=box.x+box.width/2,cy=box.y+box.height*.47;
 await page.mouse.move(cx+80,cy);await page.mouse.down();
 for(let i=1;i<=90;i++){
  const t=2*Math.PI*i/90;
  await page.mouse.move(cx+Math.cos(t)*80,cy+Math.sin(t)*70,{steps:1});
 }
 await page.mouse.up();
 assert.equal(await page.locator('#generateBtn').isEnabled(),true,'Stroke not recorded');
 assert.ok(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.stroke.length)>25);
 await page.locator('#countInput').fill('20');
 await page.locator('#countInput').press('Tab');
 await page.locator('#generateBtn').click();
 const fitted=await page.evaluate(()=>{
  const d=window.__ORBIT_EXPERIMENT_DEBUG__;
  return {source:d.model.source,mode:d.model.mode,ringCount:d.model.wheels.length,
   sourceCount:d.model.reference.length,error:d.model.error,playing:d.model.playing};
 });
 assert.equal(fitted.source,'fitted');assert.equal(fitted.mode,'free');
 assert.equal(fitted.ringCount,20);
 assert.ok(fitted.sourceCount>=512);
 assert.ok(fitted.error<7.5,'Hand-drawn ellipse fit poor: '+JSON.stringify(fitted));
 assert.equal(await page.locator('#freeMode').getAttribute('aria-pressed'),'true');
 assert.ok(await page.locator('#status').textContent().then(x=>x.includes('已生成')));
 await page.locator('#settingsBtn').click();
 await page.locator('#radiusNumber').fill('120');await page.locator('#radiusNumber').press('Tab');
 assert.equal(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.wheels[0].r),120);
 await page.locator('#showRings').uncheck();
 assert.equal(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.showRings),false);
 // Editing while the preview is hidden must invalidate the cached trajectory.
 await page.locator('#showForecast').uncheck();
 const buildsBefore=await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.perf.forecastBuilds);
 await page.locator('#radiusNumber').fill('133');await page.locator('#radiusNumber').press('Tab');
 await page.waitForTimeout(110);
 await page.locator('#showForecast').check();
 const buildsAfter=await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.perf.forecastBuilds);
 assert.ok(buildsAfter>buildsBefore,'Re-enabling forecast did not update the edited orbit');
 await page.locator('#closeSettings').click();
 await page.locator('#countInput').fill('256');await page.locator('#countInput').press('Tab');
 assert.equal(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.wheels.length),256);
 await page.locator('#playBtn').click();
 assert.equal(await page.locator('#playBtn').getAttribute('aria-pressed'),'false');
 await page.locator('#playBtn').click();
 assert.equal(await page.locator('#playBtn').getAttribute('aria-pressed'),'true');
 await page.waitForTimeout(150);
 assert.ok(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.t)>0,'Orbit did not advance');
 await page.screenshot({path:'experiment-'+name+'-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});
 await page.screenshot({path:'experiment-'+name+'-desktop.png',fullPage:true});
 await page.locator('#clearBtn').click();
 assert.equal(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.reference.length),0);
 await page.locator('#resetBtn').click();
 assert.equal(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.wheels.length),3);
 assert.equal(await page.evaluate(()=>window.__ORBIT_EXPERIMENT_DEBUG__.model.playing),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem('orbit-code-progress')),null,
  'Independent experiment must never write game progress');
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 reduced.on('pageerror',e=>errors.push(String(e)));
 await reduced.goto(origin+'experiment/',{waitUntil:'networkidle'});
 const reducedCheck=await reduced.evaluate(()=>{
  const d=window.__ORBIT_EXPERIMENT_DEBUG__;
  d.model.stroke=Array.from({length:65},(_,i)=>({x:70*Math.cos(i*2*Math.PI/64),y:70*Math.sin(i*2*Math.PI/64)}));
  return {ok:d.generate(),playing:d.model.playing};
 });
 assert.equal(reducedCheck.ok,true);
 assert.equal(reducedCheck.playing,false,'Reduced motion must avoid auto-play');
 await reduced.close();
 const root=await browser.newPage();
 await root.goto(origin,{waitUntil:'networkidle'});
 assert.equal(await root.locator('.experiment-entry').getAttribute('href'),'./experiment/');
 assert.equal(await root.locator('#levelList .level-btn').count(),6);
 const labResponse=await root.goto(origin+'lab/',{waitUntil:'networkidle'});
 assert.equal(labResponse.status(),200,'Existing review lab must stay accessible');
 await root.close();
 assert.deepEqual(errors,[],'Uncaught browser error in '+name);
 console.log(JSON.stringify({engine:name,result:'PASS',math,fitted,viewport:sizes.length,mainGameEntry:true,reviewLab:'preserved'}));
 await browser.close();
}