import { TacoBellLocation, RouteSearchProgress, RouteFinderConfig, RouteFinderResult } from '@/types';
import { Location } from '@/types';
import { searchNearbyPlaces, calculateRoute, haversineDistance } from './googleMaps';

const DEFAULT_CONFIG: RouteFinderConfig = {
    minDistanceMeters: 48280, // 30 miles
    maxDistanceMeters: 54717, // 34 miles
    minTacoBells: 8,
    maxTacoBells: 10,
    searchRadiusMiles: 15,
};

interface RouteCandidate {
    path: TacoBellLocation[];
    estimatedDistance: number;
    visited: Set<string>; // place IDs
}

/**
 * Calculate bearing from one location to another (0-360°)
 */
function calculateBearing(from: Location, to: Location): number {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360°
}

/**
 * Calculate angular spread score (variance-based method)
 * Returns 0-1 score where 1 is perfectly distributed
 */
function calculateAngularSpread(route: Location[], start: Location): number {
    if (route.length < 2) return 0;

    const bearings = route.map(tb => calculateBearing(start, tb)).sort((a, b) => a - b);

    // Calculate gaps between consecutive bearings
    const gaps: number[] = [];
    for (let i = 0; i < bearings.length; i++) {
        const next = bearings[(i + 1) % bearings.length];
        const current = bearings[i];
        const gap = i === bearings.length - 1
            ? (360 - current + next) // wrap around
            : (next - current);
        gaps.push(gap);
    }

    // Ideal gap = 360° / numTacoBells
    const idealGap = 360 / bearings.length;

    // Calculate variance from ideal
    const variance = gaps.reduce((sum, gap) =>
        sum + Math.pow(gap - idealGap, 2), 0) / gaps.length;

    // Lower variance = better spread (convert to 0-1 score)
    const maxVariance = Math.pow(idealGap, 2);
    return 1 - Math.min(variance / maxVariance, 1);
}

/**
 * Calculate circularity score (penalize backtracking, reward smooth loops)
 * Returns 0-1 score where 1 is a perfect loop
 */
function calculateCircularity(route: Location[], start: Location): number {
    if (route.length < 3) return 0.5; // Not enough points to determine

    // Calculate cumulative bearing change
    let totalBearingChange = 0;
    let prevBearing: number | null = null;

    for (let i = 0; i < route.length; i++) {
        const current = route[i];
        const next = route[(i + 1) % route.length];
        const bearing = calculateBearing(current, next);

        if (prevBearing !== null) {
            // Calculate smallest angle change
            let change = bearing - prevBearing;
            if (change > 180) change -= 360;
            if (change < -180) change += 360;
            totalBearingChange += Math.abs(change);
        }

        prevBearing = bearing;
    }

    // For a perfect loop, total bearing change should be close to 360°
    const idealChange = 360;
    const deviation = Math.abs(totalBearingChange - idealChange);
    return 1 - Math.min(deviation / idealChange, 1);
}

/**
 * Score distance fitness (how close to target 31-35 miles)
 * Returns 0-1 score
 */
function scoreDistanceFitness(distanceMeters: number, minMeters: number, maxMeters: number): number {
    const targetMin = minMeters;
    const targetMax = maxMeters;
    const targetCenter = (targetMin + targetMax) / 2;

    if (distanceMeters < targetMin) {
        // Too short - penalize more the further it is
        return Math.max(0, 1 - (targetMin - distanceMeters) / targetMin);
    } else if (distanceMeters > targetMax) {
        // Too long - penalize
        return Math.max(0, 1 - (distanceMeters - targetMax) / targetMax);
    } else {
        // In range - prefer center
        const distanceFromCenter = Math.abs(distanceMeters - targetCenter);
        const maxDistance = (targetMax - targetMin) / 2;
        return 1 - (distanceFromCenter / maxDistance);
    }
}

/**
 * Combined route scoring function
 */
function scoreRoute(
    route: Location[],
    start: Location,
    estimatedDistance: number,
    minDistance: number,
    maxDistance: number
): number {
    const distanceScore = scoreDistanceFitness(estimatedDistance, minDistance, maxDistance);
    const spreadScore = calculateAngularSpread(route, start);
    const circularityScore = calculateCircularity(route, start);

    return (
        distanceScore * 0.5 +
        spreadScore * 0.3 +
        circularityScore * 0.2
    );
}

