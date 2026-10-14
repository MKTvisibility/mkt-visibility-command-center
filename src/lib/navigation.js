export function readNavigation(storage,key,pages){
 try{const saved=JSON.parse(storage.getItem(key)||'null');return {page:pages.includes(saved?.page)?saved.page:'Dashboard',profileId:typeof saved?.profileId==='string'?saved.profileId:null}}catch{return {page:'Dashboard',profileId:null}}
}
export function saveNavigation(storage,key,page,profileId){
 try{storage.setItem(key,JSON.stringify({page,profileId}))}catch{/* Navigation still works when browser storage is unavailable. */}
}
