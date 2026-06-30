import { db } from "db";
import { createDnsTables } from "./db.ts";

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";

export type DnsRecordRow = {
    id: number;
    org_id: number;
    domain: string;
    name: string;
    type: DnsRecordType;
    value: string;
    ttl: number;
    priority: number | null;
    source: string;
    locked: boolean;
    status: string;
};

const DNS_TYPES = new Set<DnsRecordType>(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]);

export const normalizeRecordType = (value: string): DnsRecordType => {
    const type = value.trim().toUpperCase() as DnsRecordType;
    if (!DNS_TYPES.has(type)) {
        throw new Error("Choose a valid DNS record type.");
    }

    return type;
};

const normalizeDomain = (value: string, fallback: string) =>
    (value || fallback)
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split(":")[0]
        .toLowerCase()
        .replace(/\.$/, "");

export const normalizeRecordName = (value: string) => {
    const name = value.trim().toLowerCase().replace(/\.$/, "");
    if (!name || name === "@" || name === "root") return "@";
    if (!/^(?:\*|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(name)) {
        throw new Error("Enter a valid DNS record name.");
    }

    return name;
};

export const normalizeRecordValue = (type: DnsRecordType, value: string) => {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error("Record value is required.");
    }

    if (type === "A" && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized)) {
        throw new Error("A records require an IPv4 address.");
    }

    if (type === "AAAA" && !/^[a-f0-9:]+$/i.test(normalized)) {
        throw new Error("AAAA records require an IPv6 address.");
    }

    return normalized;
};

export const normalizeTtl = (value: string | number | undefined) => {
    const ttl = Number(value || 300);
    if (!Number.isFinite(ttl) || ttl < 60 || ttl > 86400) {
        throw new Error("TTL must be between 60 and 86400 seconds.");
    }

    return Math.round(ttl);
};

export const getDnsRecords = async (orgId: number) => {
    await createDnsTables();

    const result = await db.select({
        table: "dns_records",
        columns: ["id", "org_id", "domain", "name", "type", "value", "ttl", "priority", "source", "locked", "status"],
        where: {
            field: "org_id",
            operator: "eq",
            value: orgId
        },
        orderBy: [
            { by: "locked", direction: "desc" },
            { by: "domain", direction: "asc" },
            { by: "name", direction: "asc" },
            { by: "type", direction: "asc" }
        ]
    });

    return (Array.isArray(result.rows) ? result.rows : []) as DnsRecordRow[];
};

export const ensureSystemDnsRecords = async (orgId: number, domainFallback: string) => {
    await createDnsTables();

    const mainDomain = normalizeDomain(process.env.MAIN_DOMAIN || domainFallback, domainFallback);
    const nsLabels = (process.env.NS_DOMAIN || "ns1,ns2").split(",").map((entry) => entry.trim()).filter(Boolean);
    const ipv4 = (process.env.VPS_IPV4 || "").split(",").map((entry) => entry.trim()).filter(Boolean);
    const ipv6 = (process.env.VPS_IPV6 || "").split(",").map((entry) => entry.trim()).filter(Boolean);
    const desired = nsLabels.flatMap((name) => [
        ...ipv4.map((value) => ({ domain: mainDomain, name, type: "A" as DnsRecordType, value })),
        ...ipv6.map((value) => ({ domain: mainDomain, name, type: "AAAA" as DnsRecordType, value }))
    ]);

    const existing = await getDnsRecords(orgId);
    const existingSystem = existing.filter((record) => record.source === "system");
    const desiredKeys = new Set(desired.map((record) => `${record.domain}|${record.name}|${record.type}|${record.value}`));

    for (const record of existingSystem) {
        const key = `${record.domain}|${record.name}|${record.type}|${record.value}`;
        if (!desiredKeys.has(key)) {
            await db.delete({
                table: "dns_records",
                where: {
                    field: "id",
                    operator: "eq",
                    value: record.id
                }
            });
        }
    }

    for (const record of desired) {
        const duplicate = existing.find((entry) =>
            entry.domain === record.domain &&
            entry.name === record.name &&
            entry.type === record.type &&
            entry.value === record.value
        );
        if (duplicate) continue;

        await db.insert({
            table: "dns_records",
            values: {
                org_id: orgId,
                domain: record.domain,
                name: record.name,
                type: record.type,
                value: record.value,
                ttl: 300,
                source: "system",
                locked: true,
                status: "active"
            }
        });
    }
};
