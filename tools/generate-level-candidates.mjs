#!/usr/bin/env node
/**
 * ORBIT Level Workshop — seeded, offline candidate generation.
 * No LLM/API, browser, random network request, or changes to published levels.
 *
 * Examples:
 * node tools/generate-level-candidates.mjs --seed 20261011 --difficulty hard --count 3 --output research/orbit-candidates.json
 * node tools/generate-level-candidates.mjs --seed 42 --difficulty easy --count 2
 */
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {strict as assert} from 'node:assert';
import {pointAt,segmentDistance,minimumRouteDistance,verifyReference} from './orbit-geometry.mjs';
import {rankCandidate} from './level-quality.mjs';
import {loadPublishedLevels} from './load-published-levels.mjs';

const modes=Object.freeze({
 easy:{wheels:1,goals:2,hazards:0,captureRadius:10},
 medium:{wheels:2,goals:3,hazards:1,captureRadius:9},
 hard:{wheels:3,goals:4,hazards:2,captureRadius:9},
 expert:{wheels:3,goals:5,hazards:3,captureRadius:8}
});
function seeded(seed){
 let x=seed>>>0;
 return ()=>{
  x=(x+0x6D2B79F5)>>>0;
  let t=x;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
const integer=(rng,a,b)=>a+Math.floor(rng()*(b-a+1));
const choose=(rng,arr)=>arr[integer(rng,0,arr.length-1)];
function referenceWheels(rng,difficulty){
 const n=modes[difficulty].wheels;
 const first=integer(rng,102,138),second=integer(rng,52,86),third=integer(rng,28,56);
 const radii=[first,second,third];
 const directions=n===1?[1]:n===2?[choose(rng,[-1,1]),choose(rng,[-1,1])]:[choose(rng,[-1,1]),-1,choose(rng,[-1,1])];
 return radii.slice(0,n).map((r,i)=>({r,d:directions[i]}));
}
function startWheels(rng,refs){
 const result=refs.map(w=>({...w}));
 if(refs.length===1){
  result[0].r=Math.max(32,Math.min(165,refs[0].r+choose(rng,[-1,1])*integer(rng,27,40)));
 }else{
  const i=integer(rng,1,refs.length-1);
  result[i].d=-refs[i].d;
  if(refs.length===3&&rng()<.6){
   result[0].r=Math.min(165,Math.max(0,refs[0].r+choose(rng,[-1,1])*integer(rng,16,28)));
  }
 }
 return result;
}
function targetTimes(rng,refs,count,captureRadius){
 const picked=[];
 for(let tries=0;tries<1100&&picked.length<count;tries++){
  const time=integer(rng,60,728)/100;
  const point=pointAt(time,refs);
  const separated=picked.every(p=>Math.abs(p.t-time)>.55&&
    Math.hypot(p.point.x-point.x,p.point.y-point.y)>captureRadius*4.8);
  if(separated)picked.push({t:time,point});
 }
 if(picked.length!==count)return null;
 return picked.sort((a,b)=>a.t-b.t).map(x=>x.t);
}
function goalCoverage(goals,wheels,radius){
 const covered=new Set(),step=.03;
 let prev=pointAt(0,wheels);
 for(let k=1;k<=Math.ceil(8/step);k++){
  const next=pointAt(Math.min(8,k*step),wheels);
  goals.forEach((goal,i)=>{if(segmentDistance(prev,next,goal)<=radius)covered.add(i)});
  prev=next;
 }
 return covered.size;
}
function makeHazards(rng,refs,goals,count){
 const hazards=[];
 for(let tries=0;tries<1600&&hazards.length<count;tries++){
  const anchor=pointAt(integer(rng,10,790)/100,refs);
  const theta=rng()*2*Math.PI;
  const radius=integer(rng,32,75);
  const h={x:Math.round(anchor.x+Math.cos(theta)*radius),
    y:Math.round(anchor.y+Math.sin(theta)*radius),r:integer(rng,13,17)};
  if(Math.abs(h.x)>230||Math.abs(h.y)>220)continue;
  if(goals.some(g=>Math.hypot(h.x-g.x,h.y-g.y)<h.r+42))continue;
  if(hazards.some(z=>Math.hypot(h.x-z.x,h.y-z.y)<h.r+z.r+22))continue;
  const distance=minimumRouteDistance(h,refs,{max:8,step:.02});
  if(distance<h.r+14||distance>h.r+65)continue;
  hazards.push(h);
 }
 return hazards.length===count?hazards:null;
}
export function generateCandidates({seed=20261011,difficulty='hard',count=3,goals,hazards}={}){
 assert.ok(Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff,'Seed must be a 32-bit unsigned integer');
 assert.ok(Object.hasOwn(modes,difficulty),'Difficulty must be easy/medium/hard/expert');
 assert.ok(Number.isInteger(count)&&count>=1&&count<=12,'Count must be 1..12');
 const mode=modes[difficulty];
 const goalCount=goals??mode.goals,hazardCount=hazards??mode.hazards;
 assert.ok(Number.isInteger(goalCount)&&goalCount>=2&&goalCount<=5,'Goals must be 2..5');
 assert.ok(Number.isInteger(hazardCount)&&hazardCount>=0&&hazardCount<=3,'Hazards must be 0..3');

 const rng=seeded(seed),candidates=[],published=loadPublishedLevels().levels,attemptLimit=count*1600;
 for(let attempt=0;attempt<attemptLimit&&candidates.length<count;attempt++){
  const refs=referenceWheels(rng,difficulty);
  const start=startWheels(rng,refs);
  const times=targetTimes(rng,refs,goalCount,mode.captureRadius);
  if(!times)continue;
  const positions=times.map(t=>pointAt(t,refs));
  if(goalCoverage(positions,start,mode.captureRadius)===goalCount)continue;
  const danger=makeHazards(rng,refs,positions,hazardCount);
  if(danger===null)continue;
  const number=candidates.length+1;
  const item={
   name:`研究候選 ${String(number).padStart(2,'0')}`,
   desc:'調整圓周半徑與方向，依序連線補給站並避開禁區。',
   tip:'先觀察紅色預測路段，再調整各圓周。',
   start,refs,times,max:16,radius:18,captureRadius:mode.captureRadius,
   hazards:danger,goals:positions
  };
  try{verifyReference(item,{step:.008,requireSafe:true})}catch(e){continue}
  const quality=rankCandidate(item,published,candidates);
  if(quality.reviewFlags.length)continue;
  item.review={id:`orbit-${seed}-${difficulty}-${String(number).padStart(2,'0')}`,
    state:'NOT_REVIEWED',...quality};
  candidates.push(item);
 }
 assert.equal(candidates.length,count,'Unable to generate requested safe, separated and nontrivial candidates');
 return {
  schema:'orbit-research-candidates-v1',
  status:'REVIEW_ONLY_NOT_PUBLISHED',
  seed,difficulty,count,goals:goalCount,hazards:hazardCount,
  criteria:{maxWheels:3,captureRadius:mode.captureRadius,previewIndependent:true,
    allGoalsReachable:true,referenceHazardContacts:0,startNotAlreadySolved:true,
    nearDuplicateThreshold:.88,reviewGate:'READY_FOR_HUMAN_PLAYTEST',automaticPublication:false},
  candidates
 };
}
function parseArgs(argv){
 const allowed=new Set(['seed','difficulty','count','goals','hazards','output']);
 const input={};
 for(let i=0;i<argv.length;i++){
  const arg=argv[i];
  if(arg==='--help'||arg==='-h')return {help:true};
  if(!arg.startsWith('--')||!allowed.has(arg.slice(2))||argv[i+1]===undefined)throw Error('Unknown or incomplete flag: '+arg);
  const key=arg.slice(2),value=argv[++i];
  if(Object.hasOwn(input,key))throw Error('Duplicate flag: '+key);
  input[key]=key==='difficulty'||key==='output'?value:Number(value);
 }
 return input;
}
const here=fileURLToPath(import.meta.url);
if(process.argv[1]&&resolve(process.argv[1])===here){
 try{
  const input=parseArgs(process.argv.slice(2));
  if(input.help){
   console.log('Usage: node tools/generate-level-candidates.mjs --seed 20261011 --difficulty easy|medium|hard|expert --count 3 [--goals 2..5] [--hazards 0..3] [--output research/candidates.json]');
  }else{
   const {output,...options}=input;
   const result=generateCandidates(options);
   const serialized=JSON.stringify(result,null,2)+'\n';
   if(output){
    const dest=resolve(output);
    mkdirSync(dirname(dest),{recursive:true});
    writeFileSync(dest,serialized,{encoding:'utf8',flag:'w'});
    console.log(JSON.stringify({status:'PASS',kind:'candidate-generation',output:dest,
      count:result.candidates.length,seed:result.seed,difficulty:result.difficulty,
      published:false}));
   }else process.stdout.write(serialized);
  }
 }catch(error){
  console.error(error.message);
  process.exitCode=1;
 }
}
