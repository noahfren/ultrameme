import { TacoBellLocation, RouteSearchProgress, RouteFinderConfig, RouteFinderResult } from '@/types';
import { Location } from '@/types';
import { searchNearbyPlaces, calculateRoute, haversineDistance, extractAddressFromPlace, getPlaceDetails } from './googleMaps';

const DEFAULT_CONFIG: RouteFinderConfig = {
    minDistanceMeters: 50000, // 50km hard minimum
    maxDistanceMeters: 55000, // ~34 miles (account for road distance being ~15-20% longer than Haversine)
    minTacoBells: 8,
    maxTacoBells: 10,
    searchRadiusMiles: 15,
};

interface RouteCandidate {
    stops: TacoBellLocation[];
    totalDistance: number; // in meters (Haversine)
    score: number;
}

/**
 * Calculate total Haversine distance for a route (including return to start)
 */
function routeDistance(route: TacoBellLocation[]): number {
    if (route.length < 2) return 0;

    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
        total += haversineDistance(
            route[i].lat,
            route[i].lng,
            route[i + 1].lat,
            route[i + 1].lng
        );
    }
    return total;
}

/**
 * Calculate loop closure penalty (distance between start and end)
 * Returns distance in meters
 */
function loopnessPenalty(route: TacoBellLocation[]): number {
    if (route.length < 2) return Infinity;
    const start = route[0];
    const end = route[route.length - 1];
    return haversineDistance(start.lat, start.lng, end.lat, end.lng);
}

/**
 * Calculate segment spacing variance to measure how evenly distributed segments are
 * Returns coefficient of variation (CV) which is normalized standard deviation
 * Lower CV means more evenly spaced segments
 */
function calculateSegmentSpacingVariance(route: TacoBellLocation[]): number {
    if (route.length < 2) return Infinity;

    const segmentDistances: number[] = [];

    // Calculate distance for each segment
    for (let i = 0; i < route.length - 1; i++) {
        const distance = haversineDistance(
            route[i].lat,
            route[i].lng,
            route[i + 1].lat,
            route[i + 1].lng
        );
        segmentDistances.push(distance);
    }

    if (segmentDistances.length === 0) return Infinity;

    // Calculate mean
    const mean = segmentDistances.reduce((sum, d) => sum + d, 0) / segmentDistances.length;

    // Calculate variance
    const variance = segmentDistances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / segmentDistances.length;

    // Calculate standard deviation
    const stdDev = Math.sqrt(variance);

    // Return coefficient of variation (CV) - normalized measure of variability
    // CV = stdDev / mean (multiply by 1000 to convert to km scale for scoring)
    return mean > 0 ? (stdDev / mean) * 1000 : Infinity;
}

/**
 * Score a route based on:
 * 1. Distance closeness to target (accounting for road distance multiplier)
 * 2. Loop closure penalty (how close start and end are)
 * 3. Segment spacing variance (how evenly distributed segments are)
 * 
 * Note: Actual road distance is typically 15-20% longer than Haversine distance,
 * so we target a lower Haversine distance to account for this.
 */
function scoreRoute(
    route: TacoBellLocation[],
    targetRoadKm: number = 50,
    loopPenaltyWeight: number = 0.5,
    spacingVarianceWeight: number = 0.3,
    roadDistanceMultiplier: number = 1.18 // Haversine to road distance ratio
): { totalDistance: number; score: number } {
    const haversineDist = routeDistance(route);
    const haversineKm = haversineDist / 1000;

    // Estimate actual road distance from Haversine
    const estimatedRoadKm = haversineKm * roadDistanceMultiplier;

    // Distance penalty: how far from target road distance
    const distanceDiff = Math.abs(estimatedRoadKm - targetRoadKm);

    // Loop closure penalty (in km)
    const loopPenalty = loopnessPenalty(route) / 1000;

    // Segment spacing variance penalty (measures unevenness)
    const spacingVariance = calculateSegmentSpacingVariance(route);

    // Combined score (lower is better)
    const score = distanceDiff + loopPenaltyWeight * loopPenalty + spacingVarianceWeight * spacingVariance;

    return { totalDistance: haversineDist, score };
}

/**
 * Generate candidate routes using greedy nearest-neighbor with randomization
 * Uses diversity to avoid getting stuck in local optima
 */
