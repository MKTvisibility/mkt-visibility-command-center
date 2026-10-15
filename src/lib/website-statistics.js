export function websiteReport(records, brand, daily=false) {
 const rows=records.filter(r=>r.brand===brand&&r.channel==='Website'&&r.source==='Google Analytics'&&(daily?r.period_start===r.period_end:(new Date(r.period_end)-new Date(r.period_start))===6*86400000)).sort((a,b)=>b.period_end.localeCompare(a.period_end)||b.updated_at.localeCompare(a.updated_at))
 const anchor=rows.find(r=>r.metric==='Visitors')
 if(!anchor)return null
 const same=rows.filter(r=>r.period_start===anchor.period_start&&r.period_end===anchor.period_end)
 const value=metric=>{const r=same.find(r=>r.metric===metric);return r?Number(r.value):null}
 return {start:anchor.period_start,end:anchor.period_end,visitors:value('Visitors'),views:value('Page views'),sessions:value('Sessions')}
}
export const statisticNumber=value=>value==null?'—':Number(value).toLocaleString()
