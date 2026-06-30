import { db } from "db";
import type { ZeruxRequestContext } from "zeruxjs";
import { getThemeIcon, getThemeLabel, getThemeMode } from "zeruxjs/theme";
import { renderUserHeaderProfile } from "../components/UserHeaderProfile.ts";
import { requireAdminPage } from "./auth.ts";
import {
    SITE_SERVICE_ORDER,
    SITE_SERVICES,
    type SiteService,
    normalizeSiteMapping,
    normalizeSitePath
} from "./db.ts";

type SiteRow = {
    id: number;
    org_id: number;
    site: string;
    for: SiteService;
    status: string;
    "active-identifier": string;
    reachable?: boolean;
    created_at?: string;
    updated_at?: string;
};

type OrganizationRow = {
    id: number;
    name: string;
    domain: string;
    status: string;
};

type AdminModel = {
    organization: OrganizationRow | null;
    sites: SiteRow[];
    adminSite: SiteRow | null;
    basePath: string;
};

type RenderOptions = {
    active: string;
    title: string;
    eyebrow?: string;
    checkSiteActive?: boolean;
    body: (model: AdminModel) => string;
};

const NAV_ITEMS = [
    { key: "home", label: "Home", href: "" },
    { key: "users", label: "Users", href: "/users" },
    { key: "groups", label: "Groups", href: "/groups" },
    { key: "apps", label: "Apps", href: "/apps" },
    { key: "domains", label: "Domains", href: "/domains" },
    { key: "dns", label: "DNS", href: "/dns" },
    { key: "security", label: "Security", href: "/security" },
    { key: "settings", label: "Settings", href: "/settings" }
];

const SERVICE_LABELS: Record<string, string> = {
    accounts: "Accounts",
    dns: "DNS",
    notes: "Notes",
    mail: "Mail",
    admin: "Admin",
    ai: "AI",
    chat: "Chat",
    drive: "Drive",
    forms: "Forms",
    git: "Git",
    office: "Office",
    passwords: "Passwords",
    tools: "Tools"
};

export const escapeHtml = (value: unknown) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const sitePath = (site: string) => {
    const [, ...pathParts] = site.split("/");
    return normalizeSitePath(pathParts.join("/"));
};

const siteHost = (site: string) => site.split("/")[0] ?? "";

const routeHref = (basePath: string, href: string) => {
    const base = basePath || "";
    return `${base}${href || ""}` || "/";
};

const serviceHref = (model: AdminModel, site: SiteRow) => {
    const adminHost = model.adminSite ? siteHost(model.adminSite.site) : "";
    const targetHost = siteHost(site.site);
    const targetPath = sitePath(site.site) || "/";

    return adminHost === targetHost ? targetPath : `//${site.site}`;
};

export const serviceLabel = (service: string) => SERVICE_LABELS[service] ?? service;

export const allowedSiteService = (service: string): service is SiteService =>
    SITE_SERVICE_ORDER.includes(service as SiteService);

const orderedServiceSites = (sites: SiteRow[]) =>
    [...sites].sort((left, right) =>
        SITE_SERVICE_ORDER.indexOf(left.for) - SITE_SERVICE_ORDER.indexOf(right.for) ||
        left.id - right.id
    );

const firstSiteByService = (sites: SiteRow[]) => {
    const byService = new Map<SiteService, SiteRow>();

    orderedServiceSites(sites).forEach((site) => {
        if (!byService.has(site.for)) {
            byService.set(site.for, site);
        }
    });

    return byService;
};

const withTimeout = (timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    return {
        signal: controller.signal,
        done: () => clearTimeout(timeout)
    };
};

const activeCheckUrl = (site: SiteRow) => {
    const host = siteHost(site.site);
    if (!host || host === "*") {
        return "";
    }

    return `http://${site.site.replace(/\/+$/g, "")}/api/site-active?identifier=${encodeURIComponent(site["active-identifier"])}`;
};

export const checkSiteReachable = async (site: SiteRow) => {
    if (!site["active-identifier"]) {
        return false;
    }

    const url = activeCheckUrl(site);
    if (!url) {
        return false;
    }

    // TODO: Add Redis-backed cache support for this active check with a 30m TTL.
    const timeout = withTimeout(1500);
    try {
        const response = await fetch(url, {
            headers: { accept: "application/json" },
            signal: timeout.signal
        });
        const result = await response.json().catch(() => null) as { active?: unknown; site?: unknown } | null;

        return response.ok && result?.active === true && result.site === site.site;
    } catch {
        return false;
    } finally {
        timeout.done();
    }
};

const addReachability = async (sites: SiteRow[]) => {
    const checks = await Promise.all(sites.map(async (site) => ({
        ...site,
        reachable: await checkSiteReachable(site)
    })));

    return checks;
};

