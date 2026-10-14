import {metadata} from './portfolio.js'
import {businessMessages} from './domain.js'
import {stageTracking} from './dashboard-reports.js'
export function inactiveBusiness(b){return ['Paused','Archived','Inactive'].includes(b.status)||metadata(b).outreachDecision==='Not a match'}
export function businessStatusMatches(b,filter){return filter==='All'||filter==='Active'&&!inactiveBusiness(b)||filter==='Inactive'&&inactiveBusiness(b)||!['Active','Inactive'].includes(filter)&&b.status===filter}
export function businessOverview(data,filter='All'){
 const businesses=data.businesses.filter(b=>businessStatusMatches(b,filter)).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true}))
 const listedIds=new Set(data.listings.filter(l=>l.status==='Published').map(l=>l.business_id))
 const responseIds=new Set(data.tasks.filter(t=>stageTracking(t).received).map(t=>t.business_id))
 for(const b of businesses)if(businessMessages(data,b.id).some(e=>e.direction==='Inbound'&&['Received','Replied'].includes(e.status)&&!['Automatic','Delivery','Form'].includes(e.message_type)))responseIds.add(b.id)
 const purchases=(data.purchases||[]).filter(p=>p.status==='Paid'),byType=new Map(),packages=new Map()
 for(const p of purchases){const m=metadata(p),type=m.saleType||'Not classified',name=m.salePackage||p.product||'Package not recorded';if(!byType.has(type))byType.set(type,new Set());byType.get(type).add(p.business_id);const key=type+'\n'+name;if(!packages.has(key))packages.set(key,{type,name,ids:new Set()});packages.get(key).ids.add(p.business_id)}
 const group=(key,label,ids)=>({key,label,businesses:businesses.filter(b=>ids.has(b.id))})
 const groups=[{key:'all',label:'Businesses in this report',businesses},group('listed','Businesses listed',listedIds),group('responded','Responded to emails',responseIds),group('upgrades','Purchased an upgraded listing',byType.get('Upgraded listing')||new Set()),group('services','Purchased MKT Visibility services',byType.get('MKT Visibility services')||new Set())]
 const qualifying=new Set([...(byType.get('Upgraded listing')||[]),...(byType.get('MKT Visibility services')||[])])
 groups.splice(3,0,group('buyers','Paying listing / service clients',qualifying))
 const packageGroups=[...packages.values()].map((p,i)=>({...group('package:'+i,p.name,p.ids),type:p.type})).filter(g=>g.businesses.length).sort((a,b)=>a.type.localeCompare(b.type)||a.label.localeCompare(b.label))
 return {groups,packages:packageGroups,active:businesses.filter(b=>!inactiveBusiness(b)).length,inactive:businesses.filter(inactiveBusiness).length}
}
