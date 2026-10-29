import {useState} from 'react'
import {readConfig} from './supabase.js'
const projectUrl='https://gvmwkltwrlqwbqegieum.supabase.co'
export async function portalRequest(action,params={},client=null){
 const config=readConfig()
 const token=client?(await client.auth.getSession()).data.session?.access_token:null
 const url=(config?.url||projectUrl).replace(/\/$/,'')+'/functions/v1/client-report-portal'
 const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(config?.key?{'apikey':config.key}:{}),...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...params})})
 const result=await response.json()
 if(!response.ok)throw Error(result.error||'Request failed')
 return result
}
export default function ClientReportPortal(){
 const slug=new URLSearchParams(window.location.search).get('report')||''
 const [password,setPassword]=useState(''),[report,setReport]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{setReport(await portalRequest('view',{slug,password}));setPassword('')}catch(err){setError(err.message)}finally{setBusy(false)}}
 return <main style={{minHeight:'100vh',background:'#f3f7f4',padding:'36px 16px',fontFamily:'system-ui, sans-serif',color:'#173f2e'}}><div style={{maxWidth:900,margin:'auto',background:'white',borderRadius:14,overflow:'hidden',boxShadow:'0 4px 24px #143d2b20'}}><header style={{background:'#143d2b',color:'white',padding:24,textAlign:'center'}}><h1 style={{margin:0}}>MKT Visibility</h1><p>Private Client Visibility Report</p></header><section style={{padding:28}}>{!report?<form onSubmit={submit} style={{maxWidth:420,margin:'auto'}}><h2>View your report</h2><p>Enter the password provided by MKT Visibility. You do not need a Command Center account.</p><label htmlFor="report-password">Report password</label><input id="report-password" type="password" autoComplete="off" required value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',padding:12,margin:'10px 0 16px',boxSizing:'border-box'}}/>{error&&<p role="alert" style={{color:'#9e2828'}}>{error}</p>}<button disabled={busy} style={{background:'#236341',color:'white',padding:'12px 22px',border:0,borderRadius:6,cursor:'pointer'}}>{busy?'Checking…':'View report'}</button></form>:<><h2>{report.businessName} — Visibility Check #{report.version}</h2><p>Prepared {new Date(report.date).toLocaleDateString()}</p><p><a href={report.pdfUrl} target="_blank" rel="noreferrer">Open or download PDF report</a> (temporary secure link)</p><iframe title="Your Visibility Report" src={report.pdfUrl} style={{width:'100%',height:'75vh',border:'1px solid #ddd'}}/><p><button onClick={()=>setReport(null)}>Lock report</button></p></>}</section></div></main>
}
