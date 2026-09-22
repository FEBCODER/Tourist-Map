/* =====================================================================
 * TourSpot Finder — app.js
 * BS Mathematics · Computer Application Project
 *
 * MATH USED:
 *  1) Haversine Formula  → great-circle distance between two lat/lng points
 *       d = 2R · arcsin( √[ sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2) ] )
 *  2) Nearest Neighbor Algorithm (TSP greedy approximation)
 *       → builds a short route that visits every tourist spot once
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * 🔑 STEP 1: PASTE YOUR GOOGLE MAPS API KEY HERE
 * Get one free at: https://console.cloud.google.com/google/maps-apis
 * Enable: "Maps JavaScript API" + "Places API" (optional)
 * ------------------------------------------------------------------- */
const GOOGLE_MAPS_API_KEY = "YOUR_API_KEY_HERE";

/* ---------- Tourist spot data (Manila area, Philippines) ---------- */
const TOURIST_SPOTS = [
  { id: 1, name: "Intramuros",                lat: 14.5896, lng: 120.9749, cat: "historical", desc: "Walled city from the Spanish colonial era." },
  { id: 2, name: "Rizal Park (Luneta)",       lat: 14.5823, lng: 120.9747, cat: "historical", desc: "Historic park honoring Dr. José Rizal." },
  { id: 3, name: "Manila Ocean Park",         lat: 14.5792, lng: 120.9717, cat: "nature",     desc: "Oceanarium and marine-themed park." },
  { id: 4, name: "Fort Santiago",             lat: 14.5948, lng: 120.9705, cat: "historical", desc: "Citadel built by Spanish conquistador Miguel López de Legazpi." },
  { id: 5, name: "National Museum of Fine Arts", lat: 14.5869, lng: 120.9812, cat: "historical", desc: "Home of the famous Spoliarium painting." },
  { id: 6, name: "Star City",                 lat: 14.5686, lng: 120.9894, cat: "adventure",  desc: "Popular amusement park by the bay." },
  { id: 7, name: "Manila Baywalk",            lat: 14.5673, lng: 120.9803, cat: "nature",     desc: "Famous sunset promenade along Roxas Blvd." },
  { id: 8, name: "Binondo (Chinatown)",       lat: 14.6004, lng: 120.9745, cat: "historical", desc: "Oldest Chinatown in the world." },
  { id: 9, name: "Paco Park",                 lat: 14.5791, lng: 120.9892, cat: "nature",     desc: "Circular Spanish-era cemetery turned park." },
  { id: 10, name: "Casa Manila",              lat: 14.5899, lng: 120.9750, cat: "historical", desc: "Museum showcasing colonial lifestyle." },
];

const CATEGORY_ICONS = {
  beach: "🏖️", nature: "🌿", historical: "🏛️", adventure: "🎢",
};

/* ---------- Global state ---------- */
let map, userMarker, routePath;
let userPos = null;
const spotMarkers = {};

/* =====================================================================
 * MATH FUNCTIONS
 * ===================================================================== */

/** Convert degrees → radians */
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Haversine formula — distance (km) between two lat/lng points on a sphere.
 * R = Earth's mean radius = 6371 km
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Nearest Neighbor algorithm.
 * Starting from `start`, repeatedly visit the closest unvisited point.
 * Returns the ordered route (array of spot objects) and total distance.
 */
function nearestNeighborRoute(start, spots) {
  const unvisited = [...spots];
  const route = [];
  let current = start;
  let totalKm = 0;

  while (unvisited.length > 0) {
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const next = unvisited.splice(bestIdx, 1)[0];
    route.push(next);
    totalKm += bestDist;
    current = next;
  }
  return { route, totalKm };
}

/* =====================================================================
 * GOOGLE MAPS BOOTSTRAP (dynamic script loader with fallback)
 * ===================================================================== */
function loadGoogleMaps() {
  const loader = document.createElement("script");
  loader.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
  loader.async = true;
  loader.defer = true;
  loader.onerror = () => {
    document.getElementById("apiNotice").classList.remove("hidden");
  };
  // Safety timeout: if map doesn't init in 8s, show the notice
  setTimeout(() => {
    if (!map) document.getElementById("apiNotice").classList.remove("hidden");
  }, 8000);
  document.head.appendChild(loader);
}
window.initMap = initMap; // required global callback

/* =====================================================================
 * MAP INITIALIZATION
 * ===================================================================== */
function initMap() {
  document.getElementById("mapLoading").classList.add("hidden");

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 14.5869, lng: 120.9812 }, // Manila
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
  });

  // Drop a marker for every tourist spot
  TOURIST_SPOTS.forEach((spot) => {
    const marker = new google.maps.Marker({
      position: { lat: spot.lat, lng: spot.lng },
      map,
      title: spot.name,
      icon: {
        url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      },
    });

    const info = new google.maps.InfoWindow({
      content: `
        <div style="font-family:inherit;max-width:220px">
          <h3 style="margin:0 0 4px">${CATEGORY_ICONS[spot.cat] || "📍"} ${spot.name}</h3>
          <p style="margin:0;font-size:.85rem">${spot.desc}</p>
          <p style="margin:6px 0 0;font-size:.75rem;color:#5f6368;text-transform:capitalize">Category: ${spot.cat}</p>
        </div>`,
    });
    marker.addListener("click", () => info.open(map, marker));
    spotMarkers[spot.id] = marker;
  });

  renderSpotList(TOURIST_SPOTS);
}

