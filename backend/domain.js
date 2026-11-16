export const transitions = Object.freeze({draft:['requested','cancelled'],requested:['supplier_pending','rejected','cancelled'],supplier_pending:['confirmed','rejected','cancelled'],confirmed:['fulfilled','cancelled','refund_pending'],fulfilled:['refund_pending'],refund_pending:['refunded'],rejected:[],cancelled:[],refunded:[]});
export function transition(from, to, role, evidence) {
 if (!['admin','operator'].includes(role) || !transitions[from]?.includes(to) || typeof evidence !== 'string' || !evidence.trim()) throw new Error('Invalid or unauthorized transition');
 return to;
}
export function plan(input) {
 const keys=['experienceId','date','guests'];
 if (!input || Object.keys(input).some(k=>!keys.includes(k)) || !/^[a-z0-9-]{1,80}$/.test(input.experienceId) || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10)!==input.date || input.date < new Date().toISOString().slice(0,10) || !Number.isInteger(input.guests) || input.guests<1 || input.guests>16) throw new Error('Invalid plan');
 return input;
}
export function publicQuote(row, guests) {
 if (!row) return {status:'quote_required',availability:'unverified'};
 const totalMinor=row.unit_minor*guests;
 if (!Number.isSafeInteger(totalMinor) || totalMinor<0) throw new Error('Invalid rate');
 return {status:'quoted',currency:row.currency,totalMinor,availability:'subject_to_operator_acceptance',reservationConfirmed:false};
}
