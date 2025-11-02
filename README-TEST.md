# Route Finder Test Script

This directory contains a test script for the route finding algorithm.

## Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Google Maps API Key:**
   - Create a `.env.local` file in the project root
   - Add your API key:
     ```
     NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
     ```

3. **Start the dev server:**
   ```bash
   npm run dev
   ```
   Keep this running in one terminal window.

## Running the Test

In a separate terminal window, run:

```bash
npm run test:route
```

Or directly with tsx:

```bash
npx tsx scripts/test-route-finder.ts
```

## What the Test Does

1. **Finds the starting Taco Bell:** Uses Google Places API to locate the Taco Bell at:
   - `8500 Lincoln Blvd, Los Angeles, CA 90045`

2. **Runs the route finder algorithm:**
   - Searches for nearby Taco Bells within 15 miles
   - Uses beam search to find optimal routes
   - Validates routes using Google Directions API
   - Finds a route with 8-10 Taco Bells totaling 30-34 miles

3. **Displays results:**
   - Lists all Taco Bells in the route
   - Shows total distance
   - Validates that distance is within target range

## Expected Output

The test will show:
- Progress updates as the algorithm runs
- Number of Taco Bells found
- API calls being made
- Routes being evaluated
- Final route with all locations and total distance

## Troubleshooting

**Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not found**
- Make sure you have a `.env.local` file with the API key set
- Or export it: `export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key`

**Error: Could not reach dev server**
- Make sure the dev server is running (`npm run dev`)
- Check that it's running on `http://localhost:3000`

**Route finder fails to find a route**
- The algorithm may not find enough Taco Bells in the area
- Try a different starting location by modifying `TEST_ADDRESS` in the script
- Check the console logs for detailed error messages

