# Road distance and taxi reference scenarios

## Delivered scope

An optional calculator sits under pickup/destination on transfer stage one.
The new address/area → address direction hides irrelevant hotel/airport fields.
Entering addresses does not generate geocoder traffic: the user clicks Find,
chooses the intended Istanbul matches, and the road route is then computed.
This supports districts, landmarks and street addresses. A district result is a
representative point, not an exact door; refine the address for a precise pickup.
The existing Bosphorly fixed airport tariff and server quote engine are untouched.

Distance is the router's driving-route metres, not a straight-line approximation.
Duration is a base model without current traffic. Every reference calculation is
one way, even when the separate transfer form is configured for a round trip.
Return routes are not assumed to have the same distance or to cost double.
Invalid/no routes, ferries/non-driving steps, non-Istanbul endpoints or snapping
more than 1.5 km from the selected point produce an unavailable result, not
invented distance. The UI makes no traffic, price-cap or availability guarantee.

## Sources and tariffs checked 16 November 2026

Primary source: [İBB TUHİM tariff PDF, 17 July 2026 decision 813, effective
20 July 2026](https://tuhim.ibb.gov.tr/media/27494/taksi-ta%C5%9F%C4%B1mac%C4%B1l%C4%B1%C4%9F%C4%B1-%C3%BCcret-tarifesi.pdf).
Downloaded and read using pdftotext; SHA-256 is recorded in
`data/taxi-reference.json`. References are TRY integer kuruş, not supplier
wholesale costs, commissions or Bosphorly selling prices.

| Licensed category | Opening TL | Per km TL | Minimum TL | Stationary minute TL |
| --- | --- | --- | --- | --- |
| Yellow, C and above | 71.94 | 47.92 | 230 | 9.98 |
| Turquoise, D / 8+1 | 82.73 | 55.10 | 265 | 11.47 |
| Yellow, driver excluded 8 passengers | 93.52 | 62.29 | 300 | 12.97 |
| Black, E/F / 8+1 | 122.30 | 81.46 | 400 | 16.96 |

The current İTEO page/news disagrees on the 8-passenger kilometre rate (62.69).
The primary municipal PDF says **62.29**, which is used here. Do not silently
replace primary-source figures with secondary calculations or marketing pages.

For the chosen road distance, the lower scenario has no extra stationary wait;
the higher adds the user's selected 0–120 stationary minutes (15 by default).
Formula: max(minimum, opening + metres/1000 × per-km + stationary minutes ×
per-minute), rounded to kuruş after calculation. Driving duration is never added
again as waiting. The actual meter switches distance/time at low speed (the PDF
lists 12.5 km/h) and uses measurement increments; model arithmetic is approximate.
Traffic, detours, meter increments and tolls can change the actual payable sum.
Bridge, tunnel, motorway and return costs are excluded, not assumed zero.
This is a declared scenario range, not a statistical range or a maximum fare.

**Private VIP Vito has no approved tariff**, as explicitly confirmed by the owner.
A licensed 8-passenger/black taxi is not interchangeable with a private Vito.
The Vito card always requires a separate Bosphorly quote; no multiplier or
invented private fare is applied. Vehicle/passenger/luggage suitability must be
verified separately. No payments or booking requests are enabled.

## Keeping rates current

The committed reference was checked on 2026-11-16 and expires for estimates after
2026-12-16. This is not a live municipal tariff feed. A new rule may be published
before that review date: always follow the linked official source and its date.
When updating, verify the latest link on the official TUHİM tariffs page, download
and read the current PDF, record effective/verification/review dates and source
hash, update the integer values and tests, and submit a reviewed PR. Never scrape
unreviewed prices straight into the Bosphorly sales engine. Review windows longer
than 31 days, future verification dates and stale/unavailable tariffs disable
monetary estimates while road distance remains usable.

## Providers, privacy and production gate

Review endpoints are in `config/routes-public.js`, without keys:

- [Photon public demo policy](https://github.com/komoot/photon#demo-server):
  reasonable low-volume use only; extensive use may be throttled/banned and
  availability is not guaranteed. Use a contracted or self-hosted instance at scale.
- [FOSSGIS routing policy](https://routing.openstreetmap.de/about.html): maximum
  one request per second, no scraping/heavy usage, correct application referrer,
  OSM attribution and a fix-the-map link. This implementation uses driving steps;
  this endpoint does not support `exclude=ferry`, so ferry routes are rejected.

Requests are user-triggered, serialized and spaced at least 1.1 seconds apart in
one page; there are no autocomplete, periodic lookup or automatic retry loops.
Responses are cached only in page memory. This is not an aggregate multi-user
rate limiter. **Before production traffic, configure a shared rate-limited proxy
or contracted/self-hosted providers**; do not rely on public review endpoints
for a high-traffic commercial booking service. Provider selection is isolated in
public config; never put server API secrets there. Public Nominatim is not used.

The visible notice says address text is sent to Photon and selected coordinates
to FOSSGIS/OSRM, with ordinary network metadata. No passenger names, passport
numbers, driver notes or membership details are sent by the calculator. Address
queries, selections and routes are not persisted to local/session storage,
Bosphorly servers or the URL, and are not logged by application code. Providers
may keep their own logs; their source/policy links are provided in the UI.

Changing an address, direction, airport, hotel or trip type immediately clears
results and cancels pending work. Deselecting a match also prevents stale results
from reappearing. Failures do not block the independent local transfer plan.

Tests use synthetic addresses/routes and never hit public geocoders/routers.
`npm test` checks source math, minimum handling, expiry, coordinates, modes,
snapping and invalid inputs. Browser tests cover manual matching, automatic
calculation, language/RTL, no persisted address data, failures and request races.
Review screenshots use real public landmarks and live service responses; they
are dated illustrations, not current fare guarantees or confirmed reservations.
