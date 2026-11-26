// Commission is earned only after completion and payment. Amounts are minor units.
export function commissionAmounts(item) {
  const zero = { finalizedNet: 0, finalizedGross: 0, expectedNet: 0 };
  if (item.isTest || item.paymentStatus === 'refunded' ||
      ['cancelled', 'rejected', 'refund_pending', 'refunded'].includes(item.dbState) ||
      !['completed', 'confirmed'].includes(item.status)) return zero;
  const total = item.totalMinor;
  const refund = item.refundedMinor ?? 0;
  if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(refund) || refund < 0 || refund > total) return zero;
  const prorate = amount => Number.isSafeInteger(amount) && amount >= 0
    ? Number(BigInt(amount) * BigInt(total - refund) / BigInt(total)) : 0;
  const net = prorate(item.estimatedCommissionMinor);
  if (item.status === 'confirmed') return { ...zero, expectedNet: net };
  if (item.paymentStatus !== 'paid') return zero;
  return { ...zero, finalizedNet: net, finalizedGross: prorate(item.grossCommissionMinor) };
}