function generateCandidateRoutes(
    start: TacoBellLocation,
    allTacoBells: TacoBellLocation[],
    targetKm: number = 50,
    nStops: number = 9,
    iterations: number = 200
): RouteCandidate[] {
    // Filter Taco Bells within 15 miles (~24.14 km)
    const nearby = allTacoBells.filter(
        (tb) => {
            const distance = haversineDistance(start.lat, start.lng, tb.lat, tb.lng);
            return distance <= 24140 && tb.placeId !== start.placeId;
        }
    );

    if (nearby.length < nStops - 1) {
        throw new Error(`Not enough Taco Bells nearby! Found ${nearby.length}, need at least ${nStops - 1}`);
    }

    const routes: RouteCandidate[] = [];
    const seenRoutes = new Set<string>(); // Track route signatures to avoid duplicates

    // Generate multiple candidate routes with randomization
    for (let iter = 0; iter < iterations; iter++) {
        // Shuffle nearby Taco Bells for randomization
        const shuffled = [...nearby].sort(() => Math.random() - 0.5);
        const route: TacoBellLocation[] = [start];

        // Greedy nearest-neighbor with segment balance consideration
        // Prefers candidates that keep segments evenly spaced
        while (route.length < nStops) {
            const last = route[route.length - 1];

            // Estimate target average segment distance
            // Target ~50km total road distance, with ~1.18 multiplier for Haversine to road
            // So target Haversine distance is ~50/1.18 ≈ 42.4km
            // But be more conservative to avoid routes that are too long
            const targetTotalHaversineKm = targetKm / 1.18 * 0.9; // Use 90% to be conservative
            const targetAvgSegmentKm = targetTotalHaversineKm / nStops;
            const targetAvgSegmentM = targetAvgSegmentKm * 1000;

            // Calculate current average segment distance
            let currentAvgSegmentM = targetAvgSegmentM; // Default to target if no segments yet
            if (route.length > 1) {
                const totalSoFar = routeDistance(route);
                currentAvgSegmentM = totalSoFar / (route.length - 1);
            }

            // Find all candidate distances with balance scores
            const candidates: { tb: TacoBellLocation; distance: number; balanceScore: number }[] = [];

            for (const candidate of shuffled) {
                // Skip if already in route
                if (route.some(tb => tb.placeId === candidate.placeId)) {
                    continue;
                }

                const distance = haversineDistance(
                    last.lat,
                    last.lng,
                    candidate.lat,
                    candidate.lng
                );

                // Balance score: how close this distance is to target average
                // Lower score is better (closer to target)
                const balanceScore = Math.abs(distance - targetAvgSegmentM);

                candidates.push({ tb: candidate, distance, balanceScore });
            }

            if (candidates.length === 0) break; // No more candidates

            // Sort by distance (for nearest-neighbor fallback)
            candidates.sort((a, b) => a.distance - b.distance);

            // Calculate combined score: prioritize distance, then balance
            // Weight: 70% pure distance (for efficiency), 30% balance (even spacing)
            candidates.forEach(c => {
                const normalizedBalance = c.balanceScore / targetAvgSegmentM; // Normalize
                const normalizedDistance = c.distance / targetAvgSegmentM; // Normalize
                c.balanceScore = 0.7 * normalizedDistance + 0.3 * normalizedBalance;
            });

            // Sort by combined score
            candidates.sort((a, b) => a.balanceScore - b.balanceScore);

            // 70% of the time pick best balance, 30% pick from top 3 for diversity
            let selected: { tb: TacoBellLocation; distance: number; balanceScore: number };
            if (Math.random() < 0.7 || candidates.length === 1) {
                selected = candidates[0];
            } else {
                const topK = Math.min(3, candidates.length);
                const randomIndex = Math.floor(Math.random() * topK);
                selected = candidates[randomIndex];
            }

            route.push(selected.tb);
        }

        // Close the loop by returning to start
        if (route.length > 1 && route[route.length - 1].placeId !== start.placeId) {
            route.push(start);
        }

        // Create a signature for this route to avoid exact duplicates
        const routeSignature = route.slice(1, -1)
            .map(tb => tb.placeId)
            .sort()
            .join(',');

        if (seenRoutes.has(routeSignature)) {
            continue; // Skip duplicate routes
        }
        seenRoutes.add(routeSignature);

        // Filter out routes that are already too long before scoring
        // Account for road distance multiplier (~1.18x)
        const haversineDist = routeDistance(route);
        const estimatedRoadKm = (haversineDist / 1000) * 1.18;

        // Skip routes that are already too long
        if (estimatedRoadKm > targetKm * 1.1) { // Allow 10% tolerance
            continue;
        }

        // Score the route
        // Reduce spacing variance weight to prioritize distance
        const { totalDistance, score } = scoreRoute(route, targetKm, 0.5, 0.2);

        routes.push({
            stops: route,
            totalDistance,
            score,
        });
    }

    // Sort by score (lower is better) and return top candidates
    return routes.sort((a, b) => a.score - b.score);
}

