'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Waypoint, RouteSegment } from '@/types';
import { formatDistance } from '@/lib/googleMaps';

interface WaypointListProps {
  waypoints: Waypoint[];
  routeSegments: RouteSegment[];
  onReorder: (startIndex: number, endIndex: number) => void;
  onRemove: (id: string) => void;
}

function SortableWaypointItem({
  waypoint,
  segmentDistance,
  onRemove,
}: {
  waypoint: Waypoint;
  segmentDistance?: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: waypoint.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mt-1 flex-shrink-0"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-700">
                Waypoint {waypoint.order + 1}
              </span>
            </div>
            <p className="text-sm text-gray-600 truncate">{waypoint.location.address}</p>
            {segmentDistance !== undefined && (
              <p className="text-xs text-gray-500 mt-1">
                To next: {formatDistance(segmentDistance)}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onRemove(waypoint.id)}
          className="flex-shrink-0 transition-colors"
          style={{ color: '#ef1897' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#d01685'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#ef1897'}
          aria-label="Remove waypoint"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function WaypointList({
  waypoints,
  routeSegments,
  onReorder,
  onRemove,
}: WaypointListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = waypoints.findIndex((wp) => wp.id === active.id);
      const newIndex = waypoints.findIndex((wp) => wp.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  // Sort waypoints by order
  const sortedWaypoints = [...waypoints].sort((a, b) => a.order - b.order);

  if (sortedWaypoints.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No waypoints added yet.</p>
        <p className="text-sm mt-1">Add waypoints to create your route.</p>
      </div>
    );
  }

  // Get segment distance for each waypoint
  const getSegmentDistance = (waypointIndex: number): number | undefined => {
    // Find the segment that starts at this waypoint
    const waypoint = sortedWaypoints[waypointIndex];
    if (!waypoint) return undefined;

    const segment = routeSegments.find(
      (seg) => seg.from === waypoint.location.address
    );
    return segment?.distance;
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={sortedWaypoints.map((wp) => wp.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {sortedWaypoints.map((waypoint, index) => (
            <SortableWaypointItem
              key={waypoint.id}
              waypoint={waypoint}
              segmentDistance={getSegmentDistance(index)}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

