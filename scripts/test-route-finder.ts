/**
 * Test script for route finding algorithm
 * 
 * Usage:
 *   1. Start the dev server: npm run dev (in one terminal)
 *   2. Run the test: npm run test:route (in another terminal)
 * 
 * Or run directly with tsx:
 *   npx tsx scripts/test-route-finder.ts
 * 
 * Note: Make sure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in your environment
 *       The script will load it from .env.local if it exists
 */

// Load environment variables from .env.local if it exists
try {
    const { config } = require('dotenv');
    const { resolve } = require('path');
    config({ path: resolve(process.cwd(), '.env.local') });
} catch (e) {
    // dotenv not installed, skip loading .env.local
    // Environment variables should be set manually
}

// Polyfill fetch for older Node versions (< 18)
if (typeof global.fetch === 'undefined') {
    try {
        // Try to use node-fetch if available
        const nodeFetch = require('node-fetch');
        global.fetch = nodeFetch;
        global.Headers = nodeFetch.Headers;
        global.Request = nodeFetch.Request;
        global.Response = nodeFetch.Response;
    } catch (e) {
        // If node-fetch is not available, try to use undici (Node 18+)
        try {
            const { fetch, Headers, Request, Response } = require('undici');
            global.fetch = fetch;
            global.Headers = Headers;
            global.Request = Request;
            global.Response = Response;
        } catch (e2) {
            throw new Error('fetch is not available. Please install node-fetch or upgrade to Node 18+');
        }
    }
}

import { TacoBellLocation, RouteSearchProgress } from '../types';

// Test address: 8500 Lincoln Blvd, Los Angeles, CA 90045
const TEST_ADDRESS = '8500 Lincoln Blvd, Los Angeles, CA 90045';
const USE_DEV_SERVER = process.env.USE_DEV_SERVER === 'true';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Find a Taco Bell by address using Google Places API
 */
