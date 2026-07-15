<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:product-deatils-to avoid hallucinations -->

Product Scope & Architecture Manual
**Project Name:** Map My Block (`map_my_block`)
**Target Audience:** Census 2027 Enumerators (Mobile-First / PWA Users)
**Core Purpose:** Help enumerators easily digitize and map their assigned census block areas without manual paper drawing or login requirements.

---

## 1. Core Problem & Solution
*   **The Problem:** Enumerators traditionally draw boundary maps manually on paper, which is inaccurate and time-consuming.
*   **The Solution:** A fast, lightweight PWA where they upload a layout map, align it over OpenStreetMap (OSM), draw a bounding polygon, and drop colored tags for every house/shop they visit. Finally, they export a highly accurate, scaled map image for their supervisors.

---

## 2. Product Workflow (Step-by-Step)

### Phase 1: Initial Setup & Boundary Definition
1.  **Welcome / Map Upload:** No login required. User uploads a layout map image.
2.  **Image Cropping:** User crops the image using `react-cropper` so only the relevant map area remains.
3.  **Location Permission:** App requests GPS access. Once granted, shows user's current location on a Leaflet map.
4.  **Layout Overlay & Alignment (The Core UI Task):**
    *   Full-screen Leaflet map with standard controls (`+`, `-`, `Locate Me` with tooltips).
    *   An "Add Layout Map" button brings the cropped image to the center of the screen as an interactive overlay.
    *   **Image Controls (Independent of Map):** Delete button, Rotate handle (free continuous rotation), Opacity slider, and Scale handles (pinch-to-zoom/drag resizing).
    *   **Accessibility Hint:** A highlighted blue border appears when the image overlay is selected/active for dragging.
5.  **Lock & Plot Boundary:**
    *   Once aligned over OSM data, the user clicks "Lock".
    *   User draws a continuous polyline boundary (using a library like Leaflet.draw).
    *   Includes a "Clear" option mid-way if they make a mistake.
6.  **Confirm Boundary:**
    *   Once closed and confirmed, all map areas outside this boundary polygon are grayed out.
    *   This setup is permanently saved in local storage (PWA persistent state).

### Phase 2: Active Enumeration Mode (Daily Use)
*   Every subsequent app open directly loads Phase 2.
*   The setup UI is hidden. Only `+`, `-`, `Locate Me`, and `Add Tag` buttons exist.
*   Bottom Navigation Tabs: 
    1. **Current Working Map** 
    2. **Profile** (Contains the option to "Delete Map & Reset Setup" with an "Are you sure?" alert prompt).

### Phase 3: Tagging Features (Data Collection)
*   Enumerator stands near a house -> Clicks `Locate Me` -> Clicks `Add Tag`.
*   Popup appears asking for **House Number** and **Category Type**.
*   **Categories & Colors:**
    *   House (Color A)
    *   Business (Color B)
    *   School (Color C)
    *   Others (Color D - allows custom text specification).
*   **Boundary Validation:** If a user drops a tag *outside* the confirmed boundary, trigger a prompt: *"This point is outside your boundary. Please edit your boundary or confirm if you are sure."*
*   **Editing Tags:** Clicking an existing square tag allows editing its details or deleting it.

### Phase 4: Final Export
*   An **Export** button captures the entire screen layer (OSM crowdsourced data + overlaid layout map + enumerator's custom square house tags).
*   Downloads as a high-quality scaled image ready for printing and supervisor submission.

---

## 3. Technology Stack & Rules
*   **Framework:** React with TypeScript (Lightweight build for PWA).
*   **Mapping Engine:** Leaflet engine with OpenStreetMap tiles (Support switching between Satellite, Street map, and Road map views).
*   **Core Packages:** `react-cropper` (for initial cropping), `leaflet-draw` (for polyline boundary).
*   **UI/UX:** Strictly Mobile-First, highly responsive, touch-friendly handles for scaling/rotating image overlays.

<!-- END:product-deatils-to avoid hallucinations -->