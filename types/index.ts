export interface Location {
    lat: number;
    lng: number;
    address: string;
    name?: string; // Optional business/place name
}

export interface Waypoint {
    id: string;
    location: Location;
    order: number;
}

export interface RouteSegment {
    from: string;
    fromName?: string;
    to: string;
    toName?: string;
    distance: number; // in meters
}

export interface RouteData {
    totalDistance: number; // in meters
    segments: RouteSegment[];
}

export interface DirectionsResult {
    routes: Array<{
        legs: Array<{
            distance: {
                value: number; // in meters
            };
        }>;
        overview_polyline: {
            points: string; // encoded polyline
        };
    }>;
}

export interface TacoBellLocation extends Location {
    placeId: string;
    name: string;
}

export interface RouteSearchProgress {
    status: 'searching_tacobells' | 'validating' | 'finding_route' | 'complete' | 'error';
    tacoBellsFound?: number;
    apiCallsUsed?: number;
    routesEvaluated?: number;
    message: string;
}

export interface RouteFinderConfig {
    minDistanceMeters: number; // 50000 meters (50km hard minimum)
    maxDistanceMeters: number; // 55000 meters (~34 miles)
    minTacoBells: number; // 8
    maxTacoBells: number; // 10
    searchRadiusMiles: number; // 15
    maxApiCalls?: number; // optional limit
}

export interface RouteFinderResult {
    success: boolean;
    route?: TacoBellLocation[];
    totalDistance?: number; // in meters
    error?: string;
}

