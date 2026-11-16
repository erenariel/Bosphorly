// Low-volume review endpoints; no keys. Replace with a shared rate-limited proxy
// or contracted/self-hosted services before production traffic. No autocomplete.
window.BOSPHORLY_ROUTE_CONFIG=Object.freeze({
 geocoder:'https://photon.komoot.io/api/',
 router:'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
});
