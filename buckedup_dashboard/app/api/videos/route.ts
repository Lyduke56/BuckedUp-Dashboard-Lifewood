import { NextResponse } from 'next/server';
import Papa from 'papaparse';

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

    return NextResponse.json({
      success: true,
      data: parsedData.data,
      meta: parsedData.meta,
    });
  } catch (error: any) {
    console.error('Error fetching/parsing spreadsheet data:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
