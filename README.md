# Map My Block

A mobile-first PWA for Census 2027 enumerators to digitize and map their assigned block areas without manual paper drawing.

## Features

- **No Login Required** — Upload layout map, align with OpenStreetMap, and start mapping
- **Image Overlay & Alignment** — Crop, rotate, scale layout maps over live OSM tiles
- **Boundary Mapping** — Draw boundary polygons around your census block
- **Tagged Data Collection** — Drop color-coded tags for houses, businesses, schools, and other landmarks
- **Offline Support** — Saved maps work offline; auto-retries fetches when reconnected
- **Export Ready** — Download high-quality A4 map images for supervisor submission
- **Auto-Fetch Layers** — Automatically fetch building footprints and OSM road/water data

## Tech Stack

- **Framework**: Next.js 16 (React + TypeScript)
- **Mapping**: Leaflet with OpenStreetMap
- **Libraries**: react-cropper, leaflet-draw, localforage
- **PWA**: next-pwa with service worker
- **Storage**: IndexedDB + localStorage (persistent offline data)
- **Sketch**: OpenCV.js in Web Worker for vector map generation

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

### Build & Deploy

```bash
npm run build
npm run start
```

## Workflow

1. **Upload** — Load a layout map image of your block
2. **Crop** — Trim unnecessary areas using the built-in cropper
3. **Align** — Position the layout over OpenStreetMap using drag, rotate, and scale
4. **Boundary** — Draw a polygon around the block perimeter
5. **Tag** — Drop colored markers for each house, shop, school, etc.
6. **Export** — Download the final map as a high-resolution image

## Offline Behavior

- Saved project data persists in IndexedDB
- Maps remain accessible without internet
- Fetched data (buildings, roads) auto-retries when reconnected
- Service worker caches essential assets and tiles

## Browser Support

- Modern browsers with ES2020+ support
- Tested on iOS 14+ and Android Chrome
- Works best with GPS access for location alignment
