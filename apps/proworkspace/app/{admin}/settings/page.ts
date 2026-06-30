import type { ZeruxRequestContext } from "zeruxjs";
import { escapeHtml, renderAdminPage } from "../../../lib/admin.ts";

export default (context: ZeruxRequestContext) =>
    renderAdminPage(context, {
        active: "settings",
        title: "Settings",
        body: (model) => `<section class="panel">
            <h2>Organization profile</h2>
            <div class="grid">
                <div>
                    <p>Name</p>
                    <strong>${escapeHtml(model.organization?.name ?? "Unknown")}</strong>
                </div>
                <div>
                    <p>Email domain</p>
                    <strong>${escapeHtml(model.organization?.domain ?? "Unknown")}</strong>
                </div>
                <div>
                    <p>Status</p>
                    <span class="status ${escapeHtml(model.organization?.status ?? "missing")}">${escapeHtml(model.organization?.status ?? "missing")}</span>
                </div>
            </div>
        </section>
        <section class="panel" style="margin-top:16px">
            <h2>Security posture</h2>
            <p>Admin changes are sent through JSON APIs with server-side validation and normalized output. Add authentication middleware before exposing this console publicly.</p>
        </section>`
    });
