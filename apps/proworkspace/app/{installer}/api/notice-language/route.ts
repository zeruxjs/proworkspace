import type { ZeruxRequestContext } from "zeruxjs";
import { normalizeLanguage } from "../../../../lib/languages.ts";
import { NOTICE_COPY, requireInstallerMultisiteRequest } from "../../install/page.ts";

export const routePath = "/installer/api/notice-language";

export const GET = (context: ZeruxRequestContext) => {
    requireInstallerMultisiteRequest(context);

    const language = normalizeLanguage(context.query.get("language") ?? "");

    return NOTICE_COPY[language] ?? NOTICE_COPY.en;
};
