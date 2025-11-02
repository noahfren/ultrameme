'use client';

import { useState, useEffect } from 'react';
import { Location } from '@/types';
import { useRoutePlanner } from '@/hooks/useRoutePlanner';
import MapView from '@/components/MapView';
import LocationSearch from '@/components/LocationSearch';
import WaypointList from '@/components/WaypointList';
import DistanceDisplay from '@/components/DistanceDisplay';
import ShareButton from '@/components/ShareButton';
import { APIProvider } from '@vis.gl/react-google-maps';

export default function Home() {
  const {
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
  } = useRoutePlanner();

  const [endSameAsStart, setEndSameAsStart] = useState(false);
  const [waypointSearchValue, setWaypointSearchValue] = useState<Location | null>(null);

  // Sync endPoint with startPoint when checkbox is checked
  useEffect(() => {
    if (endSameAsStart && startPoint) {
      setEndPoint(startPoint);
    }
  }, [endSameAsStart, startPoint, setEndPoint]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #36399a 0%, #a77bca 100%)' }}>
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <h1 className="text-2xl font-bold mb-4" style={{ color: '#36399a' }}>
            Google Maps API Key Required
          </h1>
          <p className="text-gray-600 mb-4">
            Please set your Google Maps API key in the <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file:
          </p>
          <code className="block bg-gray-100 p-3 rounded text-sm text-left">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
          </code>
          <p className="text-sm text-gray-500 mt-4">
            See README.md for setup instructions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm" style={{ background: 'linear-gradient(to right, #36399a, #a77bca)' }}>
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-white">Ultra Marathon Route Planner</h1>
            <p className="text-sm text-white/90 mt-1">
              Plan your meme ultra marathon routes with waypoints and distance tracking
            </p>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col lg:flex-row max-w-[1920px] mx-auto w-full">
          {/* Left Column: Route Edit Tools */}
          <div className="lg:w-1/4 bg-gray-50 h-auto lg:h-[calc(100vh-120px)] border-r border-gray-200 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Start Point */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Point
                </label>
                <LocationSearch
                  placeholder="Search for start location..."
                  onLocationSelect={setStartPoint}
                  value={startPoint}
                />
              </div>

              {/* End Point Same as Start Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="endSameAsStart"
                  checked={endSameAsStart}
                  onChange={(e) => setEndSameAsStart(e.target.checked)}
                  className="w-4 h-4 border-gray-300 rounded focus:ring-2"
                  style={{ accentColor: '#36399a' }}
                />
                <label
                  htmlFor="endSameAsStart"
                  className="ml-2 text-sm text-gray-700 cursor-pointer"
                >
                  End point same as start point
                </label>
              </div>

              {/* End Point */}
              {!endSameAsStart && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Point
                  </label>
                  <LocationSearch
                    placeholder="Search for end location..."
                    onLocationSelect={setEndPoint}
                    value={endPoint}
                  />
                </div>
              )}

              {/* Add Waypoint */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Add Waypoint
                </label>
                <LocationSearch
                  placeholder="Search for waypoint location..."
                  onLocationSelect={(location) => {
                    if (startPoint || endPoint) {
                      addWaypoint(location);
                      setWaypointSearchValue(null);
                    }
                  }}
                  value={waypointSearchValue}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Add waypoints to your route
                </p>
              </div>

              {/* Waypoint List */}
              {waypoints.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Waypoints ({waypoints.length})
                  </h3>
                  <WaypointList
                    waypoints={waypoints}
                    routeSegments={routeData?.segments || []}
                    onReorder={reorderWaypoints}
                    onRemove={removeWaypoint}
                  />
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="rounded-lg p-3" style={{ backgroundColor: '#fee01240', border: '1px solid #ef1897' }}>
                  <p className="text-sm" style={{ color: '#ef1897' }}>{error}</p>
                </div>
              )}
            </div>

            {/* Clear Route Button - Pinned to Bottom */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              {(startPoint || endPoint || waypoints.length > 0) && (
                <button
                  onClick={() => {
                    clearRoute();
                    setEndSameAsStart(false);
                  }}
                  className="w-full px-4 py-2 text-white rounded-lg transition-colors font-medium text-sm"
                  style={{ backgroundColor: '#ef1897' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d01685'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef1897'}
                >
                  Clear Route
                </button>
              )}
            </div>
          </div>

          {/* Center Column: Map */}
          <div className="flex-1 lg:w-1/2 h-[600px] lg:h-[calc(100vh-120px)] bg-white">
            <MapView
              startPoint={startPoint}
              endPoint={endPoint}
              waypoints={waypoints}
            />
          </div>

          {/* Right Column: Route Summary */}
          <div className="lg:w-1/4 bg-gray-50 h-auto lg:h-[calc(100vh-120px)] border-l border-gray-200 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Distance Display */}
              {routeData && (
                <DistanceDisplay
                  totalDistance={routeData.totalDistance}
                  segments={routeData.segments}
                  isLoading={isCalculating}
                />
              )}
            </div>

            {/* Share Button - Pinned to Bottom */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <ShareButton
                startPoint={startPoint}
                endPoint={endPoint}
                waypoints={waypoints}
              />
            </div>
          </div>
        </main>
      </div>
    </APIProvider>
  );
}
