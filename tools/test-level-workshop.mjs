#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { generateCandidates } from './generate-level-candidates.mjs';
import { pointAt,segmentDistance,verifyReference } from './orbit-geometry.mjs';

function coveredByStart(level){
 const found=new Set(),step=.02;
 let prev=pointAt(0,level.start);
 for(let j=1;j<=Math.ceil(8/step);j++){
  const next=pointAt(Math.min(8,j*step),level.start);
  level.goals.forEach((g,i)=>{if(segmentDistance(prev,next,g)<=level.captureRadius)found.add(i)});
  prev=next;
 }
 return found.size;
}
function validateReviewBatch(result){
 assert.equal(result.status,'REVIEW_ONLY_NOT_PUBLISHED');
 assert.equal(result.schema,'orbit-research-candidates-v1');
 assert.equal(result.count,result.candidates.length);
 const names=new Set();
 for(const item of result.candidates){
  assert.equal(item.hazards.length,result.hazards,'Hazard count mismatch');
  assert.equal(item.goals.length,result.goals,'Goal count mismatch');
  assert.ok(!names.has(item.name),'Duplicate candidate name');
  names.add(item.name);
  const validated=verifyReference(item,{step:.008,requireSafe:true});
  assert.equal(validated.hazardContacts,0);
  assert.ok(coveredByStart(item)<item.goals.length,'Candidate start already clears every goal');
  const distances=[];
  for(let i=0;i<item.goals.length;i++){
   for(let j=i+1;j<item.goals.length;j++)
    distances.push(Math.hypot(item.goals[i].x-item.goals[j].x,item.goals[i].y-item.goals[j].y));
  }
  assert.ok(distances.every(d=>d>result.criteria.captureRadius*4),'Supply stations too close');
 }
 return result.count;
}
let total=0;
for(const [i,difficulty] of ['easy','medium','hard','expert'].entries()){
 const config={seed:20261011+i,difficulty,count:2};
 const a=generateCandidates(config),b=generateCandidates(config);
 assert.equal(JSON.stringify(a),JSON.stringify(b),'Same seed must reproduce byte-identical candidates');
 total+=validateReviewBatch(a);
}
assert.throws(()=>generateCandidates({difficulty:'impossible'}));
assert.throws(()=>generateCandidates({count:100}));
assert.throws(()=>generateCandidates({seed:-1}));
{
 const safe=generateCandidates({seed:17,difficulty:'medium',count:1}).candidates[0];
 const unsafe={...safe,hazards:[{x:safe.goals[0].x,y:safe.goals[0].y,r:20}]};
 assert.throws(()=>verifyReference(unsafe,{step:.008}),/prohibited zone/);
 const missed={...safe,goals:safe.goals.map(g=>({...g}))};
 missed.goals[0].x+=40;
 assert.throws(()=>verifyReference(missed,{step:.008}),/drift/);
}
if(process.argv[2]){
 const submitted=JSON.parse(readFileSync(process.argv[2],'utf8'));
 total+=validateReviewBatch(submitted);
}
console.log(JSON.stringify({status:'PASS',kind:'offline-level-workshop',
  difficulties:['easy','medium','hard','expert'],sampled:total,
  repeatable:true,invalidInputsRejected:true,unsafeGeometryRejected:true,
  published:false}));
