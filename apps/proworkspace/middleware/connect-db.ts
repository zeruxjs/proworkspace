import { db } from "db";
import type { ZeruxRequestContext } from "zeruxjs";

const OPTIONS_TABLE = "options";
const INSTALLED_OPTION = "installed";
const INSTALLED_VALUE = "yes";

type OptionRow = {
    key?: string;
    value?: string;
};

type SiteRow = {
    id?: number;
    org_id?: number;
    site?: string;
    for?: string;
    status?: string;
    created_at?: string;
    updated_at?: string;
};

const isInstalledRow = (row: OptionRow | undefined): boolean =>
    row?.key === INSTALLED_OPTION && row?.value === INSTALLED_VALUE;

const normalizeHost = (host: string | string[] | undefined) => {
    const value = Array.isArray(host) ? host[0] ?? "" : host ?? "";
    return value.split(":")[0].toLowerCase();
};

const readInstalledState = async (): Promise<boolean> => {
    const result = await db.select({
        table: OPTIONS_TABLE,
        columns: ["key", "value"],
        where: {
            and: [
                {
                    field: "key",
                    operator: "eq",
                    value: INSTALLED_OPTION
                },
                {
                    field: "value",
                    operator: "eq",
                    value: INSTALLED_VALUE
                }
            ]
        },
        limit: 1
    });

    const rows = Array.isArray(result.rows) ? result.rows as OptionRow[] : [];

    return isInstalledRow(rows[0]);
};

export default async (context: ZeruxRequestContext, next: () => Promise<void>) => {
    try {
        const installed = await readInstalledState();
        context.state.installed = installed;

        if (installed) {
            const host = normalizeHost(context.req.headers.host);
            const sites = await db.select({
                table: "sites",
                columns: ["id", "org_id", "site", "for", "status", "created_at", "updated_at"],
                where: {
                    field: "status",
                    operator: "eq",
                    value: "active"
                }
            });

            const rows = Array.isArray(sites.rows) ? sites.rows as SiteRow[] : [];
            context.state.sites = rows;
        } else {
            context.state.site = 'installer';
        }
    } catch (error) {
        context.state.installed = false;
        context.state.site = 'installer';
        context.logger.warn("Unable to read proworkspace install state", {
            error: error instanceof Error ? error.message : String(error)
        });
    }

    await next();
};
