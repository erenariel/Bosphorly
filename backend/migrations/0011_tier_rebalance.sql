-- Tier rebalance (Nov 2026): lower default campaign rates so Platinum stays the
-- clear goal. Coupons already issued keep the rate they were issued with.
UPDATE campaigns SET percent_bps=300 WHERE id='welcome-2026';
UPDATE campaigns SET percent_bps=300 WHERE id='referral-2026';
UPDATE campaigns SET percent_bps=500 WHERE id='second-tour-2026';
UPDATE campaigns SET percent_bps=700 WHERE id='loyalty-2026';
