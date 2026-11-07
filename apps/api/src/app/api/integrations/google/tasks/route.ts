import { requireUser } from '@/lib/auth';
import { accessToken, googleGet } from '@/lib/google';
import { handle, json } from '@/lib/http';

/** Open tasks from the user's default Google Tasks list, for importing into Ugent. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const token = await accessToken(user.id, 'googleTasks');
  const data = await googleGet<{ items?: { id: string; title?: string; due?: string; notes?: string }[] }>(
    token, 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=false&maxResults=50');
  const tasks = (data.items ?? []).filter((t) => t.title?.trim()).map((t) => ({ id: `gtask-${t.id}`, title: t.title!.trim(), due: t.due ? t.due.slice(0, 10) : null }));
  return json({ tasks });
});
