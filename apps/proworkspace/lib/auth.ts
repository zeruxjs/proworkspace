import crypto from "node:crypto";
import { db } from "db";
import type { RedirectResponse, ZeruxRequestContext } from "zeruxjs";
import { HttpError } from "zeruxjs";
import { RedirectType, redirect } from "zeruxjs/navigation";
import {
    createSession,
    createUser,
    getAuthConfig,
    getCapabilities,
    setAuthConfig,
    verifySession,
    verifyUser
} from "@zeruxjs/auth";

export const AUTH_COOKIE_NAME = "proworkspace_session";
const SIGNUP_TEMP_TABLE = "auth_signup_attempts";
const PASSWORD_RESET_TABLE = "auth_password_resets";

const escapeHtml = (value: unknown) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

type UserRow = {
    id: number;
    org_id: number;
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    status: string;
};

export type CurrentUser = UserRow & {
    capabilities: string[];
};

export type AuthPageResult = string | RedirectResponse;

const optionValue = (rows: unknown[] | undefined) => {
    const row = Array.isArray(rows) ? rows[0] as { value?: unknown } | undefined : undefined;

    return typeof row?.value === "string" ? row.value : "";
};

export const configureProworkspaceAuth = () => {
    setAuthConfig({
        db: {
            usersTable: "users",
            rolesTable: "groups",
            usermetaTable: "usermeta",
            fields: {
                userId: "id",
                email: "email",
                passwordHash: "password",
                role: "role"
            }
        },
        session: {
            cookieName: AUTH_COOKIE_NAME,
            expiresIn: Number(process.env.AUTH_SESSION_TTL_SECONDS || 86400)
        }
    });
};

configureProworkspaceAuth();

export const parseCookies = (cookieHeader: unknown) => {
    const cookies = new Map<string, string>();

    String(cookieHeader ?? "")
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => {
            const separator = entry.indexOf("=");
            if (separator === -1) return;

            cookies.set(
                decodeURIComponent(entry.slice(0, separator)),
                decodeURIComponent(entry.slice(separator + 1))
            );
        });

    return cookies;
};

const secureCookie = (context: ZeruxRequestContext) => {
    const proto = String(context.req.headers["x-forwarded-proto"] ?? "").toLowerCase();
    const socket = context.req.socket as typeof context.req.socket & { encrypted?: boolean };

    return proto === "https" || socket.encrypted === true;
};

export const setSessionCookie = (context: ZeruxRequestContext, token: string) => {
    const maxAge = getAuthConfig().session.expiresIn;
    const mainDomain = (process.env.MAIN_DOMAIN || "").trim().replace(/^\.+|\.+$/g, "");
    const cookie = [
        `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
        "Path=/",
        mainDomain && mainDomain !== "localhost" ? `Domain=.${mainDomain}` : "",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${maxAge}`,
        secureCookie(context) ? "Secure" : ""
    ].filter(Boolean).join("; ");

    context.res.setHeader("Set-Cookie", cookie);
};

export const clearSessionCookie = (context: ZeruxRequestContext) => {
    const mainDomain = (process.env.MAIN_DOMAIN || "").trim().replace(/^\.+|\.+$/g, "");
    const cookie = [
        `${AUTH_COOKIE_NAME}=`,
        "Path=/",
        mainDomain && mainDomain !== "localhost" ? `Domain=.${mainDomain}` : "",
        "HttpOnly",
        "SameSite=Lax",
        "Max-Age=0"
    ].filter(Boolean).join("; ");
    context.res.setHeader("Set-Cookie", cookie);
};

export const getCurrentUser = async (context: ZeruxRequestContext): Promise<CurrentUser | null> => {
    const token = parseCookies(context.req.headers.cookie).get(AUTH_COOKIE_NAME);
    if (!token) return null;

    const session = verifySession(token);
    if (!session) return null;

    const result = await db.select({
        table: "users",
        columns: ["id", "org_id", "user_id", "first_name", "last_name", "email", "role", "status"],
        where: {
            field: "id",
            operator: "eq",
            value: Number(session.userId)
        },
        limit: 1
    });
    const user = Array.isArray(result.rows) ? result.rows[0] as UserRow | undefined : undefined;
    if (!user || user.status !== "active") return null;

    const capabilities = await getCapabilities(user.role, db, user.org_id);

    return {
        ...user,
        capabilities
    };
};

export const hasAnyCapability = (user: CurrentUser | null, capability: string) =>
    Boolean(user?.capabilities.includes("*") || user?.capabilities.includes(capability));

export const requireCapability = async (
    context: ZeruxRequestContext,
    capability: string
): Promise<CurrentUser> => {
    const user = await getCurrentUser(context);

    if (!user) {
        throw new HttpError(401, "Sign in is required.");
    }

    if (!hasAnyCapability(user, capability)) {
        throw new HttpError(403, "You do not have access to this area.");
    }

    return user;
};

