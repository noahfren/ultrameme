# Taco Bell 50K Route Planner

A Next.js application for planning ultra marathon routes (specifically the Taco Bell 50K challenge) that visit multiple Taco Bell locations. Plan your routes manually or use the automatic route generator to find optimal 50K loops visiting 8-10 Taco Bell locations.

## Features

- 🗺️ **Interactive Google Maps Display** - Visualize your route with markers and polylines
- 🚀 **Auto-Generate 50K Routes** - Automatically find optimal routes starting from any Taco Bell location
- 📍 **Location Search** - Search for locations using Google Places Autocomplete
- 🎯 **Manual Route Planning** - Add unlimited waypoints to your route
- 🔄 **Drag-and-Drop Reordering** - Reorder waypoints by dragging
- 📏 **Distance Calculations** - Total route distance and per-segment distances
- 🚶 **Walking/Running Routes** - Uses Google Directions API with walking mode
- 🔗 **Route Sharing** - Share routes via shareable URLs
- ✅ **Taco Bell Validation** - Validates that selected locations are actual Taco Bell restaurants

## Prerequisites

- Node.js 20.9.0 or higher
- A Google Cloud Platform account with billing enabled
- Google Maps API key with the following APIs enabled:
  - Maps JavaScript API
  - Directions API
  - Places API (for location search and Taco Bell validation)

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

### Manual Route Planning

1. **Set Start Point**: Search for and select your starting location
2. **Set End Point**: Search for and select your ending location (or check "End point same as start point" for a loop)
3. **Add Waypoints**: Search for locations to add as waypoints along your route
4. **Reorder Waypoints**: Drag and drop waypoints in the list to reorder them
5. **View Distances**: See total route distance and distances between segments
6. **Share Route**: Click "Share Route" to get a shareable URL
7. **Clear Route**: Clear all points to start a new route

### Auto-Generate 50K Route

1. Click the **"Auto-Generate 50K Route"** button
2. Search for and select a Taco Bell location as your starting point
3. Configure route parameters (optional):
   - Minimum Taco Bells (default: 8)
   - Maximum Taco Bells (default: 10)
4. Click "Generate Route" to automatically find an optimal 50K route
5. The algorithm will:
   - Search for nearby Taco Bell locations within a 15-mile radius
   - Generate route candidates visiting 8-10 Taco Bells
   - Score routes based on distance, loop closure, and segment spacing
   - Return the best route that's approximately 50 kilometers

## Project Structure

```
ultrameme/
├── app/
│   ├── api/
│   │   ├── directions/
│   │   │   └── route.ts          # Directions API proxy
│   │   └── places/
│   │       └── route.ts          # Places API proxy
│   ├── layout.tsx                # Root layout with Google Maps script
│   ├── page.tsx                  # Main route planner page
│   └── globals.css               # Global styles
├── components/
│   ├── AutoRoutePlannerModal.tsx # Auto route generation modal
│   ├── DistanceDisplay.tsx       # Distance calculations display
│   ├── LocationSearch.tsx        # Address search with autocomplete
│   ├── MapView.tsx               # Google Maps component
│   ├── ShareButton.tsx           # Route sharing functionality
│   └── WaypointList.tsx          # Drag-and-drop waypoint management
├── hooks/
│   └── useRoutePlanner.ts        # Route planning state management
├── lib/
│   ├── googleMaps.ts             # Google Maps API utilities
│   ├── routeFinder.ts            # Auto route generation algorithm
│   └── urlEncoding.ts            # URL encoding for route sharing
├── scripts/
│   └── test-route-finder.ts      # Test script for route finder
└── types/
    └── index.ts                  # TypeScript type definitions
```

## Technologies

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **@vis.gl/react-google-maps** - Google Maps React integration
- **@dnd-kit** - Drag-and-drop functionality
- **@mapbox/polyline** - Polyline encoding/decoding
- **Google Maps APIs** - Maps, Directions, Places

## API Routes

The application includes server-side API routes to proxy Google Maps API requests:

- **`/api/directions`** - Get route directions (GET)
  - Parameters: `origin`, `destination`, `waypoints` (optional), `mode` (default: walking)
- **`/api/places`** - Search places and get place details (GET)
  - Actions: `nearby` (search nearby places) or `details` (get place details)
  - Parameters vary by action

## Auto Route Generation

The auto route generation feature uses a sophisticated algorithm to find optimal 50K routes:

- **Search Strategy**: Finds Taco Bell locations within a 15-mile radius of the starting point
- **Route Optimization**: Generates multiple route candidates and scores them based on:
  - Distance closeness to 50km target
  - Loop closure (how close start and end points are)
  - Segment spacing variance (even distribution of segments)
- **Distance Calculation**: Accounts for the fact that road distance is typically 15-20% longer than straight-line distance
- **Target Range**: Routes between 50km and 55km (accounting for road distance multiplier)

## Next.js Concepts Used

This project demonstrates several Next.js fundamentals:

- **App Router**: Uses the modern `app/` directory structure (Next.js 13+)
- **Server vs Client Components**: 
  - API routes are server components
  - Components using hooks or browser APIs use `'use client'` directive
- **Environment Variables**: Uses `NEXT_PUBLIC_` prefix for client-side access
- **File-based Routing**: `app/page.tsx` automatically becomes the `/` route
- **Layouts**: `app/layout.tsx` wraps all pages with shared UI
- **API Routes**: Server-side API routes for proxying external API calls

## Build for Production

```bash
npm run build
npm start
```

## Testing

Run the route finder test script:

```bash
npm run test:route
```

## Notes

- The app uses Google Directions API with `mode=walking` as the closest approximation to running routes
- All distances are calculated using actual route paths, not straight-line distances
- Make sure your Google Cloud project has billing enabled to use the APIs
- The auto route generation feature can make many API calls; monitor your usage
- Route sharing uses URL encoding to store route data in the URL query parameters

## License

MIT