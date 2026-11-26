import test from 'node:test';
import assert from 'node:assert/strict';
import { commissionAmounts } from '../backend/commission.js';
const earned = {status:'completed',paymentStatus:'paid',dbState:'fulfilled',totalMinor:10000,estimatedCommissionMinor:750,grossCommissionMinor:1000};
test('commission eligibility, refunds, discounts and integer rounding', () => {
  assert.deepEqual(commissionAmounts(earned), {finalizedNet:750,finalizedGross:1000,expectedNet:0});
  for (const patch of [{isTest:true},{paymentStatus:'refunded'},{paymentStatus:'pending'},{status:'cancelled'},...['cancelled','refunded','refund_pending','rejected'].map(dbState=>({dbState}))]) {
    assert.equal(commissionAmounts({...earned,...patch}).finalizedNet,0);
  }
  assert.deepEqual(commissionAmounts({...earned,refundedMinor:2500}),{finalizedNet:562,finalizedGross:750,expectedNet:0});
  assert.equal(commissionAmounts({...earned,refundedMinor:10000}).finalizedNet,0);
  assert.equal(commissionAmounts({...earned,status:'confirmed'}).expectedNet,750);
  assert.equal(commissionAmounts({...earned,status:'confirmed',paymentStatus:'refunded'}).expectedNet,0);
});
