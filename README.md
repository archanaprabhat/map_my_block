# Map My Block

A mobile-first PWA for Census 2027 enumerators to digitize and map their assigned block areas without manual paper drawing.

## Features

- No login or backend is required for the current hackathon release.
- Census project data stays on the enumerator’s device by default.
- The app works online for map tiles, GPS/geocoding, and automatic map-layer fetching.
- Saved project data remains available offline.

## Technology Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Framework | Next.js 16, React 19, TypeScript | Application framework, routing, and type-safe development |
| Styling | Tailwind CSS 4 | Mobile-first responsive interface styling |
| Mapping | Leaflet, React Leaflet | Interactive map, markers, polygons, overlays, and controls |
| Map sources | OpenStreetMap, ArcGIS World Imagery | Street/road map and satellite base layers |
| Layout-image cropper | react-cropper, Cropper.js | Crop uploaded layout maps before alignment |
| Local project storage | localForage | Persistent project storage using IndexedDB |
| Lightweight UI preferences | Browser localStorage | Stores language preference, active tab, and small handoff/fallback values |
| Offline/PWA | next-pwa, Workbox | Service worker, offline app shell, runtime caching, and tile caching |
| Data export | html-to-image | Captures the completed map as a high-resolution PNG for A4 export |
| Auto-fetched OSM layers | Overpass API | Fetches roads, water, forests, landmarks, and other OpenStreetMap context |
| Address/location lookup | Browser Geolocation API, Nominatim | GPS location and reverse geocoding |
| Building footprints | FlatGeobuf, Google/Microsoft Open Buildings dataset | Efficiently reads building-footprint data for the selected map area |
| Sketch processing | OpenCV.js in a Web Worker | Processes map captures without blocking the interface |
| Map decoration | leaflet-polylinedecorator | Directional/visual decoration for map lines |
| Icons | Lucide React | Interface icons |

The app combines user-entered field data with open geographic data:

- **OpenStreetMap tiles** provide the road/street base map.
- **ArcGIS World Imagery** provides the satellite layer.
- **Overpass API** fetches OpenStreetMap roads, water bodies, forests, landmarks, and similar context layers.
- **Nominatim** is used for reverse geocoding the enumerator’s GPS location.
- **Google/Microsoft Open Buildings** data is read through FlatGeobuf for optional building-footprint layers.

Network sources may be unavailable temporarily or require an internet connection. Saved census project data remains local and usable offline.

## Progressive Web App and Offline Support

Map My Block is configured as a Progressive Web App using `next-pwa` and Workbox.

The service worker supports:

- Cached application assets for faster repeat visits
- Cached OpenStreetMap tiles for previously viewed areas
- Cached fonts and static assets
- Offline access to saved local project data
- Service-worker update detection

Offline support does not mean new map tiles, GPS reverse-geocoding, search results, or Overpass data can be downloaded without internet. It means the existing app and saved map project remain usable when connectivity is unavailable.

## Sketch Generation

The sketch workflow uses OpenCV.js inside a dedicated Web Worker.

Using a Worker keeps image processing off the main UI thread, so the page remains responsive while preparing sketch-style map output. OpenCV.js is copied into the public build during installation/build and loaded only when the sketch feature is used.

## Privacy

The hackathon version is designed to work without requiring an account.

- No email, phone number, password, or Google account is required.
- Census project data is stored on the local device.
- Deleting/resetting a project clears its local project data.
- Future public releases may add optional Google sign-in and Supabase sync while retaining a local-first workflow.

## Run Locally

### Prerequisites

Install:

- Node.js 20 or later
- npm
- Git

### Clone and start

```bash
git clone https://github.com/archanaprabhat/map_my_block.git
cd map_my_block
npm install
npm run dev
