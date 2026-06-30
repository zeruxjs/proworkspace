import { db } from "db";
import type { ZeruxRequestContext } from "zeruxjs";

export type ActiveSiteRow = {
    id: number;
    site: string;
    for: string;
    status: string;
    "active-identifier": string;
};

const normalizeIdentifier = (value: string) =>
    value.trim().toLowerCase();

export const isActiveIdentifier = (value: string) =>
    /^[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}-[a-f0-9]{8}$/.test(value);

export const findActiveSiteByIdentifier = async (identifier: string) => {
    const normalized = normalizeIdentifier(identifier);
    if (!isActiveIdentifier(normalized)) {
        return null;
    }

    const result = await db.select({
        table: "sites",
        columns: ["id", "site", "for", "status", "active-identifier"],
        where: {
            and: [
                {
                    field: "active-identifier",
                    operator: "eq",
                    value: normalized
                },
                {
                    field: "status",
                    operator: "eq",
                    value: "active"
                }
            ]
        },
        limit: 1
    });

    return ((Array.isArray(result.rows) ? result.rows[0] : null) as ActiveSiteRow | undefined) ?? null;
};

export const siteActiveResponse = async (context: ZeruxRequestContext) => {
    const identifier = normalizeIdentifier(context.query.get("identifier") ?? "");
    const site = await findActiveSiteByIdentifier(identifier);

    if (!site) {
        return {
            active: false,
            site: undefined
        };
    }

    return {
        active: true,
        site: site.site
    };
};
