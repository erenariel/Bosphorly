# Google hotel matching — activation and operational rules

## Current status
The Bosphorly traveler homepage includes an optional Google Places (New) hotel autocomplete adapter in `hotel-lookup.js`. When Google is configured, choosing an Istanbul hotel captures its Google place ID, display name, formatted address and latitude/longitude **in page memory**. It also attempts to identify its region; unknown or ambiguous locations remain **other area / quote required**. This public demo does not submit or store guest data.

Without a configured Google key, manual hotel and region entry stays available. Manual input is visibly **unverified**. Never describe it as Google-matched.

## Configure Google Maps Platform
1. Create a Google Cloud project with billing enabled and enable **Maps JavaScript API** and **Places API (New)**.
2. Create a browser API key; restrict the key to website HTTP referrers, including `https://erenariel.github.io/Bosphorly/*`. If testing locally, add only your explicit localhost origin. Apply API restrictions to the relevant Maps and Places APIs.
3. Add that **browser-restricted key** to `config/maps-public.js`, in `googleMapsBrowserKey`. Browser keys are visible client-side by design and MUST be constrained; never put unrestricted API keys or backend secrets here.
4. Open `index.html`, type a hotel in the Google autocomplete widget, select a suggestion, and verify the displayed street address, detected area and fare.
5. Monitor Places usage and spending caps in Google Cloud.

Official docs:
- https://developers.google.com/maps/documentation/javascript/place-autocomplete-new
- https://developers.google.com/maps/documentation/javascript/place-autocomplete-data
- https://developers.google.com/maps/documentation/javascript/get-api-key

## Important limitations
- A name alone does not prove which hotel the user means; a **chosen Google Places suggestion** is required for verified identity.
- Latitude/longitude and Google Place ID allow later route, geocoding, and zone-based quote calculations; the current public page does not call a routing engine.
- Google Maps Platform has billing and data-use terms. For mapping Google-sourced POIs, observe display and retention restrictions. Do not store or republish proprietary Google place data at scale without an appropriate license.
- Do not use the public OpenStreetMap Nominatim service for client-side autocomplete at scale.
- Do not assume all of Fatih costs €55/€65; **only Sultanahmet** is configured as a fixed-fare zone. Validated geofence/routing rules should replace the temporary address-text zone heuristic before live booking.
- Hotel name and selected address must remain separate from any real passenger PII, and never be exposed in public logs.
