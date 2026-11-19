# Bosphorly business model: referral intermediary, not a selling agency

Status: working model, 16 November 2026. This document is the reference for
how Bosphorly earns money and where its responsibilities start and stop. Where
another document disagrees, this one wins and the other should be corrected.

## In one sentence

Bosphorly brings travelers to licensed Istanbul tour and transfer companies,
the company sells and delivers the service and collects the payment, and
Bosphorly earns a contracted commission on each completed referral.

## Where the idea comes from

In an Istanbul hotel the reception desk keeps brochures from tour companies.
A guest picks a tour, the reception passes the booking to the company, the
company runs the tour and the reception earns a commission for every guest it
sent. Bosphorly moves this desk online, so that:

- it is not limited to guests standing at one hotel's reception;
- a traveler can compare companies, prices and inclusions in their own language
  before arriving in Istanbul;
- hotels can still take part as referral partners, without printing brochures.

## The parties

| Party | Role | Money |
|---|---|---|
| **Traveler** | Finds and requests a tour or transfer on Bosphorly | Pays the **tour company**, at the company's published price |
| **Tour / transfer company** (licensed) | Confirms the request, delivers the service, collects payment, issues the invoice | Pays Bosphorly a commission per completed referral |
| **Bosphorly** | Lists, compares, routes the request, tracks attribution, reconciles monthly | Receives commission from the company |
| **Referring hotel** (optional channel) | Sends its guests to Bosphorly (QR code, link, reception) | Receives a contracted share of Bosphorly's commission |

## How a referral works

1. The traveler browses tours and transfers on Bosphorly and sees each
   company's price, inclusions, meeting point and cancellation terms.
2. The traveler sends a **booking request** through Bosphorly (no payment).
   The request gets a unique **Bosphorly reference code**.
3. Bosphorly forwards the request to the company (email / WhatsApp / partner
   panel). The company confirms or declines; Bosphorly never confirms on the
   company's behalf.
4. The company collects payment directly from the traveler: on the day, at
   pickup, or through the company's own payment link. Bosphorly does not hold
   traveler money in this model.
5. The traveler joins the tour with the Bosphorly reference code, which the
   company records against the sale.
6. Each month the company and Bosphorly reconcile the coded sales. Bosphorly
   invoices its commission; cancelled, no-show and refunded sales earn nothing.
7. If a hotel referred the traveler, Bosphorly pays the hotel its share after
   the company has paid Bosphorly.

The traveler stays on Bosphorly until the request is sent. There is no
redirect to a supplier's own checkout: a redirect loses the attribution that
the commission depends on.

### Current payment rule (hotel reception)

In the current hotel pilot, guests pay **in cash at the hotel reception**, both for airport transfers and for tours. The reception accepts cash only. Tour companies such as Blue Brothers add a 10% commission on credit card payments, which is why guests are asked to pay cash. Both request forms and the WhatsApp message state this. How the reception settles with each company, and how this fits the referral model's "company collects payment" description, must be written into each company agreement.

### Currency display

Prices stay in each company's own currency. Guests can view an approximate amount in TRY, EUR, USD, GBP, RUB, SAR, AED or AZN, converted at the TCMB (Central Bank of the Republic of Türkiye) forex selling rate. `tools/fetch_rates.py` refreshes `data/rates.json` on every deploy and on a weekday schedule after TCMB publishes; if the fetch fails the last good bulletin stays, and its date is always shown. Converted amounts are labelled approximate, and the original price is always shown next to them.

### Guest accounts (device-only for now)

"My account" (`account.html`) keeps the guest's details and the requests they sent on their own device (browser storage). It pre-fills forms and lists upcoming and past requests with their reference codes. It is not a real account: it does not follow the guest to another device, and Bosphorly cannot see it. Cross-device accounts and request status updates need the request server described above.

### Current request channel: WhatsApp

Until the request server exists, both forms (airport transfer and tours) open WhatsApp with the full request written out (reference code, tour or route, date and time, guests, price per person and total, hotel and room, contact, price source and the moment the price was shown) addressed to the Bosphorly WhatsApp Business line. The guest presses send. The message in the WhatsApp chat is the record of what the guest saw. Limits: nothing reaches Bosphorly if the guest does not press send, the text can be edited before sending, and there is no central list of requests. A server-side request store fixes all three.

## Prices shown to travelers

- **Contracted companies:** the price the company approved for Bosphorly in
  writing. It must not be higher than the price the traveler would pay the
  company directly (price parity). Bosphorly's commission comes out of the
  company's margin; the traveler pays no surcharge.
- **Companies without an agreement yet:** their publicly advertised price may
  be shown for comparison, always with the source and the date it was checked,
  marked "published by the operator, not a Bosphorly offer", and without a
  request button. Stale prices are removed or re-checked.
- **Prototype note:** the public demo shows a request button on every tour so the flow can be tried end to end; nothing is sent. Before launch, only companies with a signed agreement get a live request button.
- **Price snapshot:** every request stores, unchanged, the tour, time slot, unit price, estimated total, currency, price source, check date and the moment the price was shown, under the Bosphorly reference code. The guest gets the same summary. If a guest later says "it showed €20", the snapshot settles it. The company still confirms the final price when it accepts.
- Fixed transfer fares (currently IST → Sultanahmet €60, SAW → Sultanahmet
  €65, one way) are the transfer company's retail tariffs, not Bosphorly's.

## What every company agreement should cover

- Commission rate, and whether it is calculated on gross or net (VAT
  excluded) price.
- Which sales count: only sales carrying a Bosphorly reference code and
  actually delivered.
- Monthly reporting of coded sales and a payment term (for example, 15 days
  after reconciliation).
- Price parity and how price changes are notified to Bosphorly.
- Cancellation, no-show and refund handling: no commission on these.
- The company's legal name, TÜRSAB / Ministry licence number and insurance,
  which Bosphorly displays on its listings.
- Who answers traveler complaints about the service itself (the company).
- Use of the company's photos and texts on Bosphorly.

## What Bosphorly does not do in this model

- Does not sell the tour in its own name or act as the contracting party.
- Does not collect, hold or refund traveler payments.
- Does not issue the service invoice or voucher; the company does.
- Does not guarantee availability or confirm a booking on its own.

Taking payments on Bosphorly (merchant of record) is a possible later option,
but it changes the legal position (see below) and needs a separate decision.

## Legal position: open questions

These are risks to check with a Turkish tourism lawyer or TÜRSAB, not settled
conclusions:

- Law 1618 on Travel Agencies covers intermediation of tourism services for
  profit. Whether a referral-only platform that never sells or collects money
  needs its own travel agency certificate must be confirmed before launch.
  Alternatives: operate under a partner A-group agency's certificate, or obtain
  one.
- Commission invoicing and tax treatment of hotel shares.
- Consumer law: who is the seller in a distance contract when the request is
  made on Bosphorly but the contract is concluded with the company; how this is
  disclosed to the traveler.
- KVKK: Bosphorly passes the traveler's name and contact details to the
  company, so the privacy notice must name the companies as recipients and the
  purpose.

See [LEGAL-GATES.md](LEGAL-GATES.md) for the full gate list.
