import test from 'node:test'
import assert from 'node:assert/strict'
import {suggestPageFilename,validPageFilename} from '../src/lib/page-filename.js'
test('business names become shareable filenames',()=>{assert.equal(suggestPageFilename('Recovery Café Longmont'),'recovery-cafe-longmont.html');assert.equal(suggestPageFilename('A & B / Studio'),'a-b-studio.html');assert.equal(suggestPageFilename('Community'),'community-local.html')})
test('filenames cannot target navigation pages or escape their directory',()=>{for(const s of ['index.html','business.html','../client.html','client/page.html','https://example.com/x.html','client.HTML','client.html?x=1','client.html#id=x'])assert.equal(validPageFilename(s),false,s);assert.equal(validPageFilename('recovery-cafe-longmont.html'),true)})
