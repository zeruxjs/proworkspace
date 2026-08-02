import type { ZeruxRequestContext } from "zeruxjs";
import { escapeHtml } from "../../../lib/admin.ts";
import { renderAuthShell, resetPasswordWithToken } from "../../../lib/auth.ts";

const body = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const page = (token: string, message = "") => renderAuthShell("Reset password", `<section class="panel auth-panel">
    <p>ProWorkspace Accounts</p><h1>Reset password</h1>
    <form method="post" class="form-grid" style="margin-top:16px">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <label class="field"><span>New password</span><input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
        <label class="field"><span>Confirm password</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required></label>
        <button class="primary" type="submit">Reset password</button>
    </form>${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}
</section>`);

export const GET = (context: ZeruxRequestContext) => page(context.query.get("token") || "");
export const POST = async (context: ZeruxRequestContext) => {
    const values = body(context.body);
    const token = String(values.token || "");
    const password = String(values.password || "");
    if (password !== String(values.confirmPassword || "")) return page(token, "Passwords do not match.");
    const changed = await resetPasswordWithToken(token, password);
    return changed
        ? renderAuthShell("Password changed", `<section class="panel auth-panel"><h1>Password changed</h1><p>You can now <a href="/signin">sign in</a>.</p></section>`)
        : page(token, "This reset link is invalid or expired.");
};
