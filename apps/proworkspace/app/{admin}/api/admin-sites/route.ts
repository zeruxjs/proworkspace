import { HttpError, type ZeruxRequestContext } from "zeruxjs";
import { db } from "db";
import {
    allowedSiteService,
    getAdminModel,
    normalizeAdminSiteInput
} from "../../../../lib/admin.ts";
import { requireCapability } from "../../../../lib/auth.ts";
import { createActiveIdentifier } from "../../../../lib/db.ts";

type BodyRecord = Record<string, unknown>;

const asBodyObject = (body: unknown): BodyRecord => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
        return body as BodyRecord;
    }

    if (typeof body === "string") {
        return Object.fromEntries(new URLSearchParams(body).entries());
    }

    return {};
};

const stringValue = (body: BodyRecord, key: string) => {
    const value = body[key];
    return typeof value === "string" ? value.trim() : "";
};

const jsonError = (message: string, status = 400): never => {
    throw new HttpError(status, message);
};

export const GET = async (context: ZeruxRequestContext) => {
    await requireCapability(context, "admin.access");

    const model = await getAdminModel();

    return {
        ok: true,
        organization: model.organization,
        sites: model.sites.map((site) => ({
            id: site.id,
            site: site.site,
            for: site.for,
            activeIdentifier: site["active-identifier"],
            status: site.status
        }))
    };
};

export const POST = async (context: ZeruxRequestContext) => {
    try {
        await requireCapability(context, "admin.access");

        const body = asBodyObject(context.body);
        const service = stringValue(body, "service");
        const domain = stringValue(body, "domain");
        const path = stringValue(body, "path");

        if (!allowedSiteService(service)) {
            return jsonError("Unknown service.");
        }

        const model = await getAdminModel();
        const orgId = model.adminSite?.org_id ?? model.sites[0]?.org_id;
        if (!Number.isFinite(Number(orgId))) {
            return jsonError("Organization was not found.", 404);
        }

        const nextSite = normalizeAdminSiteInput(domain, path);
        const duplicate = model.sites.find((site) => site.site === nextSite);
        if (duplicate) {
            return jsonError("That domain and path is already mapped.");
        }

        const activeIdentifier = createActiveIdentifier();
        const created = await db.insert({
            table: "sites",
            values: {
                org_id: Number(orgId),
                site: nextSite,
                "for": service,
                "active-identifier": activeIdentifier,
                status: "active"
            },
            returning: ["id"]
        });
        const createdId = Number(created.insertedIds?.[0] ?? (created.rows?.[0] as { id?: number } | undefined)?.id);
        if (!Number.isFinite(createdId)) {
            throw new Error("Unable to create site mapping.");
        }

        return {
            ok: true,
            site: nextSite
        };
    } catch (caught) {
        if (caught instanceof HttpError) {
            throw caught;
        }

        return jsonError(caught instanceof Error ? caught.message : "Unable to update site mapping.");
    }
};

export const DELETE = async (context: ZeruxRequestContext) => {
    try {
        await requireCapability(context, "admin.access");

        const body = asBodyObject(context.body);
        const id = Number(stringValue(body, "id"));
        const domain = stringValue(body, "domain");
        const path = stringValue(body, "path");
        const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";

        if (!Number.isFinite(id)) {
            return jsonError("Unknown site mapping.");
        }

        const expectedSite = normalizeAdminSiteInput(domain, path);
        if (confirmation !== expectedSite) {
            return jsonError("Typed domain and path did not match the site mapping.");
        }

        const model = await getAdminModel();
        const site = model.sites.find((entry) => entry.id === id);
        if (!site) {
            return jsonError("Site mapping was not found.", 404);
        }

        if (site.site !== expectedSite) {
            return jsonError("Typed domain and path did not match the site mapping.");
        }

        const sameServiceSites = model.sites.filter((entry) => entry.for === site.for);
        if (sameServiceSites.length <= 1 && (site.for === "admin" || site.for === "accounts")) {
            return jsonError(`Add another mapping for ${site.for} before deleting its only site.`);
        }

        await db.delete({
            table: "sites",
            where: {
                and: [
                    {
                        field: "id",
                        operator: "eq",
                        value: id
                    },
                    {
                        field: "site",
                        operator: "eq",
                        value: expectedSite
                    }
                ]
            }
        });

        return {
            ok: true,
            site: expectedSite
        };
    } catch (caught) {
        if (caught instanceof HttpError) {
            throw caught;
        }

        return jsonError(caught instanceof Error ? caught.message : "Unable to delete site mapping.");
    }
};

export const PUT = async (context: ZeruxRequestContext) => {
    try {
        await requireCapability(context, "admin.access");

        const body = asBodyObject(context.body);
        const id = Number(stringValue(body, "id"));
        const service = stringValue(body, "service");
        const domain = stringValue(body, "domain");
        const path = stringValue(body, "path");

        if (!Number.isFinite(id)) {
            return jsonError("Unknown site mapping.");
        }

        if (!allowedSiteService(service)) {
            return jsonError("Unknown service.");
        }

        const model = await getAdminModel();
        const site = model.sites.find((entry) => entry.id === id);
        if (!site) {
            return jsonError("Site mapping was not found.", 404);
        }

        const nextSite = normalizeAdminSiteInput(domain, path);
        if (site.site !== nextSite) {
            const duplicate = model.sites.find((entry) => entry.site === nextSite);
            if (duplicate) {
                return jsonError("That domain and path is already mapped.");
            }
        }

        await db.update({
            table: "sites",
            where: {
                field: "id",
                operator: "eq",
                value: id
            },
            values: {
                site: nextSite,
                "for": service
            }
        });

        return {
            ok: true,
            site: nextSite
        };
    } catch (caught) {
        if (caught instanceof HttpError) {
            throw caught;
        }

        return jsonError(caught instanceof Error ? caught.message : "Unable to update site mapping.");
    }
};
