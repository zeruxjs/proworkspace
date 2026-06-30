import crypto from "node:crypto";
import { db } from "db";
import type { SupportedLanguageCode } from "./languages.ts";

export const OPTIONS_TABLE = "options";
export const INSTALLED_OPTION = "installed";
export const INSTALLED_VALUE = "yes";

export type EmailPolicy = "only_domain" | "selected_email_users" | "anyone";
export type OrganizationMode = "single" | "multi";

export type CreateSiteInput = {
    organizationMode: OrganizationMode;
    organizationName: string;
    emailPolicy: EmailPolicy;
    domain: string;
    selectedEmailUsers: string[];
    adminEmail: string;
    adminUsername: string;
    adminDob: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
    defaultLanguage: SupportedLanguageCode;
    site: string;
};

export const SITE_SERVICE_ORDER = [
    "admin",
    "accounts",
    "dns",
    "mail",
    "chat",
    "drive",
    "forms",
    "notes",
    "office",
    "ai",
    "passwords",
    "git",
    "tools"
] as const;

export type SiteService = typeof SITE_SERVICE_ORDER[number];

export const SITE_SERVICES = SITE_SERVICE_ORDER.filter(
    (service): service is Exclude<SiteService, "accounts"> => service !== "accounts"
);

const normalizeSiteHost = (value: string) =>
    value
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split(":")[0]
        .toLowerCase()
        .replace(/[^a-z0-9.*-]/g, "");

export const normalizeSitePath = (value: string) => {
    const cleaned = value
        .trim()
        .replace(/^\/+|\/+$/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9/_~-]/g, "")
        .replace(/\/+/g, "/");

    return cleaned ? `/${cleaned}` : "";
};

export const normalizeSiteMapping = (value: string) => {
    const withoutProtocol = value.trim().replace(/^https?:\/\//i, "");
    const [host = "", ...pathParts] = withoutProtocol.split("/");
    const normalizedHost = normalizeSiteHost(host);
    const normalizedPath = normalizeSitePath(pathParts.join("/"));

    return `${normalizedHost}${normalizedPath}`;
};

export const buildDefaultSiteMappings = (mainSite: string) => {
    const normalizedMainSite = normalizeSiteMapping(mainSite);

    return SITE_SERVICE_ORDER.map((service) => ({
        site: service === "accounts" ? normalizedMainSite : `${normalizedMainSite}/${service}`,
        for: service
    }));
};

export const createActiveIdentifier = () => {
    const value = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const groups = value.match(/.{1,8}/g) ?? [];

    return groups.join("-");
};


type OptionRow = {
    key?: unknown;
    value?: unknown;
};

const firstOptionRow = (rows: unknown[] | undefined): OptionRow | undefined =>
    Array.isArray(rows) ? rows[0] as OptionRow | undefined : undefined;

const nowSql = "CURRENT_TIMESTAMP";

const slugify = (value: string) => {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return slug || `org-${Date.now()}`;
};

const hashPassword = (password: string) => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");

    return `scrypt:${salt}:${hash}`;
};

export const ensureOptionsTable = async () =>
    db.createTable({
        table: OPTIONS_TABLE,
        ifNotExists: true,
        columns: [
            {
                name: "id",
                type: "integer",
                primary: true,
                autoIncrement: true
            },
            {
                name: "key",
                type: "varchar",
                length: 190,
                notNull: true,
                unique: true
            },
            {
                name: "value",
                type: "text",
                notNull: true
            },
            {
                name: "autoload",
                type: "boolean",
                notNull: true,
                default: true
            }
        ]
    });

export const ensureInstalledOption = async () => {
    await ensureOptionsTable();

    const installedOption = await db.select({
        table: OPTIONS_TABLE,
        columns: ["key", "value"],
        where: {
            field: "key",
            operator: "eq",
            value: INSTALLED_OPTION
        },
        limit: 1
    });
    const optionRow = firstOptionRow(installedOption.rows);

    if (optionRow?.value === INSTALLED_VALUE) {
        return installedOption;
    }

    if (optionRow?.key === INSTALLED_OPTION) {
        return db.update({
            table: OPTIONS_TABLE,
            values: {
                value: INSTALLED_VALUE
            },
            where: {
                field: "key",
                operator: "eq",
                value: INSTALLED_OPTION
            }
        });
    }

    return db.insert({
        table: OPTIONS_TABLE,
        values: {
            key: INSTALLED_OPTION,
            value: INSTALLED_VALUE,
            autoload: true
        }
    });
};