/**
 * Find Taco Bell locations within radius
 */
async function findTacoBells(
    center: Location,
    radiusMiles: number,
    onProgress?: (progress: RouteSearchProgress) => void
): Promise<TacoBellLocation[]> {
    const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters

    console.log('[RouteFinder] Searching for Taco Bells:', {
        center: `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`,
        radiusMiles,
        radiusMeters: Math.round(radiusMeters),
    });

    if (onProgress) {
        onProgress({
            status: 'searching_tacobells',
            message: 'Searching for nearby Taco Bells...',
        });
    }

    const places = await searchNearbyPlaces(center, radiusMeters, 'Taco Bell');
    console.log('[RouteFinder] Places API returned', places.length, 'results');

    // Filter and convert to TacoBellLocation
    const tacoBells: TacoBellLocation[] = [];

    for (const place of places) {
        // Validate it's actually a Taco Bell
        const isTacoBell = place.types?.some(type =>
            type.includes('restaurant') || type.includes('food')
        ) && (
                place.name.toLowerCase().includes('taco bell') ||
                place.name.toLowerCase().includes('tacobell')
            );

        if (isTacoBell && place.geometry?.location) {
            try {
                // Fetch full place details to get proper address information
                const placeDetails = await getPlaceDetails(place.place_id);

                // Extract clean address (without business name duplication)
                // Only use street address from address_components
                const address = extractAddressFromPlace({
                    name: placeDetails.name,
                    formatted_address: placeDetails.formatted_address,
                    vicinity: placeDetails.vicinity,
                    address_components: placeDetails.address_components,
                });

                // Ensure we never use the name as address - if address extraction fails, use empty string
                const finalAddress = (address && address.trim() && address !== placeDetails.name)
                    ? address.trim()
                    : '';

                console.log('[RouteFinder] Taco Bell address extraction:', {
                    name: placeDetails.name,
                    extractedAddress: address,
                    finalAddress: finalAddress,
                    hasAddressComponents: !!placeDetails.address_components,
                    addressComponentsCount: placeDetails.address_components?.length || 0,
                });

                tacoBells.push({
                    lat: placeDetails.geometry.location.lat,
                    lng: placeDetails.geometry.location.lng,
                    address: finalAddress, // Only street address, never the business name
                    placeId: placeDetails.place_id,
                    name: placeDetails.name,
                });
            } catch (error) {
                console.warn(`[RouteFinder] Failed to get details for ${place.name} (${place.place_id}):`, error);
                // If we can't get place details, we can't extract address from components
                // Nearby search results don't have address_components, so just leave address empty
                tacoBells.push({
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng,
                    address: '', // Leave empty - we need place details to get address_components
                    placeId: place.place_id,
                    name: place.name,
                });
            }
        } else {
            console.log('[RouteFinder] Skipped place (not Taco Bell):', place.name);
        }
    }

    console.log('[RouteFinder] Found', tacoBells.length, 'valid Taco Bell locations');

    if (onProgress) {
        onProgress({
            status: 'searching_tacobells',
            tacoBellsFound: tacoBells.length,
            message: `Found ${tacoBells.length} Taco Bell locations`,
        });
    }

    return tacoBells;
}

/**
 * Main route finding algorithm using new greedy nearest-neighbor approach
 */
