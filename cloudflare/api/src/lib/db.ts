export type Row = Record<string, unknown>;

type Param = string | number | boolean | null | undefined;

function clean(params: Param[]): (string | number | null)[] {
  return params.map(p => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

/** Thin wrapper over D1 with positional parameters. */
export class Db {
  constructor(readonly d1: D1Database) {}

  stmt(sql: string, ...params: Param[]): D1PreparedStatement {
    return this.d1.prepare(sql).bind(...clean(params));
  }

  async one<T = Row>(sql: string, ...params: Param[]): Promise<T | null> {
    return (await this.stmt(sql, ...params).first<T>()) ?? null;
  }

  async all<T = Row>(sql: string, ...params: Param[]): Promise<T[]> {
    return (await this.stmt(sql, ...params).all<T>()).results;
  }

  async value<T = unknown>(sql: string, ...params: Param[]): Promise<T | null> {
    const row = await this.stmt(sql, ...params).first<Row>();
    if (!row) return null;
    const first = Object.values(row)[0];
    return (first ?? null) as T | null;
  }

  async count(sql: string, ...params: Param[]): Promise<number> {
    return Number((await this.value<number>(sql, ...params)) ?? 0);
  }

  async run(sql: string, ...params: Param[]): Promise<number> {
    return (await this.stmt(sql, ...params).run()).meta.changes ?? 0;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    return statements.length ? this.d1.batch(statements) : [];
  }

  insertStmt(table: string, data: Record<string, Param>): D1PreparedStatement {
    const keys = Object.keys(data);
    return this.stmt(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
      ...keys.map(k => data[k]),
    );
  }

  async insert(table: string, data: Record<string, Param>): Promise<void> {
    await this.insertStmt(table, data).run();
  }

  updateStmt(table: string, id: string, data: Record<string, Param>): D1PreparedStatement {
    const keys = Object.keys(data);
    return this.stmt(
      `UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
      ...keys.map(k => data[k]),
      id,
    );
  }

  async update(table: string, id: string, data: Record<string, Param>): Promise<void> {
    if (Object.keys(data).length) await this.updateStmt(table, id, data).run();
  }

  async get<T = Row>(table: string, id: string | null | undefined): Promise<T | null> {
    if (!id) return null;
    return this.one<T>(`SELECT * FROM ${table} WHERE id = ?`, id);
  }
}

export function placeholders(n: number): string {
  return Array.from({length: n}, () => '?').join(', ');
}

/** Splits values into chunks small enough for D1's bound-parameter limit. */
export function chunks<T>(values: T[], size = 90): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

export function uuid(): string {
  return crypto.randomUUID();
}
