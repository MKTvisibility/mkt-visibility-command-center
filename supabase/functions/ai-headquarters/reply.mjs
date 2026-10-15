// Three bounded operations, followed by a dedicated text-only summary turn.
// Reaching the operation budget must not discard work already completed.
export async function completeToolReply({input,complete,execute}){
 const usage={input_tokens:0,output_tokens:0,tool_calls:0}
 for(let round=0;round<=3;round++){
  const final=round===3||usage.tool_calls>=3
  const result=await complete(input,final?'none':'auto')
  usage.input_tokens+=result.usage?.input_tokens||0
  usage.output_tokens+=result.usage?.output_tokens||0
  if(result.status!=='completed')throw Error('The AI response was incomplete. Check any operation results before retrying.')
  const requested=(result.output||[]).filter(o=>o.type==='function_call')
  if(!requested.length){
   const text=(result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').trim()
   return {text,usage}
  }
  if(final)throw Error('The AI did not return a summary. No additional tools were run. Check saved operation results before retrying.')
  input.push(...result.output)
  for(const call of requested){
   let value
   if(usage.tool_calls>=3)value={error:'The operation limit was reached. Summarize the results already returned; do not request more tools.'}
   else{
    let args
    try{args=JSON.parse(call.arguments)}catch{value={error:'Tool arguments were invalid; no operation was performed.'}}
    if(args!==undefined){try{value=await execute(call.name,args)}catch{value={error:'Tool execution was interrupted. Check saved operation results before retrying; do not assume nothing happened.'}}}
    usage.tool_calls++
   }
   const output=JSON.stringify(value)
   input.push({type:'function_call_output',call_id:call.call_id,output:output.length>12000?JSON.stringify({partial:true,notice:'Result exceeded the display limit. Read campaign history for saved outcomes; do not assume this preview is complete.',preview:output.slice(0,10000)}):output})
  }
 }
 throw Error('No complete reply was returned. Check operation results before retrying.')
}
