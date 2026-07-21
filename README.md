# Map My Block

A mobile-first PWA for Census 2027 enumerators to digitize and map their assigned block areas without manual paper drawing.

- No login for the current hackathon release.
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


## OpenAI Tools Used

This project was built using OpenAI tools throughout the development process.

### Codex

I used **OpenAI Codex** to build the project from start to finish. I described the features and requirements, and Codex helped implement them, generate code, refactor components, fix bugs, and iterate quickly while I guided the overall product and technical decisions.

### GPT-5.6

I used **GPT-5.6** as a research and planning assistant. It helped me compare libraries, choose the right technologies for the project, understand concepts like PWAs and service workers, solve implementation issues, and improve the project documentation throughout development.

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
