import type { ZeruxRequestContext } from "zeruxjs";
import { redirect, RedirectType } from "zeruxjs/navigation";
import { requireInstallerMultisiteRequest } from "./install/page.ts";

export const routePath = "/installer";

export default (context: ZeruxRequestContext) => {
    requireInstallerMultisiteRequest(context);

    return redirect("/install", RedirectType.Temporary);
}