export const getProworkspaceDbConnection = () => db;

const createInstallTables = async () => {
    await db.createTable({
        table: "organizations",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "name", type: "varchar", length: 190, notNull: true },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "active" },
            { name: "email_policy", type: "varchar", length: 40, notNull: true },
            { name: "domain", type: "varchar", length: 190, notNull: true },
            { name: "logo", type: "text" },
            { name: "slug", type: "varchar", length: 190, notNull: true, unique: true }
        ]
    });

    await db.createTable({
        table: "options",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "key", type: "varchar", length: 190, notNull: true, unique: true },
            { name: "value", type: "text", notNull: true },
            { name: "autoload", type: "boolean", notNull: true, default: true }
        ]
    });

    await db.createTable({
        table: "tmp_options",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "key", type: "varchar", length: 190, notNull: true, unique: true },
            { name: "value", type: "text", notNull: true },
            { name: "expire_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "autoload", type: "boolean", notNull: true, default: true }
        ]
    });

    await db.createTable({
        table: "org_options",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true, foreign: { table: "organizations", column: "id", onDelete: "cascade" } },
            { name: "key", type: "varchar", length: 190, notNull: true },
            { name: "value", type: "text", notNull: true },
            { name: "autoload", type: "boolean", notNull: true, default: true }
        ]
    });

    await db.createTable({
        table: "org_tmp_options",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true, foreign: { table: "organizations", column: "id", onDelete: "cascade" } },
            { name: "key", type: "varchar", length: 190, notNull: true },
            { name: "value", type: "text", notNull: true },
            { name: "expire_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "autoload", type: "boolean", notNull: true, default: true }
        ]
    });

    await db.createTable({
        table: "users",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true, foreign: { table: "organizations", column: "id", onDelete: "cascade" } },
            { name: "user_id", type: "varchar", length: 80, notNull: true, unique: true },
            { name: "first_name", type: "varchar", length: 120, notNull: true },
            { name: "last_name", type: "varchar", length: 120, notNull: true },
            { name: "email", type: "varchar", length: 190, notNull: true, unique: true },
            { name: "password", type: "text", notNull: true },
            { name: "role", type: "varchar", length: 80, notNull: true },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "active" }
        ]
    });

    await db.createTable({
        table: "usermeta",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "user_id", type: "integer", notNull: true, foreign: { table: "users", column: "id", onDelete: "cascade" } },
            { name: "key", type: "varchar", length: 190, notNull: true },
            { name: "value", type: "text", notNull: true }
        ]
    });

    await db.createTable({
        table: "groups",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true, foreign: { table: "organizations", column: "id", onDelete: "cascade" } },
            { name: "name", type: "varchar", length: 120, notNull: true },
            { name: "description", type: "text" },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "active" },
            { name: "capabilities", type: "text", notNull: true, default: "" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "updated_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: "sites",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true, foreign: { table: "organizations", column: "id", onDelete: "cascade" } },
            { name: "site", type: "varchar", length: 190, notNull: true, unique: true },
            { name: "for", type: "varchar", length: 80, notNull: true },
            { name: "active-identifier", type: "varchar", length: 35, notNull: true },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "active" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "updated_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await createDnsTables();
    await createNotesTables();
};