export async function findOptimalRoute(
    startTacoBell: TacoBellLocation,
    config: RouteFinderConfig = DEFAULT_CONFIG,
    onProgress?: (progress: RouteSearchProgress) => void
): Promise<RouteFinderResult> {
    const targetKm = 50; // Target 50km as per recommendation

    console.log('[RouteFinder] Starting route search:', {
        startLocation: `${startTacoBell.name} (${startTacoBell.lat.toFixed(6)}, ${startTacoBell.lng.toFixed(6)})`,
        config: {
            minDistanceKm: (config.minDistanceMeters / 1000).toFixed(1),
            maxDistanceKm: (config.maxDistanceMeters / 1000).toFixed(1),
            targetKm,
            minTacoBells: config.minTacoBells,
            maxTacoBells: config.maxTacoBells,
            searchRadiusMiles: config.searchRadiusMiles,
            maxApiCalls: config.maxApiCalls || 50,
        },
    });

    let apiCallCount = 0;
    const maxApiCalls = config.maxApiCalls || 50;

    try {
        // Step 1: Find all Taco Bells within radius
        const allTacoBells = await findTacoBells(
            startTacoBell,
            config.searchRadiusMiles,
            onProgress
        );

        if (allTacoBells.length < config.minTacoBells) {
            const error = `Not enough Taco Bells found. Found ${allTacoBells.length}, need at least ${config.minTacoBells}`;
            console.error('[RouteFinder]', error);
            throw new Error(error);
        }

        // Make sure start Taco Bell is in the list
        const startInList = allTacoBells.find(tb => tb.placeId === startTacoBell.placeId);
        if (!startInList) {
            allTacoBells.push(startTacoBell);
        }

        if (onProgress) {
            onProgress({
                status: 'finding_route',
                tacoBellsFound: allTacoBells.length,
                apiCallsUsed: apiCallCount,
                message: 'Generating candidate routes...',
            });
        }

        // Step 2: Generate candidate routes using new algorithm
        console.log('[RouteFinder] Generating candidate routes...');

        const candidateRoutes: RouteCandidate[] = [];

        // Try different route lengths (8-10 Taco Bells)
        for (let nStops = config.minTacoBells; nStops <= config.maxTacoBells; nStops++) {
            try {
                const routes = generateCandidateRoutes(
                    startTacoBell,
                    allTacoBells,
                    targetKm,
                    nStops,
                    200 // Generate 200 candidates per route length
                );
                candidateRoutes.push(...routes);
            } catch (error) {
                console.warn(`[RouteFinder] Could not generate routes with ${nStops} stops:`, error);
            }
        }

        console.log(`[RouteFinder] Generated ${candidateRoutes.length} candidate routes`);

        // Get top 5 candidates
        const topCandidates = candidateRoutes.slice(0, 5);

        if (topCandidates.length === 0) {
            throw new Error('No candidate routes generated');
        }

        console.log('[RouteFinder] Top candidate routes (Haversine estimates):');
        topCandidates.forEach((route, i) => {
            const distanceKm = route.totalDistance / 1000;
            const estimatedRoadKm = distanceKm * 1.18; // Account for road distance multiplier
            const loopPenalty = loopnessPenalty(route.stops) / 1000;
            console.log(`  ${i + 1}. ${route.stops.length - 1} stops, ${distanceKm.toFixed(1)} km Haversine (~${estimatedRoadKm.toFixed(1)} km road), score: ${route.score.toFixed(2)}, loop penalty: ${loopPenalty.toFixed(2)} km`);
        });

        if (onProgress) {
            onProgress({
                status: 'finding_route',
                tacoBellsFound: allTacoBells.length,
                apiCallsUsed: apiCallCount,
                routesEvaluated: candidateRoutes.length,
                message: `Generated ${candidateRoutes.length} candidate routes, verifying top ${topCandidates.length}...`,
            });
        }

        // Step 3: Verify top candidates with Google Directions API
        console.log(`[RouteFinder] Verifying top ${topCandidates.length} routes with Directions API`);

        let bestRoute: RouteCandidate | null = null;
        let bestActualDistance = Infinity;
        let bestRouteIndex = -1;

        for (let i = 0; i < topCandidates.length; i++) {
            const candidate = topCandidates[i];

            if (apiCallCount >= maxApiCalls) {
                console.warn(`[RouteFinder] Reached max API calls (${maxApiCalls}), stopping verification`);
                break;
            }

            try {
                // Remove duplicate start at end for waypoints
                const waypoints = candidate.stops.slice(1, -1);
                const origin = candidate.stops[0];
                const destination = candidate.stops[candidate.stops.length - 1];

                console.log(`[RouteFinder] API call ${apiCallCount + 1}/${maxApiCalls}: Verifying route ${i + 1}/${topCandidates.length} with ${waypoints.length} waypoints`);

                const directions = await calculateRoute(
                    origin,
                    destination,
                    waypoints
                );

                apiCallCount++;

                if (directions.routes && directions.routes.length > 0) {
                    const totalDistance = directions.routes[0].legs.reduce(
                        (sum, leg) => sum + leg.distance.value,
                        0
                    );

                    const distanceKm = totalDistance / 1000;
                    const distanceMiles = totalDistance / 1609.34;

                    console.log(`[RouteFinder] Route ${i + 1} actual distance: ${distanceKm.toFixed(1)} km (${distanceMiles.toFixed(2)} miles)`);
                    console.log(`  Haversine estimate was: ${(candidate.totalDistance / 1000).toFixed(1)} km`);

                    // Check if route meets constraints
                    if (totalDistance >= config.minDistanceMeters &&
                        totalDistance <= config.maxDistanceMeters) {

                        // Prefer routes closer to target (50km)
                        if (totalDistance < bestActualDistance || bestRoute === null) {
                            // Also check if this is actually better (closer to target)
                            const currentDiff = Math.abs(totalDistance / 1000 - targetKm);
                            const bestDiff = bestRoute
                                ? Math.abs(bestActualDistance / 1000 - targetKm)
                                : Infinity;

                            if (currentDiff <= bestDiff || bestRoute === null) {
                                console.log(`[RouteFinder] Route ${i + 1} is new best!`);
                                bestRoute = candidate;
                                bestActualDistance = totalDistance;
                                bestRouteIndex = i;
                            }
                        }
                    } else {
                        if (totalDistance < config.minDistanceMeters) {
                            console.log(`[RouteFinder] Route ${i + 1} too short: ${distanceKm.toFixed(1)} km < ${(config.minDistanceMeters / 1000).toFixed(1)} km`);
                        } else {
                            console.log(`[RouteFinder] Route ${i + 1} too long: ${distanceKm.toFixed(1)} km > ${(config.maxDistanceMeters / 1000).toFixed(1)} km`);
                        }
                    }
                } else {
                    console.warn(`[RouteFinder] Route ${i + 1} returned no routes from Directions API`);
                }

                if (onProgress) {
                    onProgress({
                        status: 'finding_route',
                        tacoBellsFound: allTacoBells.length,
                        apiCallsUsed: apiCallCount,
                        routesEvaluated: candidateRoutes.length,
                        message: `Verifying routes... (${apiCallCount} API calls)`,
                    });
                }
            } catch (error) {
                console.error(`[RouteFinder] Error calculating route ${i + 1}:`, error);
                // Continue with other routes
            }
        }

        // Step 4: Return best route
        if (bestRoute) {
            const distanceKm = bestActualDistance / 1000;
            const distanceMiles = bestActualDistance / 1609.34;

            console.log('[RouteFinder] SUCCESS! Found optimal route:', {
                tacoBells: bestRoute.stops.length - 1,
                totalDistanceKm: distanceKm.toFixed(1),
                totalDistanceMiles: distanceMiles.toFixed(2),
                apiCallsUsed: apiCallCount,
                routeIndex: bestRouteIndex + 1,
            });

            if (onProgress) {
                onProgress({
                    status: 'complete',
                    tacoBellsFound: allTacoBells.length,
                    apiCallsUsed: apiCallCount,
                    routesEvaluated: candidateRoutes.length,
                    message: `Route found! ${bestRoute.stops.length - 1} Taco Bells, ${distanceKm.toFixed(1)} km (${distanceMiles.toFixed(1)} miles)`,
                });
            }

            // Remove duplicate start at end
            const routeWithoutDuplicate = bestRoute.stops.slice(0, -1);

            return {
                success: true,
                route: routeWithoutDuplicate,
                totalDistance: bestActualDistance,
            };
        } else {
            // Fall back to best Haversine-estimated route if no API route verified
            const bestEstimate = topCandidates[0];
            console.warn('[RouteFinder] No verified route found, falling back to best estimated route:', {
                tacoBells: bestEstimate.stops.length - 1,
                estimatedDistanceKm: (bestEstimate.totalDistance / 1000).toFixed(1),
                apiCallsUsed: apiCallCount,
            });

            if (onProgress) {
                onProgress({
                    status: 'complete',
                    tacoBellsFound: allTacoBells.length,
                    apiCallsUsed: apiCallCount,
                    routesEvaluated: candidateRoutes.length,
                    message: `Route found (estimated)! ${bestEstimate.stops.length - 1} Taco Bells`,
                });
            }

            const routeWithoutDuplicate = bestEstimate.stops.slice(0, -1);

            return {
                success: true,
                route: routeWithoutDuplicate,
                totalDistance: bestEstimate.totalDistance,
            };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        console.error('[RouteFinder] Error during route search:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
        });

        if (onProgress) {
            onProgress({
                status: 'error',
                message: errorMessage,
            });
        }

        return {
            success: false,
            error: errorMessage,
        };
    }
}
