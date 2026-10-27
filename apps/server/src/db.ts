import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The one database surface the server uses: parameterised SQL with $1 placeholders. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Runs `work` in a transaction; a thrown error rolls it back. */
  transaction<T>(work: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate(db: Db): Promise<void> {
  await db.query("create table if not exists schema_migrations (name text primary key, applied_at bigint not null)");
  const applied = new Set((await db.query<{ name: string }>("select name from schema_migrations")).map((row) => row.name));
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await db.transaction(async (tx) => {
      for (const statement of splitStatements(sql)) await tx.query(statement);
      await tx.query("insert into schema_migrations (name, applied_at) values ($1, $2)", [file, Date.now()]);
    });
  }
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

/** PostgreSQL in production. */
export async function connectPostgres(url: string): Promise<Db> {
  const { default: pg } = await import("pg");
  // bigint columns hold millisecond timestamps, well inside Number's safe range.
  pg.types.setTypeParser(20, (value: string) => Number(value));
  const pool = new pg.Pool({ connectionString: url, max: 10 });

  const wrap = (run: (sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }>): Db => ({
    async query<T>(sql: string, params?: readonly unknown[]) {
      return (await run(sql, params)).rows as T[];
    },
    transaction: async () => {
      throw new Error("Nested transactions are not supported");
    },
    close: async () => undefined,
  });

  return {
    async query<T>(sql: string, params?: readonly unknown[]) {
      return (await pool.query(sql, params as unknown[])).rows as T[];
    },
    async transaction<T>(work: (tx: Db) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await work(wrap((sql, params) => client.query(sql, params as unknown[])));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** PostgreSQL compiled to WebAssembly: same SQL, no daemon. Used by tests and local development. */
export async function connectPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
  const normalise = (rows: Record<string, unknown>[]) =>
    rows.map((row) => {
      for (const key of Object.keys(row)) if (typeof row[key] === "bigint") row[key] = Number(row[key]);
      return row;
    });
  let inTransaction = false;
  const db: Db = {
    async query<T>(sql: string, params?: readonly unknown[]) {
      const result = await pglite.query<Record<string, unknown>>(sql, params as unknown[]);
      return normalise(result.rows) as T[];
    },
    async transaction<T>(work: (tx: Db) => Promise<T>) {
      if (inTransaction) return work(db);
      inTransaction = true;
      try {
        return await pglite.transaction(async (tx) => {
          const scoped: Db = {
            async query<R>(sql: string, params?: readonly unknown[]) {
              const result = await tx.query<Record<string, unknown>>(sql, params as unknown[]);
              return normalise(result.rows) as R[];
            },
            transaction: (inner) => inner(scoped),
            close: async () => undefined,
          };
          return work(scoped);
        });
      } finally {
        inTransaction = false;
      }
    },
    close: () => pglite.close(),
  };
  return db;
}