export const createDnsTables = async () => {
    await db.createTable({
        table: "dns_records",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true, foreign: { table: "organizations", column: "id", onDelete: "cascade" } },
            { name: "domain", type: "varchar", length: 190, notNull: true },
            { name: "name", type: "varchar", length: 190, notNull: true },
            { name: "type", type: "varchar", length: 20, notNull: true },
            { name: "value", type: "text", notNull: true },
            { name: "ttl", type: "integer", notNull: true, default: 300 },
            { name: "priority", type: "integer" },
            { name: "source", type: "varchar", length: 40, notNull: true, default: "manual" },
            { name: "locked", type: "boolean", notNull: true, default: false },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "active" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "updated_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });
};

export const createNotesTables = async () => {
    await db.createTable({
        table: "notes_spaces",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true, foreign: { table: "organizations", column: "id", onDelete: "cascade" } },
            { name: "space_id", type: "varchar", length: 80, notNull: true, unique: true },
            { name: "name", type: "varchar", length: 190, notNull: true },
            { name: "slug", type: "varchar", length: 190, notNull: true },
            { name: "description", type: "text" },
            { name: "icon", type: "varchar", length: 80, notNull: true, default: "book-open" },
            { name: "visibility", type: "varchar", length: 40, notNull: true, default: "private" },
            { name: "default_role", type: "varchar", length: 40, notNull: true, default: "none" },
            { name: "inheritance_mode", type: "varchar", length: 40, notNull: true, default: "inherit_until_override" },
            { name: "encryption_mode", type: "varchar", length: 40, notNull: true, default: "standard" },
            { name: "encryption_version", type: "integer", notNull: true, default: 1 },
            { name: "created_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "updated_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "archived_at", type: "timestamp" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "updated_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: "notes_nodes",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "space_id", type: "integer", notNull: true, foreign: { table: "notes_spaces", column: "id", onDelete: "cascade" } },
            { name: "parent_id", type: "integer", foreign: { table: "notes_nodes", column: "id", onDelete: "cascade" } },
            { name: "node_id", type: "varchar", length: 80, notNull: true, unique: true },
            { name: "type", type: "varchar", length: 30, notNull: true },
            { name: "title", type: "varchar", length: 240, notNull: true },
            { name: "slug", type: "varchar", length: 190, notNull: true },
            { name: "path", type: "text", notNull: true },
            { name: "sort_order", type: "integer", notNull: true, default: 0 },
            { name: "markdown", type: "text", notNull: true, default: "" },
            { name: "excerpt", type: "text" },
            { name: "cover_image", type: "text" },
            { name: "icon", type: "varchar", length: 80 },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "active" },
            { name: "visibility_override", type: "varchar", length: 40 },
            { name: "permission_override", type: "text" },
            { name: "is_template", type: "boolean", notNull: true, default: false },
            { name: "is_encrypted", type: "boolean", notNull: true, default: false },
            { name: "encryption_key_id", type: "varchar", length: 120 },
            { name: "encrypted_payload", type: "text" },
            { name: "checksum", type: "varchar", length: 128 },
            { name: "created_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "updated_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "deleted_at", type: "timestamp" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "updated_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: "notes_revisions",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "node_id", type: "integer", notNull: true, foreign: { table: "notes_nodes", column: "id", onDelete: "cascade" } },
            { name: "revision_id", type: "varchar", length: 80, notNull: true, unique: true },
            { name: "markdown", type: "text", notNull: true },
            { name: "encrypted_payload", type: "text" },
            { name: "summary", type: "varchar", length: 240 },
            { name: "created_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: "notes_members",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "space_id", type: "integer", notNull: true, foreign: { table: "notes_spaces", column: "id", onDelete: "cascade" } },
            { name: "user_id", type: "integer", foreign: { table: "users", column: "id", onDelete: "cascade" } },
            { name: "email", type: "varchar", length: 190, notNull: true },
            { name: "role", type: "varchar", length: 40, notNull: true, default: "viewer" },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "active" },
            { name: "invited_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "updated_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: "notes_invitations",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "space_id", type: "integer", notNull: true, foreign: { table: "notes_spaces", column: "id", onDelete: "cascade" } },
            { name: "email", type: "varchar", length: 190, notNull: true },
            { name: "token_hash", type: "varchar", length: 128, notNull: true, unique: true },
            { name: "role", type: "varchar", length: 40, notNull: true, default: "viewer" },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "pending" },
            { name: "invited_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "accepted_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "expires_at", type: "timestamp" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "accepted_at", type: "timestamp" },
            { name: "revoked_at", type: "timestamp" }
        ]
    });

    await db.createTable({
        table: "notes_shares",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "space_id", type: "integer", notNull: true, foreign: { table: "notes_spaces", column: "id", onDelete: "cascade" } },
            { name: "node_id", type: "integer", foreign: { table: "notes_nodes", column: "id", onDelete: "cascade" } },
            { name: "share_id", type: "varchar", length: 80, notNull: true, unique: true },
            { name: "token_hash", type: "varchar", length: 128, notNull: true, unique: true },
            { name: "label", type: "varchar", length: 190 },
            { name: "role", type: "varchar", length: 40, notNull: true, default: "viewer" },
            { name: "auth_required", type: "boolean", notNull: true, default: false },
            { name: "allow_request_access", type: "boolean", notNull: true, default: true },
            { name: "max_uses", type: "integer" },
            { name: "use_count", type: "integer", notNull: true, default: 0 },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "active" },
            { name: "created_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "expires_at", type: "timestamp" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "revoked_at", type: "timestamp" }
        ]
    });

    await db.createTable({
        table: "notes_comments",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "node_id", type: "integer", notNull: true, foreign: { table: "notes_nodes", column: "id", onDelete: "cascade" } },
            { name: "parent_id", type: "integer", foreign: { table: "notes_comments", column: "id", onDelete: "cascade" } },
            { name: "comment_id", type: "varchar", length: 80, notNull: true, unique: true },
            { name: "anchor", type: "text" },
            { name: "body_markdown", type: "text", notNull: true },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "open" },
            { name: "created_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "updated_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "resolved_at", type: "timestamp" }
        ]
    });

    await db.createTable({
        table: "notes_comment_mentions",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "comment_id", type: "integer", notNull: true, foreign: { table: "notes_comments", column: "id", onDelete: "cascade" } },
            { name: "mentioned_user_id", type: "integer", foreign: { table: "users", column: "id", onDelete: "cascade" } },
            { name: "mentioned_email", type: "varchar", length: 190 },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "pending" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: "notes_access_requests",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "space_id", type: "integer", notNull: true, foreign: { table: "notes_spaces", column: "id", onDelete: "cascade" } },
            { name: "node_id", type: "integer", foreign: { table: "notes_nodes", column: "id", onDelete: "cascade" } },
            { name: "requester_user_id", type: "integer", foreign: { table: "users", column: "id", onDelete: "cascade" } },
            { name: "requester_email", type: "varchar", length: 190, notNull: true },
            { name: "requested_role", type: "varchar", length: 40, notNull: true, default: "viewer" },
            { name: "message", type: "text" },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "pending" },
            { name: "decided_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "decided_at", type: "timestamp" }
        ]
    });

    await db.createTable({
        table: "notes_attachments",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "node_id", type: "integer", notNull: true, foreign: { table: "notes_nodes", column: "id", onDelete: "cascade" } },
            { name: "attachment_id", type: "varchar", length: 80, notNull: true, unique: true },
            { name: "file_name", type: "varchar", length: 240, notNull: true },
            { name: "mime_type", type: "varchar", length: 120, notNull: true },
            { name: "storage_key", type: "text", notNull: true },
            { name: "byte_size", type: "integer", notNull: true, default: 0 },
            { name: "checksum", type: "varchar", length: 128 },
            { name: "is_encrypted", type: "boolean", notNull: true, default: false },
            { name: "encryption_key_id", type: "varchar", length: 120 },
            { name: "created_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: "notes_encryption_keys",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "space_id", type: "integer", notNull: true, foreign: { table: "notes_spaces", column: "id", onDelete: "cascade" } },
            { name: "key_id", type: "varchar", length: 120, notNull: true, unique: true },
            { name: "wrapped_key", type: "text", notNull: true },
            { name: "algorithm", type: "varchar", length: 80, notNull: true, default: "xchacha20-poly1305" },
            { name: "version", type: "integer", notNull: true, default: 1 },
            { name: "created_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } },
            { name: "rotated_at", type: "timestamp" },
            { name: "revoked_at", type: "timestamp" }
        ]
    });

    await db.createTable({
        table: "notes_labels",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true, foreign: { table: "organizations", column: "id", onDelete: "cascade" } },
            { name: "label_id", type: "varchar", length: 80, notNull: true, unique: true },
            { name: "type", type: "varchar", length: 40, notNull: true },
            { name: "name", type: "varchar", length: 120, notNull: true },
            { name: "slug", type: "varchar", length: 120, notNull: true },
            { name: "color", type: "varchar", length: 40, notNull: true, default: "default" },
            { name: "created_by", type: "integer", foreign: { table: "users", column: "id", onDelete: "setNull" } },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: "notes_label_links",
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "label_id", type: "integer", notNull: true, foreign: { table: "notes_labels", column: "id", onDelete: "cascade" } },
            { name: "target_type", type: "varchar", length: 40, notNull: true },
            { name: "target_id", type: "integer", notNull: true },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });
};

