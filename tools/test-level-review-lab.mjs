#!/usr/bin/env node
/**
 * Guard the publicly visible sample: exact output of the seeded workshop,
 * NOT an independently edited/published level pack.
 */
import {readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {generateCandidates} from './generate-level-candidates.mjs';
import {rankCandidate,compareToCatalog} from './level-quality.mjs';
import {loadPublishedLevels} from './load-published-levels.mjs';
import {verifyReference} from './orbit-geometry.mjs';

const sample=JSON.parse(readFileSync(new URL('../lab/sample-candidates.json',import.meta.url),'utf8'));
assert.equal(sample.schema,'orbit-research-candidates-v1');
assert.equal(sample.status,'REVIEW_ONLY_NOT_PUBLISHED');
assert.equal(sample.count,3);
assert.equal(sample.candidates.length,3);
const reproduced=generateCandidates({seed:sample.seed,difficulty:sample.difficulty,
 count:sample.count,goals:sample.goals,hazards:sample.hazards});
assert.deepEqual(sample,reproduced,'Demonstration data drifted from generator output');
const published=loadPublishedLevels().levels;
const earlier=[];
for(const candidate of sample.candidates){
 const result=verifyReference(candidate,{step:.008,requireSafe:true});
 assert.equal(result.goals,candidate.goals.length);
 assert.equal(result.hazardContacts,0);
 const review=rankCandidate(candidate,published,earlier);
 assert.equal(review.challengeIndex,candidate.review.challengeIndex);
 assert.equal(review.roughBand,candidate.review.roughBand);
 assert.equal(review.reviewGate,'READY_FOR_HUMAN_PLAYTEST');
 assert.equal(compareToCatalog(candidate,published,earlier).noveltyPassed,true);
 earlier.push(candidate);
}
const forged={...sample.candidates[0],refs:sample.candidates[0].refs.map(w=>({...w}))};
forged.refs[0].r+=1;
assert.equal(compareToCatalog(forged,published,[sample.candidates[0]]).noveltyPassed,false);
console.log(JSON.stringify({status:'PASS',kind:'review-lab-demo',
 candidates:sample.count,sourceSeed:sample.seed,
 sourceMode:sample.difficulty,calibratedBands:sample.candidates.map(x=>x.review.roughBand),
 published:false,independentVerification:true}));
