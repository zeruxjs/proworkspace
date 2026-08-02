import type { ZeruxRequestContext } from "zeruxjs";
import { escapeHtml } from "../../../lib/admin.ts";
import { renderAuthShell, requestPasswordReset } from "../../../lib/auth.ts";

const body = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};

const form = (message = "") => renderAuthShell("Forgot password", `<section class="panel auth-panel">
    <p>ProWorkspace Accounts</p><h1>Forgot password</h1>
    <p>Enter your account email and we will send a time-limited reset link.</p>
    <form method="post" class="form-grid" style="margin-top:16px">
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <button class="primary" type="submit">Send reset link</button>
    </form>
    ${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}
    <p style="margin-top:16px"><a href="/signin">Back to sign in</a></p>
</section>`);

export const GET = () => form();
export const POST = async (context: ZeruxRequestContext) => {
    const email = String(body(context.body).email || "").trim().toLowerCase();
    await requestPasswordReset(email);
    return form("If an active account matches that email, a reset link has been sent.");
};
