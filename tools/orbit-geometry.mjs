/**
 * ORBIT research geometry — independent of Canvas, browser state, and collision().
 * The only authority for published level positions remains src/levels.js.
 */
import { strict as assert } from 'node:assert';

export const BASE=Math.PI/4;
export const MAX_WHEELS=3;

export function pointAt(t,wheels){
  let x=0,y=0;
  for(let i=0;i<wheels.length;i++){
    const phase=t*BASE*(i+1)*wheels[i].d;
    x+=wheels[i].r*Math.cos(phase);
    y+=wheels[i].r*Math.sin(phase);
  }
  return {x,y};
}
export function segmentDistance(a,b,p){
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const frac=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;
  return Math.hypot(a.x+dx*frac-p.x,a.y+dy*frac-p.y);
}
export function validWheels(wheels){
  return Array.isArray(wheels)&&wheels.length>=1&&wheels.length<=MAX_WHEELS&&
    wheels.every(w=>w&&Number.isInteger(w.r)&&w.r>=0&&w.r<=165&&(w.d===1||w.d===-1));
}
export function verifyReference(level,{step=0.008,requireSafe=true}={}){
  assert.ok(level&&typeof level.name==='string'&&level.name.length,'Level needs a name');
  assert.ok(validWheels(level.start),'Invalid start wheels: '+level.name);
  assert.ok(validWheels(level.refs),'Invalid reference wheels: '+level.name);
  assert.ok(Array.isArray(level.times)&&level.times.length>=2&&level.times.length<=6,'Invalid goal times: '+level.name);
  assert.ok(Array.isArray(level.goals)&&level.goals.length===level.times.length,'Missing goal coordinates: '+level.name);
  assert.ok(Number.isFinite(level.max)&&level.max>0&&level.max<=60,'Invalid sampling horizon: '+level.name);
  assert.ok(Number.isFinite(level.captureRadius)&&level.captureRadius>0&&level.captureRadius<=15,'Invalid capture radius: '+level.name);
  assert.ok(Array.isArray(level.hazards)&&level.hazards.every(h=>h&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&Number.isFinite(h.r)&&h.r>=0),'Invalid hazards: '+level.name);
  assert.ok(Number.isFinite(step)&&step>0&&step<=.02,'Invalid reference sampling step');

  const goalPoints=level.goals.map(g=>({x:g.x,y:g.y}));
  for(const [i,time] of level.times.entries()){
    assert.ok(Number.isFinite(time)&&time>=0&&time<=level.max,'Goal time beyond horizon: '+level.name);
    const expected=pointAt(time,level.refs);
    assert.ok(Math.hypot(expected.x-goalPoints[i].x,expected.y-goalPoints[i].y)<1e-7,'Reference/goal drift: '+level.name+' target '+i);
  }
  const hits=new Set(),hazards=new Set();
  let previous=pointAt(0,level.refs);
  // Integer sampling avoids accumulated floating-point drift across long routes.
  const samples=Math.ceil(level.max/step);
  for(let j=1;j<=samples;j++){
    const next=pointAt(Math.min(level.max,j*step),level.refs);
    goalPoints.forEach((goal,i)=>{if(segmentDistance(previous,next,goal)<=level.captureRadius)hits.add(i)});
    level.hazards.forEach((hazard,i)=>{if(segmentDistance(previous,next,hazard)<=hazard.r+4)hazards.add(i)});
    previous=next;
  }
  assert.equal(hits.size,goalPoints.length,'Reference misses supply targets: '+level.name);
  if(requireSafe)assert.equal(hazards.size,0,'Reference intersects a prohibited zone: '+level.name);
  return {name:level.name,goals:hits.size,wheels:level.refs.length,hazardContacts:hazards.size,samples};
}
export function minimumRouteDistance(point,wheels,{max=8,step=.02}={}){
  let min=Infinity,prev=pointAt(0,wheels);
  const count=Math.ceil(max/step);
  for(let i=1;i<=count;i++){
    const current=pointAt(Math.min(max,i*step),wheels);
    const distance=segmentDistance(prev,current,point);
    if(distance<min)min=distance;
    prev=current;
  }
  return min;
}
