import type { ZeruxRequestContext } from "zeruxjs";
import { RedirectType, redirect } from "zeruxjs/navigation";
import { escapeHtml } from "../../../lib/admin.ts";
import { renderAuthShell, signInWithPassword } from "../../../lib/auth.ts";

const asBodyObject = (body: unknown): Record<string, unknown> => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
        return body as Record<string, unknown>;
    }

    if (typeof body === "string") {
        return Object.fromEntries(new URLSearchParams(body).entries());
    }

    return {};
};

const field = (body: Record<string, unknown>, key: string) =>
    typeof body[key] === "string" ? body[key].trim() : "";

const safeNext = (value: string) => {
    if (!value.startsWith("/") || value.startsWith("//")) {
        return "/";
    }

    const decoded = value.replace(/%7B/gi, "{").replace(/%7D/gi, "}");

    return decoded.replace(/^\/\{([a-z0-9_-]+)\}(?=\/|$)/i, "/$1");
};

const signInForm = (context: ZeruxRequestContext, message = "") => {
    const next = safeNext(context.query.get("next") ?? "/");

    return renderAuthShell("Sign in", `<section class="panel auth-panel">
        <p>ProWorkspace Accounts</p>
        <h1>Sign in</h1>
        <form method="post" class="form-grid" style="margin-top:16px">
            <input type="hidden" name="next" value="${escapeHtml(next)}">
            <label class="field">
                <span>Email</span>
                <input name="email" type="email" autocomplete="email" required>
            </label>
            <label class="field">
                <span>Password</span>
                <input name="password" type="password" autocomplete="current-password" required>
            </label>
            <button class="primary" type="submit">Sign in</button>
        </form>
        ${message ? `<p class="message error">${escapeHtml(message)}</p>` : ""}
        <p style="margin-top:16px"><a href="/signup">Create an account</a></p>
    </section>`);
};

export const GET = (context: ZeruxRequestContext) => signInForm(context);

export const POST = async (context: ZeruxRequestContext) => {
    const body = asBodyObject(context.body);
    const email = field(body, "email").toLowerCase();
    const password = field(body, "password");
    const next = safeNext(field(body, "next") || "/");
    const user = await signInWithPassword(context, email, password);

    if (!user) {
        return signInForm(context, "Email or password did not match an active account.");
    }

    return redirect(next, RedirectType.SeeOther);
};
