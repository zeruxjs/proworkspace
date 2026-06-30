import type { ZeruxRequestContext } from "zeruxjs";
import { renderAdminPage } from "../../../lib/admin.ts";

export default (context: ZeruxRequestContext) =>
    renderAdminPage(context, {
        active: "groups",
        title: "Groups",
        body: () => `<section class="panel">
            <h2>Groups and roles</h2>
            <p>Review administrator, maintainer, and employee groups before assigning service permissions.</p>
        </section>`
    });
