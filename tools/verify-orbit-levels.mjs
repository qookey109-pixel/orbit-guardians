#!/usr/bin/env node
/**
 * Offline verification of every published ORBIT mission.
 * Loads the canonical src/levels.js, NOT the game window.__ORBIT_DEBUG__.
 * Geometry uses an independent implementation in orbit-geometry.mjs.
 */
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { runInNewContext } from 'node:vm';
import { verifyReference } from './orbit-geometry.mjs';

const catalog=readFileSync(new URL('../src/levels.js',import.meta.url),'utf8');
assert.ok(catalog.includes('ORBIT_LEVEL_DATA'),'Published mission module missing');
const {levels,planets,PLANET_SIZE}=runInNewContext(catalog+'\nwindow.ORBIT_LEVEL_DATA',
  {window:Object.create(null)},{timeout:1000});
assert.equal(PLANET_SIZE,6,'Unexpected mission count per planet');
assert.equal(planets.length,3,'Unexpected planet count');
assert.equal(levels.length,18,'Published mission count changed without authorization');

const audit=levels.map((level,i)=>({
  stage:i+1,planet:Math.floor(i/PLANET_SIZE)+1,
  ...verifyReference(level,{step:.008,requireSafe:true})
}));
assert.equal(new Set(levels.map(x=>x.name)).size,levels.length,'Duplicate published mission names');
console.log(JSON.stringify({
  status:'PASS',kind:'independent-reference-geometry',
  stages:levels.length,planets:planets.length,
  goalTotal:audit.reduce((sum,x)=>sum+x.goals,0),
  levelsWithHazardContact:audit.filter(x=>x.hazardContacts!==0),audit
}));
