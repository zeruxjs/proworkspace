import type { ZeruxRequestContext } from "zeruxjs";
import { renderAdminPage, serviceCards } from "../../../lib/admin.ts";

export default (context: ZeruxRequestContext) =>
    renderAdminPage(context, {
        active: "apps",
        title: "Apps",
        body: (model) => `<section class="panel">
            <h2>Service catalog</h2>
            <div class="service-grid">${serviceCards(model)}</div>
        </section>`
    });
