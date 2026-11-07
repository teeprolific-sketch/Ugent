import { sql } from 'drizzle-orm';
import { cloudChatEnabled } from '@/lib/claude';
import { db, dbConfigured } from '@/lib/db';

export async function GET() {
  let database = false;
  if (dbConfigured) {
    try { await db.execute(sql`select 1`); database = true; } catch { database = false; }
  }
  return Response.json({ ok: database, database, cloudChat: cloudChatEnabled() }, { status: database ? 200 : 503 });
}
