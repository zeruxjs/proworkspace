import type { ZeruxRequestContext } from "zeruxjs";
import { renderAdminPage } from "../../../lib/admin.ts";

export default (context: ZeruxRequestContext) =>
    renderAdminPage(context, {
        active: "security",
        title: "Security",
        body: () => `<section class="panel">
            <h2>Security controls</h2>
            <p>Use this area for sign-in policy, audit review, and service access hardening.</p>
        </section>`
    });
