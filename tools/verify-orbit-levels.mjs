#!/usr/bin/env node
/**
 * Offline, deterministic validation of the 18 ORBIT missions.
 * Intentionally independent of the browser, collision(), __ORBIT_DEBUG__,
 * and the built-in completion/debug cheats used in smoke tests.
 *
 * The mission literals currently live inside index.html's IIFE. Isolating
 * only that declarative block lets the validator catch breakages without
 * maintaining a second (out-of-sync) copy of all mission configurations.
 *
 * Usage: node tools/verify-orbit-levels.mjs
 */
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('const levels=[');
const end=html.indexOf('function clone(ws)',begin);
assert.ok(begin>0&&end>begin,'Mission data block not found');
const source=html.slice(begin,end);
// No DOM APIs, require, filesystem, network, or browser globals in this VM.
// The result contains plain data, not the live game's collision functions.
const world=runInNewContext('const PI=Math.PI,TAU=PI*2,BASE=TAU/8;\n'+
  source+'\n({levels,planets,PLANET_SIZE});',Object.create(null),{timeout:1000});
const {levels,planets,PLANET_SIZE}=world;
const BASE=2*Math.PI/8;
assert.equal(PLANET_SIZE,6);
assert.equal(planets.length,3);
assert.equal(levels.length,18);

function independentPoint(t,config){
  let x=0,y=0;
  config.forEach((w,i)=>{
    const angle=t*BASE*(i+1)*w.d;
    x+=w.r*Math.cos(angle);y+=w.r*Math.sin(angle);
  });
  return {x,y};
}
function distSegment(a,b,p){
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
  const f=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;
  return Math.hypot(a.x+dx*f-p.x,a.y+dy*f-p.y);
}
function validWheels(config){
  return Array.isArray(config)&&config.length>=1&&config.length<=3&&
    config.every(w=>Number.isInteger(w.r)&&w.r>=0&&w.r<=165&&(w.d===1||w.d===-1));
}

const audit=[];
for(const [index,level] of levels.entries()){
  const id=index+1;
  assert.equal(typeof level.name,'string');
  assert.ok(level.name.length>0,'Unnamed mission '+id);
  assert.ok(validWheels(level.start),'Invalid starting wheels '+id);
  assert.ok(validWheels(level.refs),'Invalid reference wheels '+id);
  assert.ok(Array.isArray(level.goals)&&level.goals.length>=2&&level.goals.length<=6,'Invalid goals '+id);
  assert.equal(level.goals.length,level.times.length,'Goal/time count mismatch '+id);
  assert.ok(Number.isFinite(level.max)&&level.max>0&&level.max<=60,'Invalid validation horizon '+id);
  assert.ok(Number.isFinite(level.captureRadius)&&level.captureRadius>0&&level.captureRadius<=15,'Invalid capture radius '+id);
  assert.ok(level.hazards.every(h=>Number.isFinite(h.x)&&Number.isFinite(h.y)&&Number.isFinite(h.r)&&h.r>=0),'Invalid hazard '+id);

  const goals=level.goals.map(g=>({x:g.x,y:g.y}));
  level.times.forEach((t,i)=>{
    assert.ok(t>=0&&t<=level.max,'Goal construction time beyond simulation horizon '+id);
    const expected=independentPoint(t,level.refs);
    assert.ok(Math.hypot(expected.x-goals[i].x,expected.y-goals[i].y)<1e-7,'Reference geometry drift at mission '+id+' goal '+i);
  });

  // Trace the full reference trajectory in small world-time increments.
  // Collision uses segment distance instead of exact timestamp equality.
  const goalHits=new Set(),hazardHits=new Set(),dt=0.008;
  let prev=independentPoint(0,level.refs);
  for(let t=dt;t<=level.max+dt;t+=dt){
    const next=independentPoint(Math.min(level.max,t),level.refs);
    goals.forEach((goal,i)=>{if(distSegment(prev,next,goal)<=level.captureRadius)goalHits.add(i)});
    level.hazards.forEach((hazard,i)=>{if(distSegment(prev,next,hazard)<=hazard.r+4)hazardHits.add(i)});
    prev=next;
  }
  assert.equal(goalHits.size,goals.length,'Reference route does not reach every goal in '+id+' '+level.name);
  audit.push({stage:id,planet:Math.floor(index/PLANET_SIZE)+1,name:level.name,
    goals:goalHits.size,wheels:level.refs.length,hazardContacts:hazardHits.size});
}
console.log(JSON.stringify({status:'PASS',kind:'independent-reference-geometry',
  stages:audit.length,planets:planets.length,goalTotal:audit.reduce((a,x)=>a+x.goals,0),
  levelsWithHazardContact:audit.filter(x=>x.hazardContacts>0),audit}));
