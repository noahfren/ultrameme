import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action'); // 'nearby' or 'details'
    const location = searchParams.get('location'); // lat,lng
    const radius = searchParams.get('radius'); // in meters
    const placeId = searchParams.get('placeId');

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Google Maps API key is not configured' },
            { status: 500 }
        );
    }

    try {
        if (action === 'nearby') {
            // Nearby search
            if (!location || !radius) {
                return NextResponse.json(
                    { error: 'Location and radius are required for nearby search' },
                    { status: 400 }
                );
            }

            // Search for Taco Bell locations
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=${radius}&type=restaurant&keyword=Taco%20Bell&key=${apiKey}`;

            const response = await fetch(url);

            if (!response.ok) {
                return NextResponse.json(
                    { error: `Places API error: ${response.statusText}` },
                    { status: response.status }
                );
            }

            const data = await response.json();

            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                return NextResponse.json(
                    { error: `Places API returned status: ${data.status}` },
                    { status: 400 }
                );
            }

            return NextResponse.json(data);
        } else if (action === 'details') {
            // Place details
            if (!placeId) {
                return NextResponse.json(
                    { error: 'Place ID is required for details' },
                    { status: 400 }
                );
            }

            const fields = 'name,formatted_address,geometry,place_id,types';
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

            const response = await fetch(url);

            if (!response.ok) {
                return NextResponse.json(
                    { error: `Places API error: ${response.statusText}` },
                    { status: response.status }
                );
            }

            const data = await response.json();

            if (data.status !== 'OK') {
                return NextResponse.json(
                    { error: `Places API returned status: ${data.status}` },
                    { status: 400 }
                );
            }

            return NextResponse.json(data);
        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use "nearby" or "details"' },
                { status: 400 }
            );
        }
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch from Places API' },
            { status: 500 }
        );
    }
}