export const getAdminModel = async (options: { checkSiteActive?: boolean } = {}): Promise<AdminModel> => {
    const sitesResult = await db.select({
        table: "sites",
        columns: ["id", "org_id", "site", "for", "active-identifier", "status", "created_at", "updated_at"],
        orderBy: [{ by: "id", direction: "asc" }]
    });

    const dbSites = (Array.isArray(sitesResult.rows) ? sitesResult.rows : []) as SiteRow[];
    const sites = orderedServiceSites(options.checkSiteActive ? await addReachability(dbSites) : dbSites);
    const adminSite = sites.find((site) => site.for === "admin") ?? null;
    const orgId = adminSite?.org_id ?? sites[0]?.org_id;

    let organization: OrganizationRow | null = null;
    if (Number.isFinite(Number(orgId))) {
        const organizationResult = await db.select({
            table: "organizations",
            columns: ["id", "name", "domain", "status"],
            where: {
                field: "id",
                operator: "eq",
                value: Number(orgId)
            },
            limit: 1
        });
        organization = ((Array.isArray(organizationResult.rows) ? organizationResult.rows[0] : null) as OrganizationRow | undefined) ?? null;
    }

    return {
        organization,
        sites,
        adminSite,
        basePath: adminSite ? sitePath(adminSite.site) : "/admin"
    };
};

