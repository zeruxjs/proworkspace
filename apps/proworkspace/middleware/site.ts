import type { ZeruxRequestContext } from "zeruxjs";
import { siteActiveResponse } from "../lib/site-active.ts";

type SiteRow = {
    site?: unknown;
    for?: unknown;
    status?: unknown;
};

type SiteRegistration = {
    url: string;
    folder: string;
    host: string;
    pathname: string;
};

const isSiteActivePath = (pathname: string) =>
    pathname === "/api/site-active" || pathname.endsWith("/api/site-active");

const sanitizePathname = (pathname: string) => {
    if (!pathname || pathname === "/") return "/";

    const normalized = pathname.replace(/\/+/g, "/");

    return normalized.endsWith("/") && normalized !== "/" ? normalized.slice(0, -1) : normalized;
};

const normalizeHost = (host: string) =>
    host.split(":")[0].toLowerCase();

const normalizeFolder = (folder: string) =>
    folder.trim().replace(/^\/+|\/+$/g, "");

const parseSiteRegistration = (url: string, folder: string): SiteRegistration => {
    const parsed = new URL(url.includes("://") ? url : `http://${url}`);

    return {
        url,
        folder: normalizeFolder(folder),
        host: normalizeHost(parsed.host),
        pathname: sanitizePathname(parsed.pathname)
    };
};

const matchesPath = (registeredPath: string, pathname: string) =>
    registeredPath === "/" || pathname === registeredPath || pathname.startsWith(`${registeredPath}/`);

const findRegistration = (host: string, pathname: string, registrations: SiteRegistration[]) =>
    [...registrations]
        .sort((left, right) =>
            right.pathname.split("/").filter(Boolean).length - left.pathname.split("/").filter(Boolean).length ||
            right.pathname.length - left.pathname.length
        )
        .find((registration) =>
            registration.host === normalizeHost(host) &&
            matchesPath(registration.pathname, pathname)
        );

export default (context: ZeruxRequestContext, next: () => Promise<void>) => {
    if (context.state.site === 'installer') {
        if (context.pathname !== "/installer" && !context.pathname.startsWith("/installer/")) {
            context.multisiteRegister("*", "installer");
        }
    } else {
        const sites = Array.isArray(context.state.sites) ? context.state.sites as SiteRow[] : [];
        const registrations: SiteRegistration[] = [];

        sites.forEach((site) => {
            const url = typeof site.site === "string" ? site.site : "";
            const folder = typeof site.for === "string" ? `{${site.for}}` : "";

            if (site.status === "active" && url && folder) {
                context.multisiteRegister(url, folder);
                registrations.push(parseSiteRegistration(url, folder));
            }
        });

        const host = Array.isArray(context.req.headers.host)
            ? context.req.headers.host[0] ?? ""
            : context.req.headers.host ?? "";
        const match = findRegistration(host, context.pathname, registrations);

        if (match) {
            const suffix = match.pathname === "/"
                ? context.pathname
                : context.pathname.slice(match.pathname.length);
            const folderPath = sanitizePathname(`/${match.folder}`);
            const pathname = context.pathname === folderPath || context.pathname.startsWith(`${folderPath}/`)
                ? context.pathname
                : sanitizePathname(`${folderPath}${suffix === "/" ? "" : suffix}`);

            context.state.multisite = {
                enabled: true,
                originalPathname: context.pathname,
                pathname,
                url: match.url,
                folderName: match.folder
            };

            context.pathname = pathname;
            context.url.pathname = pathname;
        }
    }

    if (context.method === "GET" && isSiteActivePath(context.pathname)) {
        return siteActiveResponse(context);
    }

    return next();
};
