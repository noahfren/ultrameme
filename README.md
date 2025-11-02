# Ultra Marathon Route Planner

A Next.js application for planning ultra marathon routes (like the Taco Bell 50k) with Google Maps integration. Plan your routes with start points, end points, waypoints, and get real-time distance calculations.

## Features

- 🗺️ Interactive Google Maps display
- 📍 Location search with Google Places Autocomplete
- 🎯 Add unlimited waypoints to your route
- 🔄 Drag-and-drop waypoint reordering
- 📏 Total route distance calculation
- 📊 Distance between each waypoint segment
- 🚶 Walking/running route calculation using Google Directions API

## Prerequisites

- Node.js 20.9.0 or higher
- A Google Cloud Platform account with billing enabled
- Google Maps API key with the following APIs enabled:
  - Maps JavaScript API
  - Directions API
  - Places API

## Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Directions API
   - Places API
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. (Recommended) Restrict your API key:
   - For development: Add HTTP referrer restrictions (e.g., `localhost:3000/*`)
   - For production: Add your domain to referrer restrictions

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your actual Google Maps API key.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Set Start Point**: Search for and select your starting location
2. **Set End Point**: Search for and select your ending location (can be the same as start)
3. **Add Waypoints**: Search for locations to add as waypoints along your route
4. **Reorder Waypoints**: Drag and drop waypoints in the list to reorder them
5. **View Distances**: See total route distance and distances between segments
6. **Clear Route**: Clear all points to start a new route

## Next.js Concepts Used

This project demonstrates several Next.js fundamentals:

- **App Router**: Uses the modern `app/` directory structure (Next.js 13+)
- **Server vs Client Components**: 
  - `layout.tsx` and most components are server components by default
  - Components using hooks or browser APIs use `'use client'` directive
- **Environment Variables**: Uses `NEXT_PUBLIC_` prefix for client-side access
- **File-based Routing**: `app/page.tsx` automatically becomes the `/` route
- **Layouts**: `app/layout.tsx` wraps all pages with shared UI

## Project Structure

```
ultrameme/
├── app/
│   ├── layout.tsx          # Root layout with Google Maps script
│   ├── page.tsx            # Main route planner page
│   └── globals.css         # Global styles
├── components/
│   ├── MapView.tsx         # Google Maps component
│   ├── LocationSearch.tsx  # Address search with autocomplete
│   ├── WaypointList.tsx    # Drag-and-drop waypoint management
│   └── DistanceDisplay.tsx # Distance calculations display
├── hooks/
│   └── useRoutePlanner.ts  # Route planning state management
├── lib/
│   └── googleMaps.ts       # Google Maps API utilities
└── types/
    └── index.ts            # TypeScript type definitions
```

## Technologies

- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **@vis.gl/react-google-maps** - Google Maps React integration
- **@dnd-kit** - Drag-and-drop functionality
- **Google Maps APIs** - Maps, Directions, Places

## Build for Production

```bash
npm run build
npm start
```

## Notes

- The app uses Google Directions API with `mode=walking` as the closest approximation to running routes
- All distances are calculated using actual route paths, not straight-line distances
- Make sure your Google Cloud project has billing enabled to use the APIs

## License

MIT
