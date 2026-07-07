import { NextResponse } from 'next/server';
import Papa from 'papaparse';

// Force this route to be dynamic — never statically cached by Next.js
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_VIDEO_CONTENT_PLAN_URL;

    if (!url) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_VIDEO_CONTENT_PLAN_URL environment variable is not defined.' },
        { status: 500 }
      );
    }

    // Fetch the CSV data with caching disabled to guarantee fresh spreadsheet data
    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch CSV data: HTTP ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const csvText = await response.text();

    // Parse the CSV content using PapaParse
    const parsedData = Papa.parse(csvText, {
      header: true,         // Treat the first row as header keys
      skipEmptyLines: true, // Skip empty lines in the CSV
      dynamicTyping: true,  // Coerce numbers and booleans automatically
    });

    if (parsedData.errors && parsedData.errors.length > 0) {
      console.warn('CSV parsing warnings/errors:', parsedData.errors);
    }

    const jsonResponse = NextResponse.json({
      success: true,
      data: parsedData.data,
      meta: parsedData.meta,
    });
    // Tell browsers and CDNs not to cache this response
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return jsonResponse;
  } catch (error: unknown) {
    console.error('Error fetching/parsing spreadsheet data:', error);
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
