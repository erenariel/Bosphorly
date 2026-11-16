# Istanbul weather and tour timing

The homepage uses MET Norway Locationforecast 2.0 for fixed Istanbul city-centre
coordinates (41.01, 28.97). No user geolocation, booking details, identity or hotel
coordinates are sent. MET receives normal network metadata including browser IP
and Origin; the widget discloses this. It needs no account or API key.

## Source and licensing

- [MET API terms](https://api.met.no/doc/TermsOfService) and
  [FAQ](https://api.met.no/doc/FAQ): commercial reuse is allowed under CC BY 4.0.
  Browser Origin identifies the application; backend tools use a meaningful UA.
- [Locationforecast documentation](https://api.met.no/weatherapi/locationforecast/2.0/documentation):
  global models update approximately every six hours; identical requests outside
  the Nordic region must not be repeated more often than every three hours.
- The widget credits MET Norway, links CC BY 4.0 and identifies Bosphorly's derived
  ranges/recommendations. Do not imply MET endorses the recommendation or use Yr branding.

Successful responses are cached under `bosphorly.weather.v1` for three hours.
Only public city forecast data and a cache timestamp are persisted, never traveler
PII. Language/activity changes do not refetch. Browser HTTP caching is preserved.
Visible pages refresh once the three-hour interval expires; failed requests have
no automatic retry loop and manual retry is rate-limited to once per minute.
If storage is blocked, data stays in memory. Before significant production traffic,
add a shared caching proxy to enforce aggregate limits, improve privacy and avoid
per-visitor duplication. Respect upstream Expires/cache directives and stay below
MET's published traffic limit; do not blindly poll on the hour.

## What the UI means

The current temperature/condition is the nearest **forecast point**, not a
measured weather observation. Model update time and all windows use
Europe/Istanbul. Seven day cards show sampled forecast temperature ranges and a
representative condition near noon. These are not independently predicted daily
extrema; today may contain only the remaining forecast hours. Beyond the first
couple of days the provider supplies coarser time steps. No values are interpolated
or invented. Rainfall is shown in mm for a **six-hour** interval, not probability.
Wind speeds are converted from m/s to km/h.

Bosphorly compares daytime six-hour windows beginning at 09:00–11:00 Istanbul
time and ending by 17:00, with at least an hour's lead time. These are weather
windows, **not actual tour departure times or product durations**. The start
must lie within today plus six days. A window needs the provider's six-hour rain
and weather symbol, valid temperature/wind samples and an endpoint sample.

Rules (a transparent planning heuristic, not meteorological or marine advice):

| Category | Temperature samples | Max sampled wind | Six-hour rainfall |
| --- | --- | --- | --- |
| Cruise | 10–30°C | 7 m/s (25.2 km/h) | ≤1 mm |
| City walk | 8–32°C | 10 m/s (36 km/h) | ≤2 mm |
| Hammam/indoors | Not weather ranked | — | — |

Only clear/fair/partly-cloudy/cloudy six-hour symbols qualify; fog, thunder,
snow/sleet, rain symbols and unknown values do not. Score is six-hour rain×12 +
max sampled wind×2 + distance of mean sampled temperature from 22°C; lower wins,
with earlier windows breaking ties. Missing wind/rain is not interpreted as zero.
If no window qualifies, there is no recommendation. Membership, price and supplier
availability never enter the score, and the widget never changes a reservation.
Sea state, gusts, marine warnings, microclimates and operator cancellation rules
are not evaluated. The UI states that operations must be verified with the provider.

## Failure behavior and tests

Malformed responses, wrong units, missing forecast days/current point, future
model timestamps and models over 12 hours old are rejected. Network failures,
non-200 responses (including deprecated 203), timeout and stale models show an
unavailable state without fallback numbers or a suggested time. Forecasts are
never hard-coded into the public build. Unknown conditions do not become sunny.

`npm test` covers ranking, timezone, thresholds, missing/stale data and no-match
cases. `npm run test:mobile` includes weather fixture, cache, indoor/no-match and
failure scenarios at 360/390/768/1440px. Synthetic forecasts are generated only
inside tests. The shared browser fixture blocks live MET calls for unrelated
tests. Review screenshots were captured from the real provider, not the synthetic
fixtures; their forecast is a dated illustration, not current forecast data.