export const createInstalledSite = async (input: CreateSiteInput) => {
    const selectedEmailUsers = input.selectedEmailUsers.join(",");
    const orgSlug = slugify(input.organizationName);
    const passwordHash = hashPassword(input.adminPassword);
    const adminPublicId = input.adminUsername || crypto.randomUUID();

    try {
        await createInstallTables();

        const existingInstall = await db.select({
            table: OPTIONS_TABLE,
            columns: ["value"],
            where: {
                field: "key",
                operator: "eq",
                value: INSTALLED_OPTION
            },
            limit: 1
        });

        if (Array.isArray(existingInstall.rows) && existingInstall.rows.length > 0) {
            throw new Error("ProWorkspace is already installed.");
        }

        const organizationResult = await db.insert({
            table: "organizations",
            values: {
                name: input.organizationName,
                status: "active",
                email_policy: input.emailPolicy,
                domain: input.domain,
                logo: "",
                slug: orgSlug
            },
            returning: ["id"]
        });

        const orgId = Number(organizationResult.insertedIds?.[0] ?? (organizationResult.rows?.[0] as { id?: number } | undefined)?.id);
        if (!Number.isFinite(orgId)) {
            throw new Error("Unable to create organization.");
        }

        const userResult = await db.insert({
            table: "users",
            values: {
                org_id: orgId,
                user_id: adminPublicId,
                first_name: input.adminFirstName,
                last_name: input.adminLastName,
                email: input.adminEmail,
                password: passwordHash,
                role: "administrator",
                status: "active"
            },
            returning: ["id"]
        });

        const userId = Number(userResult.insertedIds?.[0] ?? (userResult.rows?.[0] as { id?: number } | undefined)?.id);
        if (!Number.isFinite(userId)) {
            throw new Error("Unable to create admin user.");
        }

        await db.insert({
            table: "sites",
            values: buildDefaultSiteMappings(input.site).map((site) => ({
                org_id: orgId,
                site: site.site,
                "for": site.for,
                "active-identifier": createActiveIdentifier(),
                status: "active"
            }))
        });

        await db.insert({
            table: "groups",
            values: [
                { org_id: orgId, name: "administrator", description: "Full workspace administration", status: "active", capabilities: "*" },
                { org_id: orgId, name: "maintainer", description: "Workspace maintenance access", status: "active", capabilities: "maintain" },
                { org_id: orgId, name: "employee", description: "Default employee access", status: "active", capabilities: "read" }
            ]
        });

        await db.insert({
            table: "usermeta",
            values: [
                {
                    user_id: userId,
                    key: "roles",
                    value: "administrator"
                },
                {
                    user_id: userId,
                    key: "dob",
                    value: input.adminDob
                },
                {
                    user_id: userId,
                    key: "username",
                    value: input.adminUsername
                }
            ]
        });

        await db.insert({
            table: "org_options",
            values: [
                { org_id: orgId, key: "organization_mode", value: input.organizationMode, autoload: true },
                { org_id: orgId, key: "default_language", value: input.defaultLanguage, autoload: true },
                { org_id: orgId, key: "selected_email_users", value: selectedEmailUsers, autoload: true },
                { org_id: orgId, key: "signup_registration_mode", value: input.emailPolicy, autoload: true },
                { org_id: orgId, key: "signup_min_age", value: "13", autoload: true },
                { org_id: orgId, key: "signup_fixed_email_domain", value: input.domain, autoload: true },
                { org_id: orgId, key: "signup_temp_ttl_minutes", value: "30", autoload: true },
                { org_id: orgId, key: "auth_passkey_policy", value: "recommended", autoload: true },
                { org_id: orgId, key: "auth_email_2fa_policy", value: "recommended", autoload: true }
            ]
        });

        await db.insert({
            table: "options",
            values: {
                key: INSTALLED_OPTION,
                value: INSTALLED_VALUE,
                autoload: true
            }
        });

        return {
            orgId,
            userId
        };
    } catch (error) {
        throw error;
    }
};
