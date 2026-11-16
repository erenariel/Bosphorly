// Public retail-reference arithmetic only. Never derives a net cost, quote or availability.
export function knownReferenceSubtotal(record,adults){
 if(!Number.isInteger(adults)||adults<1||adults>16)throw Error('Adults must be 1–16');
 if(!record||!Number.isFinite(record.price)||record.price<=0||!['EUR','USD','TRY'].includes(record.currency)||record.requires_travel_date_confirmation===true)return null;
 const unitMinor=Math.round(record.price*100);
 if(record.basis==='per_person')return {minor:unitMinor*adults,currency:record.currency,from:record.price_type==='from'};
 if(record.basis==='private_two'&&adults===2)return {minor:unitMinor,currency:record.currency,from:record.price_type==='from'};
 return null;
}
