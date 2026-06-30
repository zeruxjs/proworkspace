import {
    cache,
    clear,
    decrement,
    deleteMany,
    get,
    getMany,
    has,
    increment,
    native,
    remove,
    set,
    setMany,
    touch
} from "zeruxjs/cache";
import type { RedisClientType } from "redis";
import type { ZeruxRequestContext } from "zeruxjs";

const CACHE_TEST_FLAG = "cache";
const CACHE_TEST_VALUE = "test";
const DEMO_TTL_SECONDS = 60;
const DEMO_KEYS = {
    profile: "cache-demo:profile",
    settings: "cache-demo:settings",
    counter: "cache-demo:counter",
    temporary: "cache-demo:temporary"
} as const;

/**
 * Title: Cache demo trigger
 * Description: Restricts the cache feature demo to explicit non-production requests.
 * Global Variables: process.env.NODE_ENV, request query string
 * @param context Current Zerux request context.
 * @returns True when the demo should execute.
 */
const shouldRunCacheDemo = (context: ZeruxRequestContext): boolean =>
    process.env.NODE_ENV !== "production" &&
    context.query.get(CACHE_TEST_FLAG) === CACHE_TEST_VALUE;

/**
 * Title: Cache feature walkthrough
 * Description: Demonstrates every public cache helper with isolated demo keys and returns the observed results.
 * Global Variables: active cache manager, Redis connection
 * @returns Cache operation summary safe to serialize in a response.
 */
const runCacheDemo = async () => {
    // Start from a predictable state for just this demo request.
    await deleteMany(Object.values(DEMO_KEYS));

    // Single-key operations.
    await set(DEMO_KEYS.profile, {
        id: 1,
        name: "Ada",
        roles: ["admin", "editor"]
    }, { ttlSeconds: DEMO_TTL_SECONDS });
    const profile = await get(DEMO_KEYS.profile);
    const profileExists = await has(DEMO_KEYS.profile);

    // Multi-key operations.
    await setMany({
        [DEMO_KEYS.settings]: {
            theme: "dark",
            notifications: true
        },
        [DEMO_KEYS.temporary]: "short-lived"
    }, { ttlSeconds: DEMO_TTL_SECONDS });
    const many = await getMany([
        DEMO_KEYS.profile,
        DEMO_KEYS.settings,
        DEMO_KEYS.temporary
    ]);

    // Numeric operations. Redis treats these values as numbers internally.
    await set(DEMO_KEYS.counter, 0, { ttlSeconds: DEMO_TTL_SECONDS });
    const afterIncrement = await increment(DEMO_KEYS.counter, 5);
    const afterDecrement = await decrement(DEMO_KEYS.counter, 2);

    // TTL refresh without replacing the value.
    const touched = await touch(DEMO_KEYS.profile, DEMO_TTL_SECONDS * 2);

    // Native escape hatch for provider-specific work. Keep this rare in app code.
    const redis = native() as RedisClientType;
    const profileTtlSeconds = await redis.ttl(`proworkspace:${DEMO_KEYS.profile}`);

    // Deletion helpers.
    const removedTemporary = await remove(DEMO_KEYS.temporary);
    const deletedCount = await deleteMany([
        DEMO_KEYS.profile,
        DEMO_KEYS.settings,
        DEMO_KEYS.counter
    ]);

    return {
        helper: cache.helper,
        prefix: cache.prefix,
        defaultTtlSeconds: cache.defaultTtlSeconds,
        profile,
        profileExists,
        many,
        afterIncrement,
        afterDecrement,
        touched,
        profileTtlSeconds,
        removedTemporary,
        deletedCount,
        note: "Use clear() only when you intentionally want to flush the whole configured cache database."
    };
};

/**
 * Title: Cache demo middleware
 * Description: Returns a cache feature demo at `?cache=test` during non-production development.
 * Global Variables: process.env.NODE_ENV, request query string
 * @param context Current Zerux request context.
 * @param next Next middleware callback.
 * @returns Cache demo response or next middleware result.
 */
export default async (context: ZeruxRequestContext, next: () => Promise<void>) => {
    if (!shouldRunCacheDemo(context)) {
        return next();
    }

    try {
        const demo = await runCacheDemo();

        return {
            ok: true,
            demo,
            examples: {
                clear: "await clear(); // Flushes the whole configured cache database.",
                native: "const redis = native(); // Provider-specific client access when the shared facade is not enough."
            }
        };
    } catch (caught) {
        context.logger.warn("Unable to run cache demo", {
            error: caught instanceof Error ? caught.message : String(caught)
        });

        return {
            ok: false,
            message: caught instanceof Error ? caught.message : "Unable to run cache demo."
        };
    }
};

// Keep the import referenced in documentation-oriented examples without flushing Redis during the demo.
void clear;
