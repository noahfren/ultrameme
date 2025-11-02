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

