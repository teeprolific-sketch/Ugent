import { EtaRequest } from '@ugent/core';
import { requireUser } from '@/lib/auth';
import { body, handle, json } from '@/lib/http';
import { travelTime } from '@/lib/maps';

/** Driving time with current traffic, for "leave by" times in the brief and schedule. */
export const POST = handle(async (req: Request) => {
  await requireUser(req);
  const { origin, destination } = await body(req, EtaRequest);
  return json(await travelTime(origin, destination));
});
