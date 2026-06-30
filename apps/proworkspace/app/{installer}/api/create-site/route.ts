import type { ZeruxRequestContext } from "zeruxjs";
import { RedirectType, redirect } from "zeruxjs/navigation";
import { createInstalledSite, type CreateSiteInput, type EmailPolicy, type OrganizationMode } from "../../../../lib/db.ts";
import { createAuthSessionForUser, isOldEnough } from "../../../../lib/auth.ts";
import { normalizeLanguage } from "../../../../lib/languages.ts";
import { requireInstallerMultisiteRequest } from "../../install/page.ts";

export const routePath = "/installer/api/create-site";

type RawBody = Record<string, unknown>;

const EMAIL_POLICIES = new Set<EmailPolicy>(["only_domain", "selected_email_users", "anyone"]);
const ORGANIZATION_MODES = new Set<OrganizationMode>(["single", "multi"]);

const asBodyObject = (body: unknown): RawBody => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
        return body as RawBody;
    }

    if (typeof body === "string") {
        return Object.fromEntries(new URLSearchParams(body).entries());
    }

    return {};
};

const stringValue = (body: RawBody, key: string) => {
    const value = body[key];
    return typeof value === "string" ? value.trim() : "";
};

const normalizeDomain = (value: string) =>
    value
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split(":")[0]
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, "");

const normalizeSite = (value: string, fallback: string) =>
    (value || fallback)
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .toLowerCase();

const normalizeText = (value: string, max = 190) =>
    value.replace(/\s+/g, " ").trim().slice(0, max);

const normalizeUsername = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "").slice(0, 64);

const normalizeEmails = (value: string) =>
    [...new Set(value
        .split(/[\n,]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean))];

const isEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const emailDomain = (email: string) =>
    email.split("@")[1]?.toLowerCase() ?? "";

const hostFromContext = (context: ZeruxRequestContext) => {
    const host = context.req.headers.host;
    return Array.isArray(host) ? host[0] ?? "localhost" : host ?? "localhost";
};

const error = (message: string, details?: Record<string, unknown>) => ({
    error: true,
    message,
    ...(details ? { details } : {})
});

const validatePayload = (context: ZeruxRequestContext): CreateSiteInput => {
    const body = asBodyObject(context.body);
    const organizationMode = stringValue(body, "organizationMode") as OrganizationMode;
    const emailPolicy = stringValue(body, "emailPolicy") as EmailPolicy;
    const organizationName = normalizeText(stringValue(body, "organizationName"));
    const adminUsername = normalizeUsername(stringValue(body, "adminUsername"));
    const adminDob = stringValue(body, "adminDob");
    const adminFirstName = normalizeText(stringValue(body, "adminFirstName"), 120);
    const adminLastName = normalizeText(stringValue(body, "adminLastName"), 120);
    const adminPassword = stringValue(body, "adminPassword");
    const defaultLanguage = normalizeLanguage(stringValue(body, "defaultLanguage"));
    const site = normalizeSite(stringValue(body, "site"), hostFromContext(context));
    const domain = normalizeDomain(stringValue(body, "domain") || site);
    const adminEmail = `${adminUsername}@${domain}`;
    const selectedEmailUsers = normalizeEmails(stringValue(body, "selectedEmailUsers"));
    const acceptsPrivacy = stringValue(body, "acceptPrivacy") === "yes";
    const acceptsDataHandling = stringValue(body, "acceptDataHandling") === "yes";
    const acceptsTerms = stringValue(body, "acceptTerms") === "yes";

    if (!acceptsPrivacy || !acceptsDataHandling || !acceptsTerms) {
        throw new Error("Review and accept the privacy, data handling, and terms notices before continuing.");
    }

    if (!ORGANIZATION_MODES.has(organizationMode)) {
        throw new Error("Choose one organization or multi-organization mode.");
    }

    if (organizationName.length < 2) {
        throw new Error("Organization name must be at least 2 characters.");
    }

    if (!EMAIL_POLICIES.has(emailPolicy)) {
        throw new Error("Choose a valid email policy.");
    }

    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
        throw new Error("Enter a valid organization email domain.");
    }

    if (adminUsername.length < 3) {
        throw new Error("Admin username must be at least 3 characters.");
    }

    if (!isOldEnough(adminDob, 13)) {
        throw new Error("Admin date of birth must be valid and at least 13 years old.");
    }

    if (!isEmail(adminEmail)) {
        throw new Error("Enter a valid admin username.");
    }

    if (adminPassword.length < 8) {
        throw new Error("Admin password must be at least 8 characters.");
    }

    if (!adminFirstName || !adminLastName) {
        throw new Error("Admin first name and last name are required.");
    }

    if (emailPolicy === "only_domain" && emailDomain(adminEmail) !== domain) {
        throw new Error("Admin email must use the selected organization domain.");
    }

    if (emailPolicy === "selected_email_users") {
        if (selectedEmailUsers.length === 0 || selectedEmailUsers.some((email) => !isEmail(email))) {
            throw new Error("Selected email users must contain valid email addresses.");
        }

        if (!selectedEmailUsers.includes(adminEmail)) {
            throw new Error("Admin email must be included in selected email users.");
        }
    }

    return {
        organizationMode,
        organizationName,
        emailPolicy,
        domain,
        selectedEmailUsers,
        adminEmail,
        adminUsername,
        adminDob,
        adminPassword,
        adminFirstName,
        adminLastName,
        defaultLanguage,
        site
    };
};

export const POST = async (context: ZeruxRequestContext) => {
    try {
        requireInstallerMultisiteRequest(context);

        const payload = validatePayload(context);
        const created = await createInstalledSite(payload);
        await createAuthSessionForUser(context, created.userId);

        const wantsJson = String(context.req.headers.accept ?? "").includes("application/json") ||
            String(context.req.headers["content-type"] ?? "").includes("application/json");

        if (wantsJson) {
            return {
                ok: true,
                redirect: "/"
            };
        }

        return redirect("/", RedirectType.SeeOther);
    } catch (caught) {
        return error(caught instanceof Error ? caught.message : "Unable to create site.");
    }
};
