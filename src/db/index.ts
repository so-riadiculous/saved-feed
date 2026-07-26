import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let instance: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!instance) {
    const sql = neon(process.env.DATABASE_URL!);
    instance = drizzle(sql, { schema });
  }
  return instance;
}

// Proxy defers connecting until a query is actually run, so importing this
// module (e.g. during Next.js's build-time route analysis) never requires
// DATABASE_URL to be present.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