/**
 * Estimate route distance using haversine + walking multiplier
 */
function estimateRouteDistance(route: TacoBellLocation[]): number {
    if (route.length < 2) return 0;

    let totalDistance = 0;

    for (let i = 0; i < route.length; i++) {
        const current = route[i];
        const next = route[(i + 1) % route.length];
        totalDistance += haversineDistance(current.lat, current.lng, next.lat, next.lng);
    }

    // Apply walking multiplier (≈1.3x) to approximate actual walking distance
    return totalDistance * 1.3;
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
            tacoBells.push({
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                address: place.formatted_address || place.name,
                placeId: place.place_id,
                name: place.name,
            });
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
 * Main route finding algorithm using beam search
 */
export async function findOptimalRoute(
    startTacoBell: TacoBellLocation,
    config: RouteFinderConfig = DEFAULT_CONFIG,
    onProgress?: (progress: RouteSearchProgress) => void
): Promise<RouteFinderResult> {
    console.log('[RouteFinder] Starting route search:', {
        startLocation: `${startTacoBell.name} (${startTacoBell.lat.toFixed(6)}, ${startTacoBell.lng.toFixed(6)})`,
        config: {
            minDistanceMiles: (config.minDistanceMeters / 1609.34).toFixed(1),
            maxDistanceMiles: (config.maxDistanceMeters / 1609.34).toFixed(1),
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

        // Remove starting Taco Bell from candidates (we'll add it back at the end)
        const candidateTacoBells = allTacoBells.filter(
            tb => tb.placeId !== startTacoBell.placeId
        );

        console.log('[RouteFinder] Starting beam search:', {
            totalTacoBells: allTacoBells.length,
            candidateTacoBells: candidateTacoBells.length,
            beamWidth: 5,
        });

        if (onProgress) {
            onProgress({
                status: 'finding_route',
                tacoBellsFound: allTacoBells.length,
                apiCallsUsed: apiCallCount,
                message: 'Evaluating routes...',
            });
        }

        // Step 2: Initialize beam search
        const BEAM_WIDTH = 5;
        let currentRoutes: RouteCandidate[] = [{
            path: [startTacoBell],
            estimatedDistance: 0,
            visited: new Set([startTacoBell.placeId]),
        }];

        let bestRoute: RouteCandidate | null = null;
        let bestScore = -1;
        let routesEvaluated = 0;

        // Step 3: Beam search with depth limit
        for (let depth = 0; depth < config.maxTacoBells; depth++) {
            console.log(`[RouteFinder] Beam search iteration ${depth + 1}/${config.maxTacoBells}, current routes: ${currentRoutes.length}`);

            const candidates: RouteCandidate[] = [];

            for (const route of currentRoutes) {
                const lastLocation = route.path[route.path.length - 1];

                // Get unvisited candidates and sort by distance from last location
                const unvisitedCandidates = candidateTacoBells
                    .filter(tb => !route.visited.has(tb.placeId))
                    .map(tb => ({
                        tacoBell: tb,
                        distance: haversineDistance(
                            lastLocation.lat,
                            lastLocation.lng,
                            tb.lat,
                            tb.lng
                        )
                    }))
                    .sort((a, b) => a.distance - b.distance); // Sort by distance, closest first

                // Limit to closest candidates (prioritize nearby Taco Bells)
                // Consider top 15 closest candidates to keep routes compact
                const MAX_CANDIDATES_PER_ROUTE = 15;
                const closestCandidates = unvisitedCandidates.slice(0, MAX_CANDIDATES_PER_ROUTE);

                // Try adding each closest Taco Bell
                for (const { tacoBell: candidate, distance: distanceToCandidate } of closestCandidates) {

                    // Create new path to estimate full route distance
                    const newPath = [...route.path, candidate];
                    const estimatedTotal = estimateRouteDistance([...newPath, startTacoBell]);
                    const newPathLength = newPath.length;

                    // Be more lenient with routes that haven't reached minimum size yet
                    // They need room to grow, and estimates may be inaccurate for partial routes
                    const isStillBuilding = newPathLength < config.minTacoBells;
                    const maxDistanceThreshold = isStillBuilding
                        ? config.maxDistanceMeters * 1.5  // More lenient for building routes
                        : config.maxDistanceMeters * 1.2; // Stricter once we have enough

                    // For routes that are close to the target, allow them even if slightly over
                    // The actual Directions API distance might be different from estimates
                    const distancePerTacoBell = estimatedTotal / newPathLength;
                    const targetDistancePerTacoBell = (config.minDistanceMeters + config.maxDistanceMeters) / 2 / config.minTacoBells;

                    // If we're still building and distance per Taco Bell is reasonable, be more lenient
                    if (isStillBuilding && distancePerTacoBell <= targetDistancePerTacoBell * 1.5) {
                        // Route is growing at a reasonable rate, allow it even if slightly over threshold
                        if (estimatedTotal > maxDistanceThreshold * 1.1) {
                            continue; // Still too long even with leniency
                        }
                    } else if (estimatedTotal > maxDistanceThreshold) {
                        continue; // Too long
                    }

                    // Only prune too-short routes if we've reached minimum size AND we're way too short
                    // This allows routes to grow to reach the target
                    if (newPathLength >= config.minTacoBells && estimatedTotal < config.minDistanceMeters * 0.7) {
                        continue; // We have enough Taco Bells but route is way too short
                    }

                    // Create new candidate route
                    // Note: estimatedDistance is just cumulative, not including return trip
                    // The full distance (including return) is calculated via estimateRouteDistance
                    const newDistance = route.estimatedDistance + distanceToCandidate;

                    candidates.push({
                        path: newPath,
                        estimatedDistance: newDistance,
                        visited: new Set([...route.visited, candidate.placeId]),
                    });
                }
            }

            console.log(`[RouteFinder] Generated ${candidates.length} candidate routes at depth ${depth + 1}`);

            if (candidates.length === 0) {
                console.log(`[RouteFinder] No candidates generated at depth ${depth + 1}. Current routes: ${currentRoutes.length}`);
                for (const route of currentRoutes) {
                    const unvisitedCount = candidateTacoBells.filter(tb => !route.visited.has(tb.placeId)).length;
                    const currentEst = estimateRouteDistance([...route.path, startTacoBell]);
                    console.log(`  Route with ${route.path.length} Taco Bells: ${unvisitedCount} unvisited remaining, current distance: ${(currentEst / 1609.34).toFixed(2)} miles`);

                    // Try one sample candidate to see why it's being pruned
                    if (unvisitedCount > 0) {
                        const sampleCandidate = candidateTacoBells.find(tb => !route.visited.has(tb.placeId));
                        if (sampleCandidate) {
                            const sampleEst = estimateRouteDistance([...route.path, sampleCandidate, startTacoBell]);
                            const wouldBeBuilding = (route.path.length + 1) < config.minTacoBells;
                            const threshold = wouldBeBuilding
                                ? config.maxDistanceMeters * 1.5
                                : config.maxDistanceMeters * 1.2;
                            console.log(`    Sample candidate would make route: ${(sampleEst / 1609.34).toFixed(2)} miles (threshold: ${(threshold / 1609.34).toFixed(2)})`);
                        }
                    }
                }
                // Break early if no candidates and we haven't found any valid routes
                if (!bestRoute && depth < config.minTacoBells) {
                    console.warn(`[RouteFinder] Beam search exhausted at depth ${depth + 1}, but haven't reached minimum Taco Bells (${config.minTacoBells})`);
                }
            }

            // Score and sort candidates
            const scoredCandidates = candidates.map(candidate => {
                const estimatedTotal = estimateRouteDistance([...candidate.path, startTacoBell]);
                let score = scoreRoute(
                    candidate.path,
                    startTacoBell,
                    estimatedTotal,
                    config.minDistanceMeters,
                    config.maxDistanceMeters
                );

                // Bonus for routes with good distance-per-Taco-Bell ratio (can grow to minTacoBells)
                const pathLength = candidate.path.length;
                if (pathLength < config.minTacoBells) {
                    const distancePerTacoBell = estimatedTotal / pathLength;
                    const targetDistancePerTacoBell = (config.minDistanceMeters + config.maxDistanceMeters) / 2 / config.minTacoBells;

                    // Reward routes that have a reasonable distance-per-Taco-Bell ratio
                    // This indicates they can grow to 8-10 Taco Bells without exceeding limits
                    const ratioFitness = 1 - Math.min(Math.abs(distancePerTacoBell - targetDistancePerTacoBell) / targetDistancePerTacoBell, 1);
                    score += ratioFitness * 0.2; // Bonus up to 0.2 points
                }

                return { candidate, score, estimatedTotal };
            });

            scoredCandidates.sort((a, b) => b.score - a.score);

            // Log top candidates
            if (scoredCandidates.length > 0) {
                console.log(`[RouteFinder] Top ${Math.min(3, scoredCandidates.length)} candidate scores:`,
                    scoredCandidates.slice(0, 3).map((sc, i) => ({
                        rank: i + 1,
                        pathLength: sc.candidate.path.length,
                        estimatedDistanceMiles: (sc.estimatedTotal / 1609.34).toFixed(2),
                        score: sc.score.toFixed(3),
                    }))
                );
            }

            // Keep top BEAM_WIDTH candidates
            currentRoutes = scoredCandidates.slice(0, BEAM_WIDTH).map(sc => sc.candidate);

            // Check if any route is complete or promising (within size and distance constraints)
            for (const route of currentRoutes) {
                const completeRoute = [...route.path, startTacoBell];
                const estimatedTotal = estimateRouteDistance(completeRoute);

                // Check if route is in the target distance range (even if not enough Taco Bells yet)
                const isInRange = estimatedTotal >= config.minDistanceMeters * 0.9 &&
                    estimatedTotal <= config.maxDistanceMeters * 1.1;
                const hasMinTacoBells = route.path.length >= config.minTacoBells;
                const hasMaxTacoBells = route.path.length <= config.maxTacoBells;

                if (hasMinTacoBells && hasMaxTacoBells && isInRange) {
                    const score = scoreRoute(
                        route.path,
                        startTacoBell,
                        estimatedTotal,
                        config.minDistanceMeters,
                        config.maxDistanceMeters
                    );

                    console.log(`[RouteFinder] Found valid route candidate:`, {
                        pathLength: route.path.length,
                        estimatedDistanceMiles: (estimatedTotal / 1609.34).toFixed(2),
                        score: score.toFixed(3),
                    });

                    if (score > bestScore) {
                        console.log(`[RouteFinder] New best route! Score: ${score.toFixed(3)} (previous: ${bestScore.toFixed(3)})`);
                        bestRoute = {
                            path: completeRoute,
                            estimatedDistance: estimatedTotal,
                            visited: route.visited,
                        };
                        bestScore = score;
                    }
                    routesEvaluated++;
                }
            }

            // Update progress
            if (onProgress) {
                onProgress({
                    status: 'finding_route',
                    tacoBellsFound: allTacoBells.length,
                    apiCallsUsed: apiCallCount,
                    routesEvaluated: routesEvaluated,
                    message: `Evaluating routes... (${routesEvaluated} routes evaluated)`,
                });
            }

            // If no candidates left, break
            if (currentRoutes.length === 0) break;
        }

        // Step 4: For promising routes, calculate actual distances using Google Directions API
        const routesToVerify: RouteCandidate[] = [];

        if (bestRoute) {
            routesToVerify.push(bestRoute);
            console.log('[RouteFinder] Added best route to verification queue');
        }

        // Also verify top current routes
        for (const route of currentRoutes.slice(0, 3)) {
            if (route.path.length >= config.minTacoBells) {
                const completeRoute = [...route.path, startTacoBell];
                const estimatedTotal = estimateRouteDistance(completeRoute);

                if (estimatedTotal >= config.minDistanceMeters * 0.9 && estimatedTotal <= config.maxDistanceMeters * 1.1) {
                    routesToVerify.push({
                        path: completeRoute,
                        estimatedDistance: estimatedTotal,
                        visited: route.visited,
                    });
                }
            }
        }

        console.log(`[RouteFinder] Verifying ${routesToVerify.length} routes with Directions API (max ${maxApiCalls} calls)`);

        let bestActualRoute: RouteCandidate | null = null;
        let bestActualDistance = Infinity;

        for (let i = 0; i < routesToVerify.length; i++) {
            const route = routesToVerify[i];

            if (apiCallCount >= maxApiCalls) {
                console.warn(`[RouteFinder] Reached max API calls (${maxApiCalls}), stopping verification`);
                break;
            }

            try {
                const waypoints = route.path.slice(1, -1); // Exclude start (first) and end (duplicate start)
                console.log(`[RouteFinder] API call ${apiCallCount + 1}/${maxApiCalls}: Verifying route ${i + 1}/${routesToVerify.length} with ${route.path.length - 1} Taco Bells`);

                const directions = await calculateRoute(
                    route.path[0],
                    route.path[route.path.length - 1],
                    waypoints
                );

                apiCallCount++;

                if (directions.routes && directions.routes.length > 0) {
                    const totalDistance = directions.routes[0].legs.reduce(
                        (sum, leg) => sum + leg.distance.value,
                        0
                    );

                    console.log(`[RouteFinder] Route ${i + 1} actual distance: ${(totalDistance / 1609.34).toFixed(2)} miles (estimated: ${(route.estimatedDistance / 1609.34).toFixed(2)})`);

                    if (totalDistance >= config.minDistanceMeters &&
                        totalDistance <= config.maxDistanceMeters &&
                        totalDistance < bestActualDistance) {
                        console.log(`[RouteFinder] Route ${i + 1} is valid and new best! Distance: ${(totalDistance / 1609.34).toFixed(2)} miles`);
                        bestActualRoute = route;
                        bestActualDistance = totalDistance;
                    } else if (totalDistance < config.minDistanceMeters) {
                        console.log(`[RouteFinder] Route ${i + 1} too short: ${(totalDistance / 1609.34).toFixed(2)} < ${(config.minDistanceMeters / 1609.34).toFixed(2)} miles`);
                    } else if (totalDistance > config.maxDistanceMeters) {
                        console.log(`[RouteFinder] Route ${i + 1} too long: ${(totalDistance / 1609.34).toFixed(2)} > ${(config.maxDistanceMeters / 1609.34).toFixed(2)} miles`);
                    }
                } else {
                    console.warn(`[RouteFinder] Route ${i + 1} returned no routes from Directions API`);
                }

                if (onProgress) {
                    onProgress({
                        status: 'finding_route',
                        tacoBellsFound: allTacoBells.length,
                        apiCallsUsed: apiCallCount,
                        routesEvaluated: routesEvaluated,
                        message: `Evaluating routes... (${apiCallCount} API calls)`,
                    });
                }
            } catch (error) {
                console.error(`[RouteFinder] Error calculating route ${i + 1}:`, error);
                // Continue with other routes
            }
        }

        // Step 5: Return best route or error
        if (bestActualRoute) {
            console.log('[RouteFinder] SUCCESS! Found optimal route:', {
                tacoBells: bestActualRoute.path.length - 1,
                totalDistanceMiles: (bestActualDistance / 1609.34).toFixed(2),
                apiCallsUsed: apiCallCount,
                routesEvaluated,
            });

            if (onProgress) {
                onProgress({
                    status: 'complete',
                    tacoBellsFound: allTacoBells.length,
                    apiCallsUsed: apiCallCount,
                    routesEvaluated: routesEvaluated,
                    message: `Route found! ${bestActualRoute.path.length - 1} Taco Bells, ${(bestActualDistance / 1609.34).toFixed(1)} miles`,
                });
            }

            return {
                success: true,
                route: bestActualRoute.path.slice(0, -1), // Remove duplicate start at end
                totalDistance: bestActualDistance,
            };
        } else if (bestRoute) {
            // Fall back to estimated route if API calls failed
            console.warn('[RouteFinder] No verified route found, falling back to estimated route:', {
                tacoBells: bestRoute.path.length - 1,
                estimatedDistanceMiles: (bestRoute.estimatedDistance / 1609.34).toFixed(2),
                apiCallsUsed: apiCallCount,
            });

            if (onProgress) {
                onProgress({
                    status: 'complete',
                    tacoBellsFound: allTacoBells.length,
                    apiCallsUsed: apiCallCount,
                    routesEvaluated: routesEvaluated,
                    message: `Route found (estimated)! ${bestRoute.path.length - 1} Taco Bells`,
                });
            }

            return {
                success: true,
                route: bestRoute.path.slice(0, -1), // Remove duplicate start at end
                totalDistance: bestRoute.estimatedDistance,
            };
        } else {
            const error = `No valid route found. Evaluated ${routesEvaluated} routes but none met distance constraints.`;
            console.error('[RouteFinder] FAILED:', error);
            throw new Error(error);
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