export const normalizeAdminSiteInput = (domain: string, path: string) => {
    const rawDomain = domain
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split(":")[0]
        .toLowerCase();
    const normalizedDomain = normalizeSiteMapping(domain).split("/")[0] ?? "";
    const rawPath = path.trim();
    const normalizedPath = normalizeSitePath(path);

    if (
        rawDomain !== normalizedDomain ||
        !normalizedDomain ||
        !/^(?:\*|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(normalizedDomain)
    ) {
        throw new Error("Enter a valid domain.");
    }

    if (
        (rawPath && !/^\/?[a-zA-Z0-9/_~-]*$/.test(rawPath)) ||
        rawPath.replace(/^\/+|\/+$/g, "").split("/").some((part) => part === "." || part === "..")
    ) {
        throw new Error("Enter a valid path.");
    }

    return `${normalizedDomain}${normalizedPath}`;
};

export const serviceCards = (model: AdminModel) => {
    const byService = firstSiteByService(model.sites);

    return SITE_SERVICE_ORDER.map((service) => {
        const site = byService.get(service as SiteService);
        const status = site?.status ?? "missing";
        const reachableStatus = site?.reachable === undefined
            ? status
            : site.reachable
                ? "reachable"
                : "unreachable";
        const href = service === "admin" ? routeHref(model.basePath, "") : site ? serviceHref(model, site) : "#";

        return `<article class="service-card">
            <div class="service-icon">${escapeHtml(serviceLabel(service).slice(0, 1))}</div>
            <div>
                <h3>${escapeHtml(serviceLabel(service))}</h3>
                <p>${escapeHtml(site?.site ?? "Not configured")}</p>
            </div>
            <span class="status ${escapeHtml(reachableStatus)}">${escapeHtml(reachableStatus)}</span>
            <a href="${href}" ${site ? "" : "aria-disabled=\"true\""}>Open</a>
        </article>`;
    }).join("");
};

export const domainRows = (model: AdminModel) =>
    orderedServiceSites(model.sites).map((site) => `<tr>
        <td>${escapeHtml(serviceLabel(site.for))}</td>
        <td><code>${escapeHtml(siteHost(site.site))}</code></td>
        <td><code>${escapeHtml(sitePath(site.site) || "/")}</code></td>
        <td><code>${escapeHtml(site["active-identifier"])}</code></td>
        <td><span class="status ${escapeHtml(site.status)}">${escapeHtml(site.status)}</span></td>
        <td><span class="status ${site.reachable ? "reachable" : "unreachable"}">${site.reachable ? "reachable" : "unreachable"}</span></td>
        <td>
            <button
                class="danger-button"
                type="button"
                data-admin-site-delete="true"
                data-site-id="${escapeHtml(site.id)}"
                data-site="${escapeHtml(site.site)}"
                data-domain="${escapeHtml(siteHost(site.site))}"
                data-path="${escapeHtml(sitePath(site.site) || "/")}"
            >Delete</button>
        </td>
    </tr>`).join("");

export const serviceOptions = () =>
    SITE_SERVICE_ORDER.map((service) =>
        `<option value="${escapeHtml(service)}">${escapeHtml(serviceLabel(service))}</option>`
    ).join("");

export const settingsShortcuts = (model: AdminModel) =>
    NAV_ITEMS
        .filter((item) => item.key !== "home")
        .map((item) => `<a class="shortcut-card" data-soft href="${escapeHtml(routeHref(model.basePath, item.href))}">
            <strong>${escapeHtml(item.label)}</strong>
            <span>Open ${escapeHtml(item.label.toLowerCase())}</span>
        </a>`)
        .join("");

export const serviceAdminBody = (service: string) => (model: AdminModel) => {
    const site = model.sites.find((entry) => entry.for === service);

    return `<section class="panel">
        <h2>${escapeHtml(serviceLabel(service))} settings</h2>
        <div class="grid">
            <div>
                <p>Route</p>
                <strong>${escapeHtml(site?.site ?? "Not configured")}</strong>
            </div>
            <div>
                <p>Status</p>
                <span class="status ${escapeHtml(site?.status ?? "missing")}">${escapeHtml(site?.status ?? "missing")}</span>
            </div>
            <div>
                <p>Service key</p>
                <strong>${escapeHtml(service)}</strong>
            </div>
        </div>
    </section>
    <section class="panel" style="margin-top:16px">
        <h2>Access</h2>
        <p>Configure group access, data retention, and integration settings for this service.</p>
    </section>`;
};

export const renderAdminPage = async (context: ZeruxRequestContext, options: RenderOptions) => {
    const authResult = await requireAdminPage(context);
    if (typeof authResult === "string" || "__zeruxRedirect" in authResult) {
        return authResult;
    }

    const currentUser = authResult;
    const model = await getAdminModel({ checkSiteActive: options.checkSiteActive });
    const orgName = model.organization?.name ?? "ProWorkspace";
    const themeMode = getThemeMode(context);
    const themeLabel = getThemeLabel(themeMode);
    const themeIcon = getThemeIcon(themeMode, context);
    const navLinks = NAV_ITEMS.map((item) => {
        const active = item.key === options.active ? " active" : "";
        return `<a class="nav-item${active}" data-soft href="${escapeHtml(routeHref(model.basePath, item.href))}">${escapeHtml(item.label)}</a>`;
    }).join("");
    const serviceLinks = SITE_SERVICES.map((service) => {
        const active = service === options.active ? " active" : "";
        return `<a class="service-nav-item${active}" data-soft href="${escapeHtml(routeHref(model.basePath, `/services/${service}`))}">${escapeHtml(serviceLabel(service))}</a>`;
    }).join("");
    const servicesOpen = SITE_SERVICES.includes(options.active as Exclude<SiteService, "accounts">) ? " open" : "";
    const servicesActive = servicesOpen ? " active" : "";
    const profile = renderUserHeaderProfile({
        user: currentUser,
        links: [
            { label: "Notes", href: "/notes" },
            { label: "Git", href: "/git" },
            { label: "Mail", href: "/mail" },
            { label: "Drive", href: "/drive" },
            { label: "Admin", href: routeHref(model.basePath, ""), capability: "admin.access" },
            { label: "Account", href: "/" }
        ]
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(options.title)} - ProWorkspace Admin</title>
    <link rel="stylesheet" href="/admin/admin.css?v=20260520-1">
    <script defer src="/admin/admin.js?v=20260520-1"></script>
</head>
<body>
    <div class="shell">
        <div class="mobile-bar">
            <button class="icon-button" type="button" data-menu-toggle aria-label="Open navigation" aria-expanded="false">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path></svg>
            </button>
            <strong>${escapeHtml(orgName)}</strong>
            <button class="theme-toggle icon-button" type="button" data-theme-toggle data-theme-mode="${escapeHtml(themeMode)}" aria-label="Theme: ${escapeHtml(themeLabel)}" title="Theme: ${escapeHtml(themeLabel)}">
                <span data-theme-icon>${themeIcon}</span>
            </button>
        </div>
        <aside class="sidebar">
            <a class="brand" data-soft href="${escapeHtml(routeHref(model.basePath, ""))}">
                <span class="brand-mark">P</span>
                <span><strong>${escapeHtml(orgName)}</strong><small>Admin console</small></span>
            </a>
            <nav>
                ${navLinks}
                <details class="services-menu"${servicesOpen}>
                    <summary class="nav-item${servicesActive}">Services</summary>
                    <div class="service-nav">${serviceLinks}</div>
                </details>
            </nav>
        </aside>
        <main class="content">
            <header class="topbar">
                <div>
                    <p>${escapeHtml(options.eyebrow ?? "Admin console")}</p>
                    <h1>${escapeHtml(options.title)}</h1>
                </div>
                <div class="topbar-actions">
                    <button class="theme-toggle icon-button" type="button" data-theme-toggle data-theme-mode="${escapeHtml(themeMode)}" aria-label="Theme: ${escapeHtml(themeLabel)}" title="Theme: ${escapeHtml(themeLabel)}">
                        <span data-theme-icon>${themeIcon}</span>
                    </button>
                    <span class="domain-pill">${escapeHtml(model.adminSite?.site ?? "unmapped")}</span>
                    ${profile}
                </div>
            </header>
            <section id="adminView" class="view" aria-live="polite">
                ${options.body(model)}
            </section>
        </main>
    </div>
</body>
</html>`;
};
