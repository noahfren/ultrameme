'use client';

import { useState, useEffect } from 'react';
import { Location, TacoBellLocation, RouteSearchProgress, RouteFinderConfig } from '@/types';
import { findOptimalRoute } from '@/lib/routeFinder';
import { validateTacoBell } from '@/lib/googleMaps';
import LocationSearch from './LocationSearch';

interface AutoRoutePlannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRouteFound: (route: TacoBellLocation[]) => void;
}

export default function AutoRoutePlannerModal({
    isOpen,
    onClose,
    onRouteFound,
}: AutoRoutePlannerModalProps) {
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [progress, setProgress] = useState<RouteSearchProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isValidTacoBell, setIsValidTacoBell] = useState(false);
    const [minTacoBells, setMinTacoBells] = useState(8);
    const [maxTacoBells, setMaxTacoBells] = useState(10);
    const [configError, setConfigError] = useState<string | null>(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedLocation(null);
            setIsSearching(false);
            setProgress(null);
            setError(null);
            setIsValidTacoBell(false);
            setMinTacoBells(8);
            setMaxTacoBells(10);
            setConfigError(null);
        }
    }, [isOpen]);

    // Validate that selected location is a Taco Bell using Places API
    useEffect(() => {
        if (selectedLocation) {
            console.log('[AutoRouteModal] Validating location:', selectedLocation.address);
            setIsValidTacoBell(false);
            setError(null);

            let cancelled = false;

            // Validate using Places API
            validateTacoBell(selectedLocation)
                .then((result) => {
                    if (cancelled) return;

                    console.log('[AutoRouteModal] Validation result:', {
                        isValid: result.isValid,
                        tacoBell: result.tacoBell?.name,
                    });

                    setIsValidTacoBell(result.isValid);
                    if (!result.isValid) {
                        setError('Please select a Taco Bell location');
                    } else {
                        setError(null);
                        // Update location with validated Taco Bell data if significantly different
                        if (result.tacoBell) {
                            const distance = Math.sqrt(
                                Math.pow(result.tacoBell.lat - selectedLocation.lat, 2) +
                                Math.pow(result.tacoBell.lng - selectedLocation.lng, 2)
                            );
                            // Only update if coordinates are significantly different (> 0.001 degrees, ~100m)
                            if (distance > 0.001 || result.tacoBell.address !== selectedLocation.address) {
                                console.log('[AutoRouteModal] Updating location with validated coordinates');
                                setSelectedLocation({
                                    lat: result.tacoBell.lat,
                                    lng: result.tacoBell.lng,
                                    address: result.tacoBell.address,
                                    name: result.tacoBell.name,
                                });
                            }
                        }
                    }
                })
                .catch((err) => {
                    if (cancelled) return;
                    console.error('[AutoRouteModal] Error validating Taco Bell:', err);
                    setIsValidTacoBell(false);
                    setError('Error validating location. Please try again.');
                });

            return () => {
                cancelled = true;
            };
        }
    }, [selectedLocation]);

    // Validate Taco Bell count configuration
    useEffect(() => {
        const errorMessages: string[] = [];

        if (minTacoBells < 2) {
            errorMessages.push('Minimum Taco Bells must be at least 2');
        }
        if (minTacoBells > 20) {
            errorMessages.push('Minimum Taco Bells cannot exceed 20');
        }
        if (maxTacoBells > 20) {
            errorMessages.push('Maximum Taco Bells cannot exceed 20');
        }
        if (minTacoBells > maxTacoBells) {
            errorMessages.push('Minimum must be less than or equal to maximum');
        }

        if (errorMessages.length > 0) {
            setConfigError(errorMessages.join('. '));
        } else {
            setConfigError(null);
        }
    }, [minTacoBells, maxTacoBells]);

    const handleSearch = async () => {
        if (!selectedLocation || !isValidTacoBell) return;

        console.log('[AutoRouteModal] Starting route search');
        setIsSearching(true);
        setError(null);
        setProgress(null);

        try {
            // Validate and get place ID
            const validation = await validateTacoBell(selectedLocation);

            if (!validation.isValid || !validation.tacoBell) {
                const error = 'Selected location is not a valid Taco Bell';
                console.error('[AutoRouteModal]', error);
                setError(error);
                return;
            }

            // Convert to TacoBellLocation for the API
            const startTacoBell: TacoBellLocation = {
                lat: validation.tacoBell.lat,
                lng: validation.tacoBell.lng,
                address: validation.tacoBell.address,
                placeId: validation.tacoBell.placeId,
                name: validation.tacoBell.name,
            };

            console.log('[AutoRouteModal] Calling findOptimalRoute');
            const config: RouteFinderConfig = {
                minDistanceMeters: 50000, // 50km hard minimum
                maxDistanceMeters: 55000,
                minTacoBells,
                maxTacoBells,
                searchRadiusMiles: 15,
            };
            const result = await findOptimalRoute(startTacoBell, config, (prog) => {
                setProgress(prog);
            });

            if (result.success && result.route) {
                console.log('[AutoRouteModal] Route found successfully:', {
                    routeLength: result.route.length,
                    totalDistance: result.totalDistance ? `${(result.totalDistance / 1609.34).toFixed(2)} miles` : 'unknown',
                });
                onRouteFound(result.route);
                onClose();
            } else {
                const error = result.error || 'No valid route found';
                console.error('[AutoRouteModal] Route search failed:', error);
                setError(error);
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : 'An unexpected error occurred';
            console.error('[AutoRouteModal] Error during route search:', err);
            setError(error);
        } finally {
            setIsSearching(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div
                    className="px-6 py-4 border-b"
                    style={{ background: 'linear-gradient(to right, #36399a, #a77bca)' }}
                >
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">
                            Automatic Taco Bell 50K Route Finder
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-gray-200 transition-colors text-2xl font-bold"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Explanation */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                            This tool automatically generates a circular 50K (31-34 mile) route
                            visiting unique Taco Bell locations within 15 miles of your starting
                            point. The algorithm uses a heuristic search to find an optimal looped route
                            that avoids backtracking and maximizes geographical spread.
                        </p>
                    </div>

                    {/* Location Input */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Starting Taco Bell Location
                        </label>
                        <LocationSearch
                            placeholder="Search for a Taco Bell..."
                            onLocationSelect={setSelectedLocation}
                            value={selectedLocation}
                        />
                        {error && selectedLocation && (
                            <p className="text-sm text-red-600 mt-2">{error}</p>
                        )}
                    </div>

                    {/* Route Configuration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Minimum Taco Bells
                            </label>
                            <input
                                type="number"
                                min="2"
                                max="20"
                                value={minTacoBells}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setMinTacoBells(isNaN(val) ? 0 : val);
                                }}
                                disabled={isSearching}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-black"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Maximum Taco Bells
                            </label>
                            <input
                                type="number"
                                min="2"
                                max="20"
                                value={maxTacoBells}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setMaxTacoBells(isNaN(val) ? 0 : val);
                                }}
                                disabled={isSearching}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-black"
                            />
                        </div>
                    </div>
                    {configError && (
                        <p className="text-sm text-red-600 mt-2">
                            {configError}
                        </p>
                    )}

                    {/* Progress Display */}
                    {isSearching && progress && (
                        <div className="border rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center space-x-3 mb-3">
                                <div className="text-2xl animate-spin">🌮</div>
                                <p className="text-sm font-medium text-gray-700">
                                    {progress.message}
                                </p>
                            </div>

                            {progress.status === 'finding_route' && (
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>Progress</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-purple-600 h-2 rounded-full transition-all duration-300 animate-pulse"
                                            style={{
                                                width: '100%',
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Success/Error Messages */}
                    {progress?.status === 'complete' && !isSearching && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-sm text-green-800">
                                ✓ {progress.message}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                        <button
                            onClick={onClose}
                            disabled={isSearching}
                            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSearch}
                            disabled={!selectedLocation || !isValidTacoBell || isSearching || !!configError}
                            className="px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: selectedLocation && isValidTacoBell && !isSearching && !configError ? '#36399a' : '#9ca3af',
                            }}
                            onMouseEnter={(e) => {
                                if (selectedLocation && isValidTacoBell && !isSearching && !configError) {
                                    e.currentTarget.style.backgroundColor = '#2d3180';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedLocation && isValidTacoBell && !isSearching && !configError) {
                                    e.currentTarget.style.backgroundColor = '#36399a';
                                }
                            }}
                        >
                            {isSearching ? 'Searching...' : 'Create Route'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

