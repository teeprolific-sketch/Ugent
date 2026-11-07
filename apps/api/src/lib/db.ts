import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;

// One pool per server process (reused across hot reloads in development).
const g = globalThis as unknown as { ugentSql?: ReturnType<typeof postgres> };
const sql = g.ugentSql ?? postgres(url ?? 'postgres://invalid', { max: 10, prepare: false });
if (process.env.NODE_ENV !== 'production') g.ugentSql = sql;

export const db = drizzle(sql, { schema });
export const dbConfigured = !!url;
export { schema };
