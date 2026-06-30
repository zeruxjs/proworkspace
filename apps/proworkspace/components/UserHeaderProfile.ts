import type { CurrentUser } from "../lib/auth.ts";

export type UserHeaderProfileLink = {
    label: string;
    href: string;
    capability?: string;
};

export type UserHeaderProfileProps = {
    user: CurrentUser | null;
    links?: UserHeaderProfileLink[];
    showApps?: boolean;
};

const initials = (user: CurrentUser | null) => {
    if (!user) return "?";

    return `${user.first_name.slice(0, 1)}${user.last_name.slice(0, 1)}`.toUpperCase();
};

const escapeHtml = (value: unknown) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const canOpen = (user: CurrentUser | null, capability?: string) =>
    !capability || Boolean(user?.capabilities.includes("*") || user?.capabilities.includes(capability));

const defaultLinks: UserHeaderProfileLink[] = [
    { label: "Notes", href: "/notes" },
    { label: "Git", href: "/git" },
    { label: "Mail", href: "/mail" },
    { label: "Drive", href: "/drive" },
    { label: "Admin", href: "/admin", capability: "admin.access" },
    { label: "Account", href: "/" }
];

export const renderUserHeaderProfile = ({
    user,
    links = defaultLinks,
    showApps = true
}: UserHeaderProfileProps) => {
    const visibleLinks = links.filter((link) => canOpen(user, link.capability));

    if (!user) {
        return `<a class="profile-signin" href="/signin">Sign in</a>`;
    }

    return `<details class="user-profile-menu">
        <summary aria-label="Open account menu">
            <span class="avatar">${escapeHtml(initials(user))}</span>
        </summary>
        <div class="profile-popover">
            <div class="profile-head">
                <span class="avatar large">${escapeHtml(initials(user))}</span>
                <div>
                    <strong>${escapeHtml(`${user.first_name} ${user.last_name}`)}</strong>
                    <span>${escapeHtml(user.email)}</span>
                </div>
            </div>
            ${showApps ? `<div class="profile-apps">${visibleLinks.map((link) =>
                `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
            ).join("")}</div>` : ""}
            <div class="profile-actions">
                <a href="/">Manage account</a>
                <a href="/signin">Switch account</a>
            </div>
        </div>
    </details>`;
};

export default renderUserHeaderProfile;
