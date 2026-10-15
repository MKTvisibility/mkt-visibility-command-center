import {metadata,encodeMetadata} from './portfolio.js'
export const discoveryOf = business => metadata(business).discovery
export const awaitingDiscoveryReview = business => discoveryOf(business)?.status === 'Pending review'
export const discoveredBusinesses = data => data.businesses.filter(b=>['Nova research','Hunter research'].includes(discoveryOf(b)?.source)).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}))
export function discoveryReview(business,status,reviewer) {
 if(!['Pending review','Reviewed','Not a match'].includes(status))throw new Error('Choose a review status.')
 if(!reviewer)throw new Error('A reviewer is required.')
 return {...business,notes:encodeMetadata(business,{discovery:{...discoveryOf(business),status,reviewedBy:reviewer,reviewedAt:new Date().toISOString()},...(status==='Not a match'?{outreachDecision:'Not a match'}:{})})}
}
