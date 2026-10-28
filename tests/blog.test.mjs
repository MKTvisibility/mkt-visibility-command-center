import test from 'node:test'
import assert from 'node:assert/strict'
import {blogSlug,blogPayload,mountainISO,mountainInput,blogState} from '../src/lib/blog.js'
test('Mountain Time scheduling handles daylight saving transitions independently of the browser timezone',()=>{
 assert.equal(mountainISO('2026-10-28T09:30'),'2026-10-28T15:30:00.000Z')
 assert.equal(mountainISO('2026-12-01T09:30'),'2026-12-01T16:30:00.000Z')
 assert.equal(mountainISO('2026-11-01T01:30'),'2026-11-01T07:30:00.000Z')
 assert.throws(()=>mountainISO('2027-03-14T02:30'),/does not exist/)
 assert.throws(()=>mountainISO(''),/Choose/)
 assert.equal(mountainInput('2026-12-01T16:30:00Z'),'2026-12-01T09:30')
})
test('publication state switches to the scheduled snapshot when its time arrives',()=>{
 const rows=[{post_id:'a',published_at:'2026-10-28T12:00:00Z',source_revision:1},{post_id:'a',published_at:'2026-10-29T12:00:00Z',source_revision:2}]
 assert.equal(blogState(rows,'a',Date.parse('2026-10-28T13:00:00Z')).live.source_revision,1)
 assert.equal(blogState(rows,'a',Date.parse('2026-10-28T13:00:00Z')).scheduled.source_revision,2)
 assert.equal(blogState(rows,'a',Date.parse('2026-10-29T12:00:00Z')).live.source_revision,2)
 assert.equal(blogState(rows,'a',Date.parse('2026-10-29T12:00:00Z')).scheduled,undefined)
 assert.equal(blogState(rows,'b').live,undefined)
 assert.equal(blogSlug('Crème & Local Business!'),'creme-local-business')
 assert.equal(blogPayload({title:'Title',revision:9,workspace_id:'other'}).revision,undefined)
})