/* =====================================================================
 * USER GEOLOCATION
 * ===================================================================== */
document.getElementById("locateBtn").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Geolocation is not supported by this browser.");

  document.getElementById("locateBtn").textContent = "⏳ Locating…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      showUserOnMap();
      computeAndDisplayNearest();
      document.getElementById("locateBtn").textContent = "📍 Find My Location";
    },
    (err) => {
      alert("Could not get your location: " + err.message);
      document.getElementById("locateBtn").textContent = "📍 Find My Location";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

function showUserOnMap() {
  if (userMarker) userMarker.setMap(null);
  userMarker = new google.maps.Marker({
    position: userPos,
    map,
    title: "You are here",
    icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" },
    animation: google.maps.Animation.DROP,
  });
  map.setCenter(userPos);
  map.setZoom(14);
}

/* =====================================================================
 * NEAREST-SPOT LOGIC
 * ===================================================================== */
function computeAndDisplayNearest() {
  // Compute distance from user to every spot (Haversine)
  const ranked = TOURIST_SPOTS.map((s) => ({
    ...s,
    distanceKm: haversineKm(userPos.lat, userPos.lng, s.lat, s.lng),
  })).sort((a, b) => a.distanceKm - b.distanceKm);

  const nearest = ranked[0];

  // Update UI
  document.getElementById("nearestInfo").innerHTML = `
    <p class="spot-name">${CATEGORY_ICONS[nearest.cat]} ${nearest.name}</p>
    <p class="dist">${nearest.distanceKm.toFixed(2)} km away</p>
    <p class="muted">${nearest.desc}</p>
    <p class="formula">d = 2R·arcsin(√[sin²(Δφ/2) + cosφ₁cosφ₂·sin²(Δλ/2)]),  R = 6371 km</p>
  `;

  renderSpotList(ranked);
  document.getElementById("routeBtn").disabled = false;
}

/* =====================================================================
 * SMART ROUTE (Nearest Neighbor)
 * ===================================================================== */
document.getElementById("routeBtn").addEventListener("click", () => {
  if (!userPos) return;
  const { route, totalKm } = nearestNeighborRoute(userPos, TOURIST_SPOTS);

  // Draw polyline on map: user → spot1 → spot2 → …
  const path = [userPos, ...route.map((s) => ({ lat: s.lat, lng: s.lng }))];
  if (routePath) routePath.setMap(null);
  routePath = new google.maps.Polyline({
    path,
    geodesic: true,
    strokeColor: "#f29900",
    strokeOpacity: 0.9,
    strokeWeight: 4,
    map,
  });

  const bounds = new google.maps.LatLngBounds();
  path.forEach((p) => bounds.extend(p));
  map.fitBounds(bounds);

  // Render ordered route list
  document.getElementById("routeInfo").innerHTML = `
    <ol>
      ${route
        .map((s, i) => {
          const from = i === 0 ? userPos : route[i - 1];
          const leg = haversineKm(from.lat, from.lng, s.lat, s.lng);
          return `<li><strong>${s.name}</strong> <span class="muted">(+${leg.toFixed(2)} km)</span></li>`;
        })
        .join("")}
    </ol>
    <p class="total">Total tour distance: ${totalKm.toFixed(2)} km (greedy NN-TSP)</p>
  `;
});

/* =====================================================================
 * SEARCH + CATEGORY FILTER
 * ===================================================================== */
function applyFilters() {
  const q = document.getElementById("searchBox").value.trim().toLowerCase();
  const cat = document.getElementById("categoryFilter").value;

  const filtered = TOURIST_SPOTS.filter((s) => {
    const matchCat = cat === "all" || s.cat === cat;
    const matchQ = !q || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  // Filter markers too
  TOURIST_SPOTS.forEach((s) => {
    const visible = filtered.some((f) => f.id === s.id);
    spotMarkers[s.id].setMap(visible ? map : null);
  });

  // Re-attach distances if user located
  const withDist = filtered.map((s) =>
    userPos ? { ...s, distanceKm: haversineKm(userPos.lat, userPos.lng, s.lat, s.lng) } : s
  );
  if (userPos) withDist.sort((a, b) => a.distanceKm - b.distanceKm);
  renderSpotList(withDist);
}
document.getElementById("searchBox").addEventListener("input", applyFilters);
document.getElementById("categoryFilter").addEventListener("change", applyFilters);

/* =====================================================================
 * RENDER SPOT LIST
 * ===================================================================== */
function renderSpotList(spots) {
  document.getElementById("spotCount").textContent = spots.length;
  const ul = document.getElementById("spotList");
  ul.innerHTML = "";

  spots.forEach((s) => {
    const li = document.createElement("li");
    li.className = "spot-item";
    li.innerHTML = `
      <div>
        <div class="spot-item__name">${CATEGORY_ICONS[s.cat] || "📍"} ${s.name}</div>
        <div class="spot-item__cat">${s.cat}</div>
      </div>
      <div class="spot-item__dist">${s.distanceKm ? s.distanceKm.toFixed(2) + " km" : ""}</div>
    `;
    li.addEventListener("click", () => {
      map.setCenter({ lat: s.lat, lng: s.lng });
      map.setZoom(15);
      google.maps.event.trigger(spotMarkers[s.id], "click");
    });
    ul.appendChild(li);
  });
}

/* ---------- Start ---------- */
loadGoogleMaps();
