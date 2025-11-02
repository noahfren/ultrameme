'use client';

import { RouteSegment } from '@/types';
import { formatDistance } from '@/lib/googleMaps';

interface DistanceDisplayProps {
  totalDistance: number;
  segments: RouteSegment[];
  isLoading?: boolean;
}

export default function DistanceDisplay({
  totalDistance,
  segments,
  isLoading = false,
}: DistanceDisplayProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800 mb-1">Total Distance</h3>
        <p className="text-3xl font-semibold" style={{ color: '#36399a' }}>
          {formatDistance(totalDistance)}
        </p>
      </div>

      {segments.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Route Segments</h4>
          <div className="space-y-2">
            {segments.map((segment, index) => (
              <div
                key={`${segment.from}-${segment.to}-${index}`}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 truncate">
                    <span className="font-medium">{segment.from}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">↓</p>
                  <p className="text-sm text-gray-600 truncate">
                    <span className="font-medium">{segment.to}</span>
                  </p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-semibold text-gray-800">
                    {formatDistance(segment.distance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

