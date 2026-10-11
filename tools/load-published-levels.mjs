/** Load the browser's static published data in a restricted Node VM for research. */
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {strict as assert} from 'node:assert';
export function loadPublishedLevels(){
 const source=readFileSync(new URL('../src/levels.js',import.meta.url),'utf8');
 const root=Object.create(null);
 runInNewContext(source,{window:root},{timeout:1200});
 const catalog=root.ORBIT_LEVEL_DATA;
 assert.ok(catalog&&catalog.levels.length===18&&catalog.planets.length===3,'Unexpected published mission catalog');
 return catalog;
}
