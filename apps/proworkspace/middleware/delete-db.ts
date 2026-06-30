import { db } from "db";
import type { ZeruxRequestContext } from "zeruxjs";

type PgPoolLike = {
    query(statement: string, params?: unknown[]): Promise<unknown>;
};

type PgRowsResult<T> = {
    rows?: T[];
};

type TableRow = {
    table_schema: string;
    table_name: string;
};

const DELETE_FLAG = "delete";

const sendJson = (context: ZeruxRequestContext, status: number, body: Record<string, unknown>) => {
    if (context.res.writableEnded) {
        return;
    }

    context.res.statusCode = status;
    context.res.setHeader("Content-Type", "application/json; charset=utf-8");
    context.res.end(JSON.stringify(body));
};

const escapeIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

const shouldRunDelete = (context: ZeruxRequestContext) =>
    context.query.get("db") === DELETE_FLAG;

const getNativePool = () => {
    const native = db.native() as Partial<PgPoolLike>;

    if (typeof native.query !== "function") {
        throw new Error("Active database connection does not expose a PostgreSQL query method.");
    }

    return native as PgPoolLike;
};

const deletePublicTables = async () => {
    const pool = getNativePool();
    const tableResult = await pool.query(
        `SELECT table_schema, table_name
         FROM information_schema.tables
         WHERE table_type = 'BASE TABLE'
           AND table_schema NOT IN ('pg_catalog', 'information_schema')`
    ) as PgRowsResult<TableRow>;

    const rows = Array.isArray(tableResult.rows) ? tableResult.rows : [];
    if (rows.length === 0) {
        return [];
    }

    const tableNames = rows.map((row) =>
        `${escapeIdentifier(row.table_schema)}.${escapeIdentifier(row.table_name)}`
    );

    await pool.query(`DROP TABLE ${tableNames.join(", ")} CASCADE`);

    return rows.map((row) => `${row.table_schema}.${row.table_name}`);
};

export default async (context: ZeruxRequestContext, next: () => Promise<void>) => {
    if (!shouldRunDelete(context)) {
        return next();
    }

    if (process.env.NODE_ENV === "production") {
        return sendJson(context, 403, {
            error: true,
            message: "Database reset is disabled in production."
        });
    }

    try {
        const deletedTables = await deletePublicTables();

        return {
            ok: true,
            deletedTables,
            message: deletedTables.length === 0
                ? "No PostgreSQL tables were found."
                : `Deleted ${deletedTables.length} PostgreSQL tables.`
        };
    } catch (caught) {
        return sendJson(context, 500, {
            error: true,
            message: caught instanceof Error ? caught.message : "Unable to delete PostgreSQL tables."
        });
    }
};
