'use client';

import { useMemo, useEffect, useRef } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Location, Waypoint } from '@/types';

interface MapViewProps {
    startPoint: Location | null;
    endPoint: Location | null;
    waypoints: Waypoint[];
}

// Component to handle DirectionsRenderer inside the Map
function DirectionsRenderer({
    startPoint,
    endPoint,
    waypoints,
}: {
    startPoint: Location | null;
    endPoint: Location | null;
    waypoints: Waypoint[];
}) {
    const map = useMap();
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
    const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);

    // Type guard for google.maps
    const getGoogleMaps = () => {
        if (typeof window !== 'undefined' && window.google?.maps) {
            return window.google.maps;
        }
        return null;
    };

    useEffect(() => {
        if (!map) return;

        const googleMaps = getGoogleMaps();
        if (!googleMaps) {
            console.warn('Google Maps API not loaded yet');
            return;
        }

        // Initialize DirectionsService and DirectionsRenderer
        if (!directionsServiceRef.current) {
            directionsServiceRef.current = new googleMaps.DirectionsService();
        }
        if (!directionsRendererRef.current) {
            directionsRendererRef.current = new googleMaps.DirectionsRenderer({
                suppressMarkers: true, // We'll use our own markers
                preserveViewport: false,
            });
            directionsRendererRef.current.setMap(map);
        }

        const service = directionsServiceRef.current;
        const renderer = directionsRendererRef.current;

        // Ensure renderer is attached to map
        if (renderer.getMap() !== map) {
            renderer.setMap(map);
        }

        // Calculate route if we have start and end points
        if (!startPoint || !endPoint) {
            // Don't calculate route, but keep renderer attached (will show nothing)
            return;
        }

        // Sort waypoints by order
        const sortedWaypoints = [...waypoints].sort((a, b) => a.order - b.order);

        const request: google.maps.DirectionsRequest = {
            origin: { lat: startPoint.lat, lng: startPoint.lng },
            destination: { lat: endPoint.lat, lng: endPoint.lng },
            travelMode: googleMaps.TravelMode.WALKING,
            waypoints: sortedWaypoints.length > 0
                ? sortedWaypoints.map(wp => ({
                    location: { lat: wp.location.lat, lng: wp.location.lng },
                    stopover: true,
                }))
                : undefined,
        };

        service.route(request, (result, status) => {
            if (status === googleMaps.DirectionsStatus.OK && result) {
                renderer.setDirections(result);
            } else {
                console.error('Directions request failed:', status);
                // On error, we don't call setDirections - the renderer will keep previous directions
                // To truly clear, we could recreate the renderer, but that's not necessary
            }
        });

        // No cleanup needed - we keep the renderer instance for reuse
    }, [map, startPoint, endPoint, waypoints]);

    return null; // This component doesn't render anything
}

export default function MapView({
    startPoint,
    endPoint,
    waypoints,
}: MapViewProps) {
    // Calculate map center and zoom based on all points
    const mapCenter = useMemo(() => {
        const allPoints: Location[] = [];
        if (startPoint) allPoints.push(startPoint);
        if (endPoint) allPoints.push(endPoint);
        waypoints.forEach(wp => allPoints.push(wp.location));

        if (allPoints.length === 0) {
            return { lat: 37.7749, lng: -122.4194 }; // Default: San Francisco
        }

        // Calculate center of all points
        const avgLat = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
        const avgLng = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;
        return { lat: avgLat, lng: avgLng };
    }, [startPoint, endPoint, waypoints]);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <p style={{ color: '#ef1897' }}>Google Maps API key is not configured</p>
            </div>
        );
    }

    // Advanced Markers require a Map ID. Use provided ID or default to DEMO_MAP_ID for testing
    // For production, create your own Map ID at: https://console.cloud.google.com/google/maps-apis/studio/maps
    // Add it to your .env.local file as: NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your_map_id_here
    const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

    return (
        <div className="w-full h-full">
            <Map
                defaultCenter={mapCenter}
                defaultZoom={12}
                mapId={mapId}
                gestureHandling="greedy"
                disableDefaultUI={false}
            >
                {/* DirectionsRenderer for route display */}
                <DirectionsRenderer
                    startPoint={startPoint}
                    endPoint={endPoint}
                    waypoints={waypoints}
                />

                {/* Start point marker (green) */}
                {startPoint && (
                    <AdvancedMarker
                        position={startPoint}
                        title="Start"
                    >
                        <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center" style={{ backgroundColor: '#fee012' }}>
                            <span className="text-black text-xs font-bold">S</span>
                        </div>
                    </AdvancedMarker>
                )}

                {/* End point marker (red) */}
                {endPoint && (
                    <AdvancedMarker
                        position={endPoint}
                        title="End"
                    >
                        <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center" style={{ backgroundColor: '#ef1897' }}>
                            <span className="text-white text-xs font-bold">E</span>
                        </div>
                    </AdvancedMarker>
                )}

                {/* Waypoint markers (blue) */}
                {waypoints.map((waypoint) => (
                    <AdvancedMarker
                        key={waypoint.id}
                        position={waypoint.location}
                        title={`Waypoint ${waypoint.order + 1}`}
                    >
                        <div className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center" style={{ backgroundColor: '#a77bca' }}>
                            <span className="text-white text-xs font-bold">{waypoint.order + 1}</span>
                        </div>
                    </AdvancedMarker>
                ))}
            </Map>
        </div>
    );
}
