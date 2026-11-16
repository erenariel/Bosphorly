# Transfer planning UI

The homepage builds on the existing Bosphorly layout, approved logo and Istanbul
map. `transfer.js` owns the three form stages; the inline homepage script still
owns language, experience cards and sourced market-price display.

## Route and trip choices

- One way or round trip.
- Airport → hotel, hotel → airport, hotel → another area.
- IST/SAW selection locks the appropriate airport address. The hotel endpoint
  follows the direction; another area's address is manually editable.
- A round trip reverses the route and requires its own date/time. Airport legs
  require flight numbers; hotel-to-area legs do not. Return must follow departure
  in Istanbul local time. Dates before today are rejected.
- Vito is a capacity choice, not a claim of fleet availability: maximum seven.
  Passenger count creates one labelled fieldset per traveler. Shrinking the count
  removes excess rows; remaining rows keep entered values.
- Nationality, gender, passport number, first and last names are editable in page
  memory as requested. No traveler field has an HTML `name`; no data is sent,
  logged, persisted, serialized into URLs or echoed in the plan result. There is
  no passport API/storage migration, export or confirmed reservation. Actual
  collection/retention needs licensed-partner requirements, a completed privacy
  notice, access controls and explicit production configuration. The current
  disabled `/v1/requests` endpoint remains disabled.
- Transfer date/time, flight number and optional driver note are provided. No
  phone, baby-seat, booster-seat or payment fields exist in this form.

## Hotel addresses

Uses the existing optional Google Places adapter. A selected result (with a
place ID, formatted address and Istanbul coordinates) fills the hotel-side
address, regardless of travel direction. Edits/new selections invalidate old
matches and clear the old synchronized address. Async results from obsolete
selections are ignored. No address is invented for an ambiguous hotel name.

**No Google key is configured.** The public review build uses manual entry and
an explicit unverified notice. For real Google suggestions, follow
[GOOGLE-PLACES.md](GOOGLE-PLACES.md): an appropriately restricted browser key,
Google API enablement and billing configuration are required. Add the exact
review-site origin to allowed referrers if testing there. Do not commit real
credentials. Tests use a synthetic Places fixture, not real hotel results.

## Pricing and membership introduction

Only the existing owner-provided one-way airport → Sultanahmet retail rates in
`data/offers.json` can display for that exact scope. No reverse/return/other-area
price is inferred, multiplied or invented: those routes require a quote. The
UI does not guarantee availability or apply a discount.

Membership is an optional header link labelled “Üye ol” in Turkish, with matching
labels in all existing homepage locales. It opens the separate membership page
in the chosen language. No opening dialog, backdrop, focus trap or dismissal
step interrupts discovery. On mobile the action shares the first header row
with the logo; language and navigation remain in the second row. The proposed
10% campaign stays a draft on the membership page and is not applied to quotes.

Transfer labels support English, Turkish, Arabic and Russian; other existing
homepage locales fall back to English for new transfer labels. RTL layout remains
supported. Automated browser checks now include desktop width 1440 alongside
360/390/768. Tests cover capacity, route reversal, return chronology, Google
fixture population/invalidation, unobstructed opening and membership navigation, form validation and no PII
submission. `npm test` and `npm run test:mobile` must pass before delivery.

## Compact layout

The route stage groups journey choices, route/vehicle and pickup/destination
addresses. Hotel and area share a row on desktop; addresses sit side by side.
The map is preserved in an optional disclosure, while route endpoints and a
single fare label remain visible. Passenger rows begin with first/last name.
Duplicate address and fare notices are removed; quote scope and unverified
manual-address status remain visible. Capacity, directions and validation are
unchanged.

## Focused transfer entry

The form starts with Airport transfer / Private route buttons. Only two relevant
directions are shown in each mode. Airport routes show a single editable hotel
endpoint: the airport address remains automatically populated and read-only in
the form model, but its duplicate textarea is hidden. A static Vito capacity
note replaces the single-option vehicle selector. Hotel area is optional and
opens on demand; hotel lookup remains available. Route / Passengers / Dates
labels identify the three steps. Existing price scope, return validation, Google
address invalidation and local-only passenger handling are preserved. The
standalone journey fare calculator remains independent.
