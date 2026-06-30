import type { ZeruxRequestContext } from "zeruxjs";
import { escapeHtml, renderAdminPage, settingsShortcuts } from "../../lib/admin.ts";

export default (context: ZeruxRequestContext) =>
    renderAdminPage(context, {
        active: "home",
        title: "Dashboard",
        checkSiteActive: true,
        body: (model) => `<div class="grid">
            <section class="panel metric">
                <p>Organization</p>
                <strong>${escapeHtml(model.organization?.name ?? "Unknown")}</strong>
            </section>
            <section class="panel metric">
                <p>Configured sites</p>
                <strong>${model.sites.length}</strong>
            </section>
            <section class="panel metric">
                <p>Primary admin route</p>
                <strong>${escapeHtml(model.adminSite?.site ?? "Missing")}</strong>
            </section>
        </div>
        <section class="panel" style="margin-top:16px">
            <h2>Settings</h2>
            <p>Jump into the admin areas from one place.</p>
            <div class="shortcut-grid">${settingsShortcuts(model)}</div>
        </section>`
    });
