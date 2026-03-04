import { NextResponse } from 'next/server';
import { checkpointAllDatabases, getDatabaseStats, getLastCheckpointTime } from '@/lib/db';

export async function GET() {
  const stats = getDatabaseStats();
  return NextResponse.json({
    databases: stats,
    lastCheckpoint: getLastCheckpointTime(),
  });
}

export async function POST() {
  const results = checkpointAllDatabases();
  return NextResponse.json({
    results,
    lastCheckpoint: getLastCheckpointTime(),
  });
}