export const requireAdminPage = async (context: ZeruxRequestContext) => {
    const user = await getCurrentUser(context);

    if (!user) {
        const multisite = typeof context.state.multisite === "object" && context.state.multisite !== null
            ? context.state.multisite as { originalPathname?: unknown }
            : null;
        const publicPathname = typeof multisite?.originalPathname === "string"
            ? multisite.originalPathname
            : context.url.pathname;
        const mainDomain = (process.env.MAIN_DOMAIN || "").trim().replace(/^\.+|\.+$/g, "");
        const authLabel = (process.env.AUTH_DOMAIN || "accounts").trim().replace(/^\.+|\.+$/g, "");
        const forwardedProto = String(context.req.headers["x-forwarded-proto"] || "https").split(",")[0]?.trim() || "https";
        const forwardedHost = String(context.req.headers["x-forwarded-host"] || context.req.headers.host || "").split(",")[0]?.trim() || "";
        const returnUrl = forwardedHost
            ? `${forwardedProto}://${forwardedHost}${publicPathname}${context.url.search}`
            : publicPathname + context.url.search;
        const next = encodeURIComponent(returnUrl);
        const signInOrigin = mainDomain && mainDomain !== "localhost"
            ? `${forwardedProto}://${authLabel ? `${authLabel}.` : ""}${mainDomain}`
            : "";
        return redirect(`${signInOrigin}/signin?next=${next}`, RedirectType.SeeOther);
    }

    if (!hasAnyCapability(user, "admin.access")) {
        return renderAuthShell("Access denied", `<section class="panel auth-panel">
            <h1>Access denied</h1>
            <p>Your account does not have permission to open the admin console.</p>
        </section>`);
    }

    return user;
};

export const ensureAuthTables = async () => {
    await db.createTable({
        table: SIGNUP_TEMP_TABLE,
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "org_id", type: "integer", notNull: true },
            { name: "email", type: "varchar", length: 190, notNull: true },
            { name: "payload", type: "text", notNull: true },
            { name: "status", type: "varchar", length: 40, notNull: true, default: "pending" },
            { name: "expires_at", type: "timestamp", notNull: true },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });

    await db.createTable({
        table: PASSWORD_RESET_TABLE,
        ifNotExists: true,
        columns: [
            { name: "id", type: "integer", primary: true, autoIncrement: true },
            { name: "user_id", type: "integer", notNull: true, foreign: { table: "users", column: "id", onDelete: "cascade" } },
            { name: "token_hash", type: "varchar", length: 64, notNull: true, unique: true },
            { name: "expires_at", type: "timestamp", notNull: true },
            { name: "used_at", type: "timestamp" },
            { name: "created_at", type: "timestamp", notNull: true, default: { kind: "function", name: "CURRENT_TIMESTAMP" } }
        ]
    });
};

const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const passwordHash = (password: string) => {
    const salt = crypto.randomBytes(16).toString("hex");
    return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
};

export const requestPasswordReset = async (email: string) => {
    await ensureAuthTables();
    const result = await db.select({
        table: "users",
        columns: ["id", "email"],
        where: { and: [
            { field: "email", operator: "eq", value: normalizeEmail(email) },
            { field: "status", operator: "eq", value: "active" }
        ] },
        limit: 1
    });
    const user = Array.isArray(result.rows) ? result.rows[0] as { id?: unknown; email?: unknown } | undefined : undefined;
    if (!user || !Number.isFinite(Number(user.id)) || typeof user.email !== "string") return;

    const token = crypto.randomBytes(32).toString("base64url");
    const ttlMinutes = Math.max(5, Number(process.env.AUTH_RESET_TTL_MINUTES || 30));
    await db.insert({
        table: PASSWORD_RESET_TABLE,
        values: {
            user_id: Number(user.id),
            token_hash: tokenHash(token),
            expires_at: new Date(Date.now() + ttlMinutes * 60_000).toISOString()
        }
    });

    const apiKey = process.env.RESEND_API_KEY || "";
    if (!apiKey) return;
    const mainDomain = (process.env.MAIN_DOMAIN || "localhost").replace(/^\.+|\.+$/g, "");
    const accounts = (process.env.AUTH_DOMAIN || "accounts").replace(/^\.+|\.+$/g, "");
    const resetUrl = `https://${accounts}.${mainDomain}/reset-password?token=${encodeURIComponent(token)}`;
    await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
            from: process.env.AUTH_FROM_EMAIL || `ProWorkspace <accounts@${mainDomain}>`,
            to: [user.email],
            subject: "Reset your ProWorkspace password",
            html: `<p>Use the link below to reset your password. It expires in ${ttlMinutes} minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`
        })
    });
};

