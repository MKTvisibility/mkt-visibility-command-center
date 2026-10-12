import { metadata } from './portfolio.js'
export const BUSINESS_KINDS = ['Prospect','Client','Non-profit','Partner-owned Business']
export const LISTING_ARRANGEMENTS = ['Not specified','Free basic listing','Paid listing','Coupon','Included in MKT Visibility package','Included with Loving Longmont','Partner-owned listing']
export const PARTNERSHIP = 'Current partners: Michelle and Tim.'
export const LISTING_POLICY = 'Paid Loving Longmont listings include a free MKT Colorado listing of the same level and value. MKT Visibility paying customers may receive listings free or included in their purchased package. Partner-owned businesses have their own category.'
export function listingBenefit(business) {
 const m=metadata(business)
 if(m.listingArrangement==='Included with Loving Longmont'||(m.listingArrangement==='Paid listing'&&m.brand==='Loving Longmont')) return 'Includes a free MKT Colorado listing of the same level and value; no additional charge.'
 if(m.listingArrangement==='Included in MKT Visibility package') return 'Listing included in the purchased MKT Visibility package; no separate listing charge.'
 return ''
}
export function businessListingMetadata(draft) {
 return {listingArrangement:LISTING_ARRANGEMENTS.includes(draft.listingArrangement)?draft.listingArrangement:'Not specified',listingLevel:String(draft.listingLevel||'').slice(0,100),listingValue:Math.max(0,Number(draft.listingValue)||0),couponDetails:String(draft.couponDetails||'').slice(0,500)}
}
