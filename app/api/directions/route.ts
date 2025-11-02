import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const origin = searchParams.get('origin');
  const destination = searchParams.get('destination');
  const waypoints = searchParams.get('waypoints');
  const mode = searchParams.get('mode') || 'walking';

  if (!origin || !destination) {
    return NextResponse.json(
      { error: 'Origin and destination are required' },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps API key is not configured' },
      { status: 500 }
    );
  }

  // Build waypoints string
  const waypointParams = waypoints ? `&waypoints=${waypoints}` : '';

  // Directions API endpoint
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointParams}&mode=${mode}&key=${apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Directions API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      return NextResponse.json(
        { error: `Directions API returned status: ${data.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch directions' },
      { status: 500 }
    );
  }
}