async function findTacoBellByAddress(address: string): Promise<TacoBellLocation | null> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        throw new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable is required');
    }

    console.log(`\n🔍 Searching for Taco Bell at: ${address}\n`);

    // Use Places API text search to find the Taco Bell
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`Taco Bell ${address}`)}&key=${apiKey}`;

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
        throw new Error(`Places API search failed: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API returned status: ${searchData.status}`);
    }

    if (!searchData.results || searchData.results.length === 0) {
        console.error('❌ No Taco Bell found at that address');
        return null;
    }

    // Find the best match (should be a Taco Bell)
    const place = searchData.results.find((p: any) =>
        p.name.toLowerCase().includes('taco bell') ||
        p.name.toLowerCase().includes('tacobell')
    ) || searchData.results[0];

    console.log(`✅ Found: ${place.name}`);
    console.log(`   Address: ${place.formatted_address}`);
    console.log(`   Location: ${place.geometry.location.lat}, ${place.geometry.location.lng}\n`);

    return {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        address: place.formatted_address,
        placeId: place.place_id,
        name: place.name,
    };
}

/**
 * Patch fetch to work with absolute URLs in Node.js context
 * The route finder uses relative URLs like /api/places, so we need to
 * intercept those and add the base URL
 */
function setupFetchForNode() {
    const originalFetch = global.fetch;
    const baseUrl = BASE_URL;

    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        let url: string;

        if (typeof input === 'string') {
            url = input;
        } else if (input instanceof URL) {
            url = input.href;
        } else if (input instanceof Request) {
            url = input.url;
        } else {
            url = String(input);
        }

        // If it's a relative URL, make it absolute
        if (url.startsWith('/')) {
            url = `${baseUrl}${url}`;
        }

        // Reconstruct the request with the absolute URL
        if (typeof input === 'string') {
            return originalFetch(url, init);
        } else if (input instanceof URL) {
            return originalFetch(new URL(url), init);
        } else if (input instanceof Request) {
            // Create a new Request with the modified URL but preserve other properties
            return originalFetch(new Request(url, {
                method: input.method,
                headers: input.headers,
                body: input.body,
                cache: input.cache,
                credentials: input.credentials,
                integrity: input.integrity,
                keepalive: input.keepalive,
                mode: input.mode,
                redirect: input.redirect,
                referrer: input.referrer,
                referrerPolicy: input.referrerPolicy,
                signal: input.signal,
                ...init, // Allow init to override
            }));
        } else {
            return originalFetch(url, init);
        }
    };
}

/**
 * Create a route finder that works in Node.js context
 */
async function createRouteFinder() {
    // Setup fetch to handle relative URLs
    setupFetchForNode();

    // Import and return the route finder
    const { findOptimalRoute } = await import('../lib/routeFinder');
    return findOptimalRoute;
}

/**
 * Run the test
 */
async function runTest() {
    console.log('🧪 Starting Route Finder Test\n');
    console.log('='.repeat(60));

    // Check for API key
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        console.error('❌ Error: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable is required');
        console.error('\nPlease set it in your .env.local file or export it:\n');
        console.error('   export NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here\n');
        console.error('Or add it to .env.local:\n');
        console.error('   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here\n');
        process.exit(1);
    }

    // Check if dev server is reachable (if using dev server mode)
    if (USE_DEV_SERVER || !USE_DEV_SERVER) { // Always check since we're using relative URLs
        try {
            const healthCheck = await fetch(`${BASE_URL}/api/places?action=nearby&location=0,0&radius=1000`);
            // Even if it fails, we'll continue (might be auth issue)
        } catch (error) {
            console.log('⚠️  Warning: Could not reach dev server at', BASE_URL);
            console.log('   Make sure the dev server is running: npm run dev\n');
        }
    }

    try {
        // Step 1: Find the Taco Bell location
        const startTacoBell = await findTacoBellByAddress(TEST_ADDRESS);

        if (!startTacoBell) {
            console.error('❌ Could not find starting Taco Bell location');
            process.exit(1);
        }

        // Step 2: Get the route finder function
        const findOptimalRoute = await createRouteFinder();

        // Step 3: Run the route finder
        console.log('🚀 Starting route finder algorithm...\n');
        console.log('   (This may take a few minutes depending on API rate limits)\n');

        let progressCount = 0;
        const result = await findOptimalRoute(
            startTacoBell,
            undefined, // Use default config
            (progress: RouteSearchProgress) => {
                progressCount++;
                console.log(`\n[Progress ${progressCount}] ${progress.status}: ${progress.message}`);

                if (progress.tacoBellsFound !== undefined) {
                    console.log(`   📍 Taco Bells found: ${progress.tacoBellsFound}`);
                }
                if (progress.apiCallsUsed !== undefined) {
                    console.log(`   📞 API calls used: ${progress.apiCallsUsed}`);
                }
                if (progress.routesEvaluated !== undefined) {
                    console.log(`   🔄 Routes evaluated: ${progress.routesEvaluated}`);
                }
            }
        );

        // Step 4: Display results
        console.log('\n' + '='.repeat(60));

        if (result.success && result.route) {
            console.log('\n✅ SUCCESS! Route found!\n');
            console.log(`📍 Route includes ${result.route.length} Taco Bells:\n`);
            result.route.forEach((tb, index) => {
                console.log(`   ${index + 1}. ${tb.name}`);
                console.log(`      ${tb.address}`);
                console.log(`      Coordinates: ${tb.lat.toFixed(6)}, ${tb.lng.toFixed(6)}\n`);
            });
            console.log(`📏 Total distance: ${result.totalDistance ? (result.totalDistance / 1609.34).toFixed(2) : 'N/A'} miles`);
            console.log(`   (${result.totalDistance ? Math.round(result.totalDistance) : 'N/A'} meters)`);

            // Validate distance is within constraints
            const distanceMiles = result.totalDistance ? result.totalDistance / 1609.34 : 0;
            if (distanceMiles >= 30 && distanceMiles <= 34) {
                console.log(`\n✅ Distance is within target range (30-34 miles)!`);
            } else {
                console.log(`\n⚠️  Distance is outside target range (30-34 miles)`);
            }
        } else {
            console.log('\n❌ Route finder failed:', result.error || 'Unknown error');
            process.exit(1);
        }

        console.log('\n✅ Test completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(error instanceof Error ? error.message : error);
        if (error instanceof Error && error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run the test
runTest();

