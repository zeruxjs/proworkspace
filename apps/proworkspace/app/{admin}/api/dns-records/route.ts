import { HttpError, type ZeruxRequestContext } from "zeruxjs";
import { db } from "db";
import { getAdminModel } from "../../../../lib/admin.ts";
import { requireCapability } from "../../../../lib/auth.ts";
import {
    ensureSystemDnsRecords,
    getDnsRecords,
    normalizeRecordName,
    normalizeRecordType,
    normalizeRecordValue,
    normalizeTtl
} from "../../../../lib/dns.ts";

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

const text = (body: BodyRecord, key: string) =>
    typeof body[key] === "string" ? body[key].trim() : "";

const jsonError = (message: string, status = 400): never => {
    throw new HttpError(status, message);
};

const orgContext = async () => {
    const model = await getAdminModel();
    const orgId = Number(model.organization?.id ?? model.sites[0]?.org_id);
    if (!Number.isFinite(orgId) || !model.organization) {
        return jsonError("Organization was not found.", 404);
    }

    await ensureSystemDnsRecords(orgId, model.organization.domain);

    return {
        orgId,
        domain: model.organization.domain
    };
};

export const GET = async (context: ZeruxRequestContext) => {
    await requireCapability(context, "admin.access");
    const org = await orgContext();

    return {
        ok: true,
        records: await getDnsRecords(org.orgId)
    };
};

export const POST = async (context: ZeruxRequestContext) => {
    try {
        await requireCapability(context, "admin.access");
        const org = await orgContext();
        const body = asBodyObject(context.body);
        const type = normalizeRecordType(text(body, "type"));
        const name = normalizeRecordName(text(body, "name"));
        const domain = (text(body, "domain") || process.env.MAIN_DOMAIN || org.domain)
            .toLowerCase()
            .replace(/^https?:\/\//i, "")
            .split("/")[0]
            .split(":")[0]
            .replace(/\.$/, "");
        const value = normalizeRecordValue(type, text(body, "value"));
        const ttl = normalizeTtl(text(body, "ttl"));

        if (!domain || !/^[a-z0-9.-]+$/.test(domain)) {
            return jsonError("Enter a valid DNS domain.");
        }

        await db.insert({
            table: "dns_records",
            values: {
                org_id: org.orgId,
                domain,
                name,
                type,
                value,
                ttl,
                source: "manual",
                locked: false,
                status: "active"
            }
        });

        return {
            ok: true
        };
    } catch (caught) {
        if (caught instanceof HttpError) throw caught;
        return jsonError(caught instanceof Error ? caught.message : "Unable to add DNS record.");
    }
};

export const DELETE = async (context: ZeruxRequestContext) => {
    try {
        await requireCapability(context, "admin.access");
        const org = await orgContext();
        const body = asBodyObject(context.body);
        const id = Number(text(body, "id"));
        if (!Number.isFinite(id)) {
            return jsonError("Unknown DNS record.");
        }

        const records = await getDnsRecords(org.orgId);
        const record = records.find((entry) => entry.id === id);
        if (!record) {
            return jsonError("DNS record was not found.", 404);
        }
        if (record.locked || record.source === "system") {
            return jsonError("System DNS records cannot be deleted.");
        }

        await db.delete({
            table: "dns_records",
            where: {
                and: [
                    { field: "id", operator: "eq", value: id },
                    { field: "org_id", operator: "eq", value: org.orgId }
                ]
            }
        });

        return {
            ok: true
        };
    } catch (caught) {
        if (caught instanceof HttpError) throw caught;
        return jsonError(caught instanceof Error ? caught.message : "Unable to delete DNS record.");
    }
};
