import { HttpError, type ZeruxRequestContext } from "zeruxjs";
import { renderAdminPage, serviceAdminBody, serviceLabel } from "../../../../lib/admin.ts";
import { SITE_SERVICES, type SiteService } from "../../../../lib/db.ts";

const isAdminService = (service: string): service is Exclude<SiteService, "accounts"> =>
    SITE_SERVICES.includes(service as Exclude<SiteService, "accounts">);

export default (context: ZeruxRequestContext) => {
    const service = context.params.service ?? "";

    if (!isAdminService(service)) {
        throw new HttpError(404, "Service not found.");
    }

    return renderAdminPage(context, {
        active: service,
        title: serviceLabel(service),
        body: serviceAdminBody(service)
    });
};
