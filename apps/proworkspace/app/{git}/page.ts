import type { ZeruxRequestContext } from "zeruxjs";
import { renderServicePage } from "../../lib/service-page.ts";

export default (context: ZeruxRequestContext) => renderServicePage(context, "Git");