export const resetPasswordWithToken = async (token: string, password: string) => {
    await ensureAuthTables();
    if (token.length < 32 || password.length < 10) return false;
    const result = await db.select({
        table: PASSWORD_RESET_TABLE,
        columns: ["id", "user_id", "expires_at", "used_at"],
        where: { field: "token_hash", operator: "eq", value: tokenHash(token) },
        limit: 1
    });
    const reset = Array.isArray(result.rows) ? result.rows[0] as { id?: unknown; user_id?: unknown; expires_at?: unknown; used_at?: unknown } | undefined : undefined;
    if (!reset || reset.used_at || new Date(String(reset.expires_at)).getTime() <= Date.now()) return false;
    await db.update({ table: "users", values: { password: passwordHash(password) }, where: { field: "id", operator: "eq", value: Number(reset.user_id) } });
    await db.update({ table: PASSWORD_RESET_TABLE, values: { used_at: new Date().toISOString() }, where: { field: "id", operator: "eq", value: Number(reset.id) } });
    return true;
};

export const cleanupExpiredSignupAttempts = async () => {
    await ensureAuthTables();

    return db.delete({
        table: SIGNUP_TEMP_TABLE,
        where: {
            field: "expires_at",
            operator: "lt",
            value: new Date().toISOString()
        }
    });
};

export const createSignupAttempt = async (orgId: number, email: string, payload: Record<string, unknown>) => {
    await ensureAuthTables();

    return db.insert({
        table: SIGNUP_TEMP_TABLE,
        values: {
            org_id: orgId,
            email,
            payload: JSON.stringify(payload),
            status: "pending_verification",
            expires_at: new Date(Date.now() + Number(process.env.AUTH_SIGNUP_TEMP_TTL_MINUTES || 30) * 60_000).toISOString()
        },
        returning: ["id"]
    });
};

export const deleteSignupAttempt = async (orgId: number, email: string) =>
    db.delete({
        table: SIGNUP_TEMP_TABLE,
        where: {
            and: [
                { field: "org_id", operator: "eq", value: orgId },
                { field: "email", operator: "eq", value: email }
            ]
        }
    });

export const getPrimaryOrganization = async () => {
    const result = await db.select({
        table: "organizations",
        columns: ["id", "name", "domain", "email_policy", "status"],
        where: {
            field: "status",
            operator: "eq",
            value: "active"
        },
        orderBy: [{ by: "id", direction: "asc" }],
        limit: 1
    });

    return Array.isArray(result.rows) ? result.rows[0] as {
        id: number;
        name: string;
        domain: string;
        email_policy: string;
        status: string;
    } | undefined : undefined;
};

export const getOrgOption = async (orgId: number, key: string, fallback = "") => {
    const result = await db.select({
        table: "org_options",
        columns: ["value"],
        where: {
            and: [
                { field: "org_id", operator: "eq", value: orgId },
                { field: "key", operator: "eq", value: key }
            ]
        },
        limit: 1
    });

    return optionValue(result.rows) || fallback;
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isOldEnough = (dob: string, minAge: number) => {
    const date = new Date(`${dob}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return false;

    const today = new Date();
    const threshold = new Date(Date.UTC(today.getUTCFullYear() - minAge, today.getUTCMonth(), today.getUTCDate()));

    return date <= threshold;
};

export const createAuthSessionForUser = async (context: ZeruxRequestContext, userId: number) => {
    const token = createSession(userId, {
        nonce: crypto.randomUUID()
    });
    setSessionCookie(context, token);
};

export const signInWithPassword = async (context: ZeruxRequestContext, email: string, password: string) => {
    const user = await verifyUser(email, password, db) as UserRow | false;

    if (!user || user.status !== "active") {
        return null;
    }

    await createAuthSessionForUser(context, Number(user.id));

    return user;
};

export const createActiveUser = async (values: {
    orgId: number;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    dob: string;
    gender: string;
}) => {
    const created = await createUser(values.email, values.password, "employee", db, {
        org_id: values.orgId,
        user_id: crypto.randomUUID(),
        first_name: values.firstName,
        last_name: values.lastName,
        status: "active"
    });
    const userId = Number(created.insertedIds?.[0] ?? (created.rows?.[0] as { id?: number } | undefined)?.id);
    if (!Number.isFinite(userId)) {
        throw new Error("Unable to create account.");
    }

    await db.insert({
        table: "usermeta",
        values: [
            { user_id: userId, key: "dob", value: values.dob },
            { user_id: userId, key: "gender", value: values.gender },
            { user_id: userId, key: "email_2fa_enabled", value: "recommended" },
            { user_id: userId, key: "passkey_enabled", value: "recommended" }
        ]
    });

    return userId;
};

export const renderAuthShell = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - ProWorkspace Accounts</title>
    <link rel="stylesheet" href="/admin/admin.css?v=20260520-1">
</head>
<body>
    <main class="content auth-content">
        ${body}
    </main>
</body>
</html>`;
