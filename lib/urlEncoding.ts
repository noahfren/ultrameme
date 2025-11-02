import { Location, Waypoint } from '@/types';

export interface ShareableRoute {
  startPoint: Location | null;
  endPoint: Location | null;
  waypoints: Waypoint[];
}

/**
 * Encodes route data into a URL-safe string
 */
export function encodeRoute(route: ShareableRoute): string {
  try {
    const data = JSON.stringify({
      start: route.startPoint,
      end: route.endPoint,
      waypoints: route.waypoints.map(wp => ({
        location: wp.location,
        order: wp.order,
      })),
    });
    // Use base64 encoding and make it URL-safe
    const base64 = btoa(encodeURIComponent(data));
    // Replace URL-unsafe characters with URL-safe alternatives
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (error) {
    console.error('Failed to encode route:', error);
    return '';
  }
}

/**
 * Decodes a URL-safe string back into route data
 */
export function decodeRoute(encoded: string): ShareableRoute | null {
  try {
    // Restore URL-unsafe characters before decoding
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    const decoded = decodeURIComponent(atob(base64));
    const data = JSON.parse(decoded);
    
    // Validate and reconstruct waypoints with IDs
    const waypoints: Waypoint[] = (data.waypoints || []).map((wp: any, index: number) => ({
      id: `waypoint-${Date.now()}-${index}-${Math.random()}`,
      location: wp.location,
      order: wp.order ?? index,
    }));

    return {
      startPoint: data.start || null,
      endPoint: data.end || null,
      waypoints,
    };
  } catch (error) {
    console.error('Failed to decode route:', error);
    return null;
  }
}

/**
 * Gets the shareable URL for the current route
 */
export function getShareableUrl(route: ShareableRoute): string {
  const encoded = encodeRoute(route);
  if (!encoded) return window.location.href.split('?')[0];
  
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?route=${encoded}`;
}

/**
 * Parses route data from URL parameters
 */
export function parseRouteFromUrl(): ShareableRoute | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const routeParam = params.get('route');
  
  if (!routeParam) return null;
  
  return decodeRoute(routeParam);
}

/**
 * Checks if a route query parameter is present in the URL
 */
export function hasRouteParam(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('route');
}

/**
 * Updates the URL with the current route (without reloading the page)
 */
export function updateRouteInUrl(route: ShareableRoute): void {
  if (typeof window === 'undefined') return;
  
  const encoded = encodeRoute(route);
  const url = new URL(window.location.href);
  
  if (encoded) {
    url.searchParams.set('route', encoded);
  } else {
    url.searchParams.delete('route');
  }
  
  // Use replaceState to avoid adding a new history entry
  window.history.replaceState({}, '', url.toString());
}

