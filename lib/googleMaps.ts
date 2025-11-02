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

    const response = await fetch(url);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Directions API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
        throw new Error(`Directions API returned status: ${data.status}`);
    }

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

