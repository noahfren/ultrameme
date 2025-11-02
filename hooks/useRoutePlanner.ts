'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Location, Waypoint, RouteSegment, RouteData } from '@/types';
import { calculateRoute, formatDistance } from '@/lib/googleMaps';
import { parseRouteFromUrl, hasRouteParam, updateRouteInUrl } from '@/lib/urlEncoding';

export function useRoutePlanner() {
    const [startPoint, setStartPoint] = useState<Location | null>(null);
    const [endPoint, setEndPoint] = useState<Location | null>(null);
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [routeData, setRouteData] = useState<RouteData | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasRouteInUrlRef = useRef(false);
    const isInitialLoadRef = useRef(true);

    // Calculate route whenever points change
    useEffect(() => {
        if (startPoint && endPoint) {
            calculateRouteData();
        } else {
            setRouteData(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startPoint, endPoint, waypoints]);

    const calculateRouteData = useCallback(async () => {
        if (!startPoint || !endPoint) return;

        setIsCalculating(true);
        setError(null);

        try {
            // Sort waypoints by order
            const sortedWaypoints = [...waypoints].sort((a, b) => a.order - b.order);
            const waypointLocations = sortedWaypoints.map(wp => wp.location);

            const directions = await calculateRoute(
                startPoint,
                endPoint,
                waypointLocations
            );

            // Calculate total distance and segments
            let totalDistance = 0;
            const segments: RouteSegment[] = [];

            // Google Directions API returns legs for each segment:
            // - No waypoints: 1 leg (start → end)
            // - N waypoints: N+1 legs (start → WP1, WP1 → WP2, ..., WPn → end)
            directions.routes[0].legs.forEach((leg, index) => {
                const distance = leg.distance.value;
                totalDistance += distance;

                let fromAddress: string;
                let toAddress: string;

                if (sortedWaypoints.length === 0) {
                    // No waypoints: single leg from start to end
                    fromAddress = startPoint.address;
                    toAddress = endPoint.address;
                } else if (index === 0) {
                    // First leg: start to first waypoint
                    fromAddress = startPoint.address;
                    toAddress = sortedWaypoints[0].location.address;
                } else if (index < sortedWaypoints.length) {
                    // Middle legs: between waypoints
                    fromAddress = sortedWaypoints[index - 1].location.address;
                    toAddress = sortedWaypoints[index].location.address;
                } else {
                    // Last leg: last waypoint to end
                    fromAddress = sortedWaypoints[sortedWaypoints.length - 1].location.address;
                    toAddress = endPoint.address;
                }

                segments.push({
                    from: fromAddress,
                    to: toAddress,
                    distance,
                });
            });

            setRouteData({
                totalDistance,
                segments,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to calculate route');
            setRouteData(null);
        } finally {
            setIsCalculating(false);
        }
    }, [startPoint, endPoint, waypoints]);

    const addWaypoint = useCallback((location: Location) => {
        const newWaypoint: Waypoint = {
            id: `waypoint-${Date.now()}-${Math.random()}`,
            location,
            order: waypoints.length,
        };
        setWaypoints(prev => [...prev, newWaypoint]);
    }, [waypoints.length]);

    const removeWaypoint = useCallback((id: string) => {
        setWaypoints(prev => {
            const filtered = prev.filter(wp => wp.id !== id);
            // Reorder remaining waypoints
            return filtered.map((wp, index) => ({ ...wp, order: index }));
        });
    }, []);

    const reorderWaypoints = useCallback((startIndex: number, endIndex: number) => {
        setWaypoints(prev => {
            const result = Array.from(prev);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            // Update order indices
            return result.map((wp, index) => ({ ...wp, order: index }));
        });
    }, []);

    const clearRoute = useCallback(() => {
        setStartPoint(null);
        setEndPoint(null);
        setWaypoints([]);
        setRouteData(null);
        setError(null);
    }, []);

    const loadRouteFromUrl = useCallback(() => {
        const route = parseRouteFromUrl();
        if (route) {
            setStartPoint(route.startPoint);
            setEndPoint(route.endPoint);
            setWaypoints(route.waypoints);
            hasRouteInUrlRef.current = true;
        } else {
            hasRouteInUrlRef.current = hasRouteParam();
        }
        // Mark initial load as complete after a brief delay to allow state updates
        setTimeout(() => {
            isInitialLoadRef.current = false;
        }, 0);
    }, []);

    // Load route from URL on mount
    useEffect(() => {
        loadRouteFromUrl();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update URL when route changes (only if route param was initially present)
    useEffect(() => {
        // Skip on initial load to avoid overwriting the URL immediately after loading
        if (isInitialLoadRef.current) return;

        // Only update URL if route param was initially present
        if (hasRouteInUrlRef.current) {
            updateRouteInUrl({
                startPoint,
                endPoint,
                waypoints,
            });
        }
    }, [startPoint, endPoint, waypoints]);

    return {
        startPoint,
        endPoint,
        waypoints,
        routeData,
        isCalculating,
        error,
        setStartPoint,
        setEndPoint,
        addWaypoint,
        removeWaypoint,
        reorderWaypoints,
        clearRoute,
        loadRouteFromUrl,
    };
}

