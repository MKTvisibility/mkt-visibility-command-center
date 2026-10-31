const hosts={Instagram:'instagram.com',Facebook:'facebook.com',TikTok:'tiktok.com',LinkedIn:'linkedin.com',YouTube:'youtube.com',Pinterest:'pinterest.com'}
export function knownPlatformLinks(business,profile={},overrides={}){
 const links={};const set=(name,value)=>{try{const u=new URL(String(value||'').trim());if(!['https:','http:'].includes(u.protocol))return;const host=u.hostname.toLowerCase(),expected=hosts[name];if(expected&&host!==expected&&!host.endsWith('.'+expected)&&!(name==='YouTube'&&host==='youtu.be'))return;links[name]=u.href}catch{/* Invalid links remain unavailable. */}};
 set('Website',business.website);for(const value of business.social_urls||[])for(const [name,host] of Object.entries(hosts)){try{const h=new URL(value).hostname;if(h===host||h.endsWith('.'+host))set(name,value)}catch{/* Invalid saved link. */}}
 for(const [name,p] of Object.entries(profile.platforms||{}))set(name,p.url);for(const [name,value] of Object.entries(overrides||{}))set(name,value);return links
}
export function mergePlatformResearch(normalized,previous,selected,links,excluded=[]){
 const a=normalized.assessment,prior=previous?.assessment||{},focused=Array.isArray(selected)&&selected.length>0&&selected.length<9;
 if(focused&&previous){const researched=Object.fromEntries(selected.filter(name=>a.platforms?.[name]).map(name=>[name,a.platforms[name]]));normalized.assessment={...prior,...a,platforms:{...prior.platforms,...researched}};normalized.assessment.sources=[...new Map([...(prior.sources||previous.sources||[]),...(a.sources||[])].map(x=>[x.url,x])).values()]}
 const result=normalized.assessment;
 for(const [name,url] of Object.entries(links)){if(focused&&!selected.includes(name)&&result.platforms?.[name])continue;const p=result.platforms[name]||{score:null,state:'Unable to Verify',evidence:[]};p.url=url;p.url_source='team';if(!p.explanation||/account not found|not discover|no official.*account|no.*account.*found|could not.*find|unable to locate/i.test(p.explanation)||p.state==='Missing'){p.state='Unable to Verify';p.score=null;p.explanation=`A ${name} link was provided by the team: ${url}. The account's public content could not be independently verified during this research. This is a supplied link, not an account-not-found finding.`}result.platforms[name]=p}
 for(const name of excluded){result.platforms[name]={...(prior.platforms?.[name]||result.platforms[name]),state:'Not Applicable',score:null,relevant:false}}
 return normalized
}
