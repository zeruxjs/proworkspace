import type { ZeruxRequestContext } from "zeruxjs";
import { renderAdminPage } from "../../../lib/admin.ts";

export default (context: ZeruxRequestContext) =>
    renderAdminPage(context, {
        active: "users",
        title: "Users",
        body: () => `<section class="panel">
            <h2>User directory</h2>
            <p>Manage administrators, employees, account state, and recovery policies from this area.</p>
        </section>`
    });
