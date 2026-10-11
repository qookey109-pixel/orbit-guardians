/**
 * Deterministic candidate triage. Heuristics are NOT a validated measure
 * of human difficulty or enjoyment; all decisions remain review-only.
 */
import {pointAt,segmentDistance} from './orbit-geometry.mjs';

const round=(v,places=3)=>Number(v.toFixed(places));
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function sampling(level,step=.04){
 const steps=Math.ceil(Math.min(8,level.max??8)/step);
 return Array.from({length:steps+1},(_,i)=>pointAt(Math.min(8,i*step),level.refs));
}
function distanceAlong(points,q){
 let best=Infinity;
 for(let i=1;i<points.length;i++)best=Math.min(best,segmentDistance(points[i-1],points[i],q));
 return best;
}
function coverage(goals,points,radius){
 return goals.reduce((sum,g)=>sum+(distanceAlong(points,g)<=radius?1:0),0);
}
export function qualityMetrics(level){
 const p=sampling(level),ps=Array.from({length:p.length},(_,i)=>pointAt(Math.min(8,i*.04),level.start));
 const r=level.refs.length,goals=level.goals,hazards=level.hazards;
 const pathLength=p.slice(1).reduce((sum,x,i)=>sum+hypot(p[i],x),0);
 const extents=p.map(x=>Math.hypot(x.x,x.y));
 let minGoalSpacing=Infinity;
 for(let i=0;i<goals.length;i++)
  for(let j=i+1;j<goals.length;j++)minGoalSpacing=Math.min(minGoalSpacing,hypot(goals[i],goals[j]));
 const hazardClearance=hazards.length
  ?Math.min(...hazards.map(h=>distanceAlong(p,h)-h.r-4)):null;
 const startGoalCoverage=coverage(goals,ps,level.captureRadius);
 const directionChanges=level.refs.reduce((n,w,i)=>n+(i>0&&w.d!==level.refs[i-1].d?1:0),0);
 const startDifferences=level.start.reduce((n,w,i)=>{
  const expected=level.refs[i];
  return n+(!expected||Math.abs(w.r-expected.r)>=4||w.d!==expected.d?1:0)
 },0)+(r-level.start.length);
 const span=Math.max(...extents)-Math.min(...extents);
 const goalSpread=round(minGoalSpacing);
 // Fixed, explainable weights for sorting review workload, not player skill.
 const challengeIndex=Math.min(100,
  12+(r-1)*14+Math.max(0,goals.length-2)*6+
  hazards.length*5+directionChanges*4+
  Math.min(9,startDifferences*3)+Math.min(8,Math.floor(span/45)));
 // These bands are heuristic triage labels, not measured player success rates.
 const roughBand=challengeIndex<30?'easy':challengeIndex<56?'medium':challengeIndex<86?'hard':'expert';
 const issues=[];
 if(startGoalCoverage===goals.length)issues.push('START_ALREADY_SOLVES');
 if(minGoalSpacing<=level.captureRadius*4)issues.push('TARGETS_TOO_CLOSE');
 if(hazardClearance!==null&&hazardClearance<0)issues.push('REFERENCE_HAZARD_CONTACT');
 if(hazards.length>0&&hazardClearance!==null&&hazardClearance>70)issues.push('HAZARDS_TOO_REMOTE');
 if(r>1&&span<30)issues.push('LIMITED_RADIAL_VARIATION');
 return {challengeIndex,roughBand,startGoalCoverage,startDifferences,
  directionChanges,pathLength:round(pathLength),radialSpan:round(span),
  minGoalSpacing:goalSpread,hazardClearance:hazardClearance===null?null:round(hazardClearance),
  issues};
}
/**
 * Collision-resistant enough for candidate triage, NOT a cryptographic ID:
 * normalized orbit trajectory features are sampled across one 8-second cycle.
 * Reflection is considered equivalent; tiny radius edits count as similar.
 */
export function similarity(a,b){
 if(a.refs.length!==b.refs.length||a.goals.length!==b.goals.length||
    a.hazards.length!==b.hazards.length)return 0;
 const ds1=a.refs.map(w=>w.d),ds2=b.refs.map(w=>w.d);
 const same=ds1.every((d,i)=>d===ds2[i]);
 const mirror=ds1.every((d,i)=>d===-ds2[i]);
 if(!same&&!mirror)return 0;
 const norm1=Math.max(1,a.refs.reduce((s,w)=>s+w.r,0));
 const norm2=Math.max(1,b.refs.reduce((s,w)=>s+w.r,0));
 let shape=0;
 for(let k=0;k<32;k++){
  const time=8*k/32,A=pointAt(time,a.refs),B=pointAt(time,b.refs);
  // Reflect across X axis if all reference directions are inverted.
  const dy=mirror?A.y+B.y:A.y-B.y;
  shape+=Math.hypot(A.x/norm1-B.x/norm2,dy/norm1)/32;
 }
 const rawDelta=a.refs.reduce((sum,w,i)=>sum+
   Math.abs(w.r/norm1-b.refs[i].r/norm2),0)/a.refs.length;
 const absoluteRadius=a.refs.reduce((sum,w,i)=>sum+Math.abs(w.r-b.refs[i].r),0)/(165*a.refs.length);
 const timeShift=a.times.reduce((sum,t,i)=>sum+Math.abs(t-b.times[i]),0)/(Math.max(a.max,b.max,8)*a.times.length);
 const hazardGeometry=a.hazards.length?
  a.hazards.reduce((sum,h,i)=>sum+Math.hypot(h.x-b.hazards[i].x,h.y-b.hazards[i].y),0)/(460*a.hazards.length):0;
 // Same wheel shape alone is not a duplicate (one-ring levels all form circles).
 // Target placement, scale and risk placement must also be similar.
 const gap=shape*.30+rawDelta*.15+absoluteRadius*.17+timeShift*.26+hazardGeometry*.12;
 return round(Math.max(0,1-gap/.25),4);
}
export function compareToCatalog(candidate,catalog=[],picked=[]){
 const all=[...catalog,...picked],near=all
  .map((other,index)=>({name:other.name??`case-${index+1}`,similarity:similarity(candidate,other),
    origin:index<catalog.length?'published':'batch'}))
  .filter(x=>x.similarity>=.88).sort((a,b)=>b.similarity-a.similarity);
 return {nearDuplicates:near,mostSimilar:near[0]??null,noveltyPassed:near.length===0};
}
export function rankCandidate(candidate,catalog=[],picked=[]){
 const metrics=qualityMetrics(candidate),uniqueness=compareToCatalog(candidate,catalog,picked);
 const flags=[...metrics.issues,...(uniqueness.noveltyPassed?[]:['NEAR_DUPLICATE'])];
 return {...metrics,reviewFlags:flags,similarity:uniqueness.mostSimilar,
  reviewGate:flags.length?'REVISE':'READY_FOR_HUMAN_PLAYTEST',
  disclaimer:'Rule-based triage only; subjective difficulty, fun and accessibility need real players.'};
}
