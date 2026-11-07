import type { IntegrationStatus } from '@ugent/core';
import { INTEGRATIONS } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { googleConfigured, isGoogleProvider } from '@/lib/google';
import { handle, json } from '@/lib/http';
import { mapsConfigured } from '@/lib/maps';
import { waConfigured } from '@/lib/whatsapp';

/** Which cloud services Me AI has set up, and which ones this user has connected. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const [rows, wa] = await Promise.all([
    db.select().from(schema.connections).where(eq(schema.connections.userId, user.id)),
    db.select().from(schema.waBusiness).where(eq(schema.waBusiness.userId, user.id)).limit(1),
  ]);
  const items: IntegrationStatus[] = INTEGRATIONS.map((p) => {
    if (isGoogleProvider(p)) {
      const c = rows.find((r) => r.provider === p);
      return { provider: p, available: googleConfigured(), connected: !!c, account: c?.account ?? null };
    }
    if (p === 'whatsappBusiness') return { provider: p, available: waConfigured(), connected: !!wa[0], account: wa[0]?.displayNumber || null };
    return { provider: p, available: mapsConfigured(), connected: mapsConfigured(), account: null };
  });
  return json({ items });
});
