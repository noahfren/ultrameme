import { Location } from '@/types';

export interface DirectionsRequest {
    origin: Location;
    destination: Location;
    waypoints?: Location[];
    travelMode: google.maps.TravelMode;
}

export interface DirectionsResponse {
    routes: Array<{
        legs: Array<{
            distance: {
                value: number; // meters
                text: string; // formatted string
            };
        }>;
        overview_polyline: {
            points: string; // encoded polyline
        };
    }>;
    status: google.maps.DirectionsStatus;
}

/**
 * Calculate route using Google Directions API
 */
export async function calculateRoute(
    origin: Location,
    destination: Location,
    waypoints: Location[] = []
): Promise<DirectionsResponse> {
    console.log('[DirectionsAPI] Calculating route:', {
        origin: `${origin.lat.toFixed(6)}, ${origin.lng.toFixed(6)}`,
        destination: `${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}`,
        waypointCount: waypoints.length,
    });

    // Build waypoints string
    const waypointParams = waypoints.length > 0
        ? waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')
        : '';

    // Build query parameters
    const params = new URLSearchParams({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'walking',
    });

    if (waypointParams) {
        params.append('waypoints', waypointParams);
    }

    // Call our Next.js API route instead of Google directly to avoid CORS issues
    const url = `/api/directions?${params.toString()}`;
    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const error = errorData.error || `Directions API error: ${response.statusText}`;
        console.error('[DirectionsAPI] Request failed:', error);
        throw new Error(error);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
        console.error(`[DirectionsAPI] API returned status: ${data.status}`);
        throw new Error(`Directions API returned status: ${data.status}`);
    }

    const totalDistance = data.routes?.[0]?.legs?.reduce(
        (sum: number, leg: any) => sum + leg.distance.value,
        0
    ) || 0;

    console.log(`[DirectionsAPI] Route calculated in ${duration}ms: ${(totalDistance / 1609.34).toFixed(2)} miles`);

    return data;
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
    return meters * 0.000621371;
}

/**
 * Format distance in miles with 1 decimal place
 */
export function formatDistance(meters: number): string {
    const miles = metersToMiles(meters);
    return `${miles.toFixed(1)} miles`;
}

/**
 * Search for nearby places using Google Places API
 */
export async function searchNearbyPlaces(
    center: Location,
    radiusMeters: number,
    keyword: string = 'Taco Bell'
): Promise<Array<{
    place_id: string;
    name: string;
    formatted_address?: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
    types?: string[];
}>> {
    console.log('[PlacesAPI] Searching nearby places:', {
        center: `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`,
        radiusMeters: Math.round(radiusMeters),
        keyword,
    });

    const params = new URLSearchParams({
        action: 'nearby',
        location: `${center.lat},${center.lng}`,
        radius: radiusMeters.toString(),
    });

    const url = `/api/places?${params.toString()}`;
    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const error = errorData.error || `Places API error: ${response.statusText}`;
        console.error('[PlacesAPI] Nearby search failed:', error);
        throw new Error(error);
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
        console.log(`[PlacesAPI] Nearby search completed in ${duration}ms: ZERO_RESULTS`);
        return [];
    }

    if (data.status !== 'OK') {
        console.error(`[PlacesAPI] Nearby search failed with status: ${data.status}`);
        throw new Error(`Places API returned status: ${data.status}`);
    }

    const results = data.results || [];
    console.log(`[PlacesAPI] Nearby search completed in ${duration}ms: Found ${results.length} results`);
    return results;
}

/**
 * Get detailed information about a place
 */
export async function getPlaceDetails(placeId: string): Promise<{
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
    types?: string[];
}> {
    const params = new URLSearchParams({
        action: 'details',
        placeId: placeId,
    });

    const url = `/api/places?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Places API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
        throw new Error(`Places API returned status: ${data.status}`);
    }

    return data.result;
}

/**
 * Validate if a location is actually a Taco Bell
 */
export async function validateTacoBell(location: Location, placeId?: string): Promise<{
    isValid: boolean;
    tacoBell?: {
        placeId: string;
        name: string;
        address: string;
        lat: number;
        lng: number;
    };
}> {
    console.log('[PlacesAPI] Validating Taco Bell:', {
        location: `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`,
        address: location.address,
        placeId: placeId || 'none',
    });

    try {
        // If we have a place ID, use it to get details
        if (placeId) {
            console.log('[PlacesAPI] Using place ID to validate');
            const details = await getPlaceDetails(placeId);
            const isTacoBell = details.types?.some(type =>
                type.includes('restaurant') || type.includes('food')
            ) && (
                    details.name.toLowerCase().includes('taco bell') ||
                    details.name.toLowerCase().includes('tacobell')
                );

            console.log('[PlacesAPI] Place details validation:', {
                name: details.name,
                isTacoBell,
                types: details.types,
            });

            if (isTacoBell) {
                return {
                    isValid: true,
                    tacoBell: {
                        placeId: details.place_id,
                        name: details.name,
                        address: details.formatted_address,
                        lat: details.geometry.location.lat,
                        lng: details.geometry.location.lng,
                    },
                };
            }
        }

        // Otherwise, search nearby and see if we can find a matching Taco Bell
        console.log('[PlacesAPI] Searching nearby to validate');
        const nearby = await searchNearbyPlaces(location, 500); // 500m radius

        // Find the closest match
        for (const place of nearby) {
            const isTacoBell = place.types?.some(type =>
                type.includes('restaurant') || type.includes('food')
            ) && (
                    place.name.toLowerCase().includes('taco bell') ||
                    place.name.toLowerCase().includes('tacobell')
                );

            if (isTacoBell) {
                // Check if it's close enough (within 100m)
                const distance = haversineDistance(
                    location.lat,
                    location.lng,
                    place.geometry.location.lat,
                    place.geometry.location.lng
                );

                console.log('[PlacesAPI] Found nearby Taco Bell:', {
                    name: place.name,
                    distance: Math.round(distance),
                    withinRange: distance < 100,
                });

                if (distance < 100) {
                    return {
                        isValid: true,
                        tacoBell: {
                            placeId: place.place_id,
                            name: place.name,
                            address: place.formatted_address || place.name,
                            lat: place.geometry.location.lat,
                            lng: place.geometry.location.lng,
                        },
                    };
                }
            }
        }

        console.log('[PlacesAPI] Validation failed: Not a Taco Bell');
        return { isValid: false };
    } catch (error) {
        console.error('[PlacesAPI] Error validating Taco Bell:', error);
        return { isValid: false };
    }
}

/**
 * Calculate haversine distance between two points in meters
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

