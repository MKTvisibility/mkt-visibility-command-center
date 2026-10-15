import test from 'node:test'
import assert from 'node:assert/strict'
import {completeToolReply} from '../supabase/functions/ai-headquarters/reply.mjs'
const call=(id)=>({type:'function_call',call_id:id,name:'read_queue',arguments:'{}'})
const answer={type:'message',content:[{type:'output_text',text:'Review complete. Nothing sent.'}]}
test('three sequential checks are followed by a text-only reply with all results',async()=>{
 let requests=0,executed=0
 const result=await completeToolReply({input:[],complete:async(input,choice)=>{
  requests++
  assert.equal(choice,requests===4?'none':'auto')
  if(requests===4)assert.equal(input.filter(x=>x.type==='function_call_output').length,3)
  return {status:'completed',usage:{input_tokens:10,output_tokens:5},output:[requests===4?answer:call(String(requests))]}
 },execute:async()=>({checked:++executed,sent:0})})
 assert.equal(result.text,'Review complete. Nothing sent.')
 assert.equal(executed,3)
 assert.deepEqual(result.usage,{input_tokens:40,output_tokens:20,tool_calls:3})
})
test('excess batch calls cannot exceed the operation budget',async()=>{
 let executed=0,requests=0
 await completeToolReply({input:[],complete:async(input,choice)=>{
  requests++
  if(requests===2){assert.equal(choice,'none');assert.match(input.at(-1).output,/operation limit/)}
  return {status:'completed',output:requests===1?[call('1'),call('2'),call('3'),call('4')]:[answer]}
 },execute:async()=>({checked:++executed})})
 assert.equal(executed,3)
})
test('an interrupted operation is never described as having performed nothing',async()=>{
 let requests=0
 await completeToolReply({input:[],complete:async(input)=>{
  if(++requests===2)assert.match(input.at(-1).output,/do not assume nothing happened/)
  return {status:'completed',output:requests===1?[call('1')]:[answer]}
 },execute:async()=>{throw Error('Lost acknowledgement')}})
})
test('model cannot execute tools during the summary turn',async()=>{
 let executed=0
 await assert.rejects(()=>completeToolReply({input:[],complete:async()=>({status:'completed',output:[call('1')]}),execute:async()=>({checked:++executed})}),/No additional tools/)
 assert.equal(executed,3)
})
