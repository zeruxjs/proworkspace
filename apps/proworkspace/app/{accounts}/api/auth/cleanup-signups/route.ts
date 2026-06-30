import type { ZeruxRequestContext } from "zeruxjs";
import { cleanupExpiredSignupAttempts } from "../../../../../lib/auth.ts";

export const POST = async (context: ZeruxRequestContext) => {
    const expectedSecret = process.env.AUTH_CRON_SECRET;
    const providedSecret = String(context.req.headers["x-proworkspace-cron-secret"] ?? "");

    if (expectedSecret && providedSecret !== expectedSecret) {
        context.res.statusCode = 403;
        return {
            ok: false,
            message: "Forbidden"
        };
    }

    await cleanupExpiredSignupAttempts();

    return {
        ok: true
    };
};
