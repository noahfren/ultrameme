export interface Location {
    lat: number;
    lng: number;
    address: string;
}

export interface Waypoint {
    id: string;
    location: Location;
    order: number;
}

export interface RouteSegment {
    from: string;
    to: string;
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
    minDistanceMeters: number; // 48280 meters (30 miles)
    maxDistanceMeters: number; // 54717 meters (34 miles)
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

