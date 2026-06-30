import { createRequire } from "node:module";
import path from "node:path";

import type {
    CacheHelper,
    CacheManager,
    CacheManagerConfig,
    CacheSetOptions,
    CacheValue,
    MaybePromise
} from "./types.js";
import {
    createCacheError,
    extractCacheHelperFactory,
    normalizeCacheConfig
} from "./utils.js";

/**
 * Title: Application-scoped helper import
 * Description: Resolves cache helper packages from the running application's node_modules before falling back to package-local resolution.
 * Global Variables: process.cwd()
 * @param packageName Helper package name from Zerux config.
 * @returns Imported helper module namespace.
 */
const importHelperPackage = async (packageName: string): Promise<Record<string, unknown>> => {
    try {
        const appRequire = createRequire(path.join(process.cwd(), "package.json"));
        return await import(appRequire.resolve(packageName)) as Record<string, unknown>;
    } catch {
        return await import(packageName) as Record<string, unknown>;
    }
};

/**
 * Title: Cache manager implementation
 * Description: Applies global defaults, namespaces keys, and delegates storage operations to one configured helper.
 * Global Variables: none
 */
class CacheManagerImpl implements CacheManager {
    public readonly helper: string;
    public readonly prefix?: string;
    public readonly defaultTtlSeconds?: number;
    readonly #adapter: CacheHelper;

    constructor(config: Required<Pick<CacheManagerConfig, "helper">> & CacheManagerConfig, adapter: CacheHelper) {
        this.helper = config.helper;
        this.prefix = config.prefix;
        this.defaultTtlSeconds = config.defaultTtlSeconds;
        this.#adapter = adapter;
    }

    get(key: string): MaybePromise<CacheValue | undefined> {
        return this.#adapter.get(this.#key(key));
    }

    set(key: string, value: CacheValue, options: CacheSetOptions = {}): MaybePromise<void> {
        this.#assertTtl(options.ttlSeconds);

        return this.#adapter.set(this.#key(key), value, {
            ttlSeconds: options.ttlSeconds ?? this.defaultTtlSeconds
        });
    }

    delete(key: string): MaybePromise<boolean> {
        return this.#adapter.delete(this.#key(key));
    }

    has(key: string): MaybePromise<boolean> {
        return this.#adapter.has(this.#key(key));
    }

    clear(): MaybePromise<void> {
        return this.#adapter.clear();
    }

    getMany(keys: string[]): MaybePromise<Record<string, CacheValue | undefined>> {
        return this.#adapter.getMany(keys.map((key) => this.#key(key)));
    }

    setMany(values: Record<string, CacheValue>, options: CacheSetOptions = {}): MaybePromise<void> {
        this.#assertTtl(options.ttlSeconds);
        return this.#adapter.setMany(
            Object.fromEntries(Object.entries(values).map(([key, value]) => [this.#key(key), value])),
            { ttlSeconds: options.ttlSeconds ?? this.defaultTtlSeconds }
        );
    }

    deleteMany(keys: string[]): MaybePromise<number> {
        return this.#adapter.deleteMany(keys.map((key) => this.#key(key)));
    }

    increment(key: string, amount = 1): MaybePromise<number> {
        this.#assertAmount(amount);
        return this.#adapter.increment(this.#key(key), amount);
    }

    decrement(key: string, amount = 1): MaybePromise<number> {
        this.#assertAmount(amount);
        return this.#adapter.decrement(this.#key(key), amount);
    }

    touch(key: string, ttlSeconds: number): MaybePromise<boolean> {
        this.#assertTtl(ttlSeconds);
        return this.#adapter.touch(this.#key(key), ttlSeconds);
    }

    close(): MaybePromise<void> {
        return this.#adapter.close?.();
    }

    native(): unknown {
        return this.#adapter.native?.() ?? this.#adapter;
    }

    #key(key: string): string {
        if (typeof key !== "string" || key.length === 0) {
            throw createCacheError({
                code: "INVALID_KEY",
                message: "Cache key must be a non-empty string"
            });
        }

        return this.prefix ? `${this.prefix}:${key}` : key;
    }

    #assertTtl(ttlSeconds: number | undefined): void {
        if (ttlSeconds !== undefined && (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0)) {
            throw createCacheError({
                code: "INVALID_TTL",
                message: "ttlSeconds must be a positive finite number"
            });
        }
    }

    #assertAmount(amount: number): void {
        if (!Number.isFinite(amount) || amount < 0) {
            throw createCacheError({
                code: "INVALID_AMOUNT",
                message: "Cache increment and decrement amounts must be non-negative finite numbers"
            });
        }
    }
}

let activeManager: CacheManager | null = null;

/**
 * Title: Cache manager factory
 * Description: Creates a manager and loads the configured helper package.
 * Global Variables: none
 * @param config Cache manager config.
 * @returns Cache manager.
 */
export const createCacheManager = async (config: CacheManagerConfig): Promise<CacheManager> => {
    const normalized = normalizeCacheConfig(config);
    const imported = await importHelperPackage(normalized.helper);
    const factory = extractCacheHelperFactory(imported);
    const adapter = await factory(normalized.options ?? {});

    return new CacheManagerImpl(normalized, adapter);
};

/**
 * Title: Active cache manager setter
 * Description: Updates the process-wide manager used by convenience exports.
 * Global Variables: activeManager
 * @param manager Cache manager instance.
 */
export const setActiveCacheManager = (manager: CacheManager): void => {
    activeManager = manager;
};

/**
 * Title: Active cache manager getter
 * Description: Returns the configured process-wide cache manager.
 * Global Variables: activeManager
 * @returns Active manager instance.
 */
export const getActiveCacheManager = (): CacheManager => {
    if (!activeManager) {
        throw createCacheError({
            code: "CACHE_MANAGER_NOT_INITIALIZED",
            message: "Cache manager has not been initialized yet"
        });
    }

    return activeManager;
};

/**
 * Title: Cache manager configurator
 * Description: Creates and installs the active manager in one step.
 * Global Variables: activeManager
 * @param config Cache manager config.
 * @returns Installed manager.
 */
export const configureCacheManager = async (config: CacheManagerConfig): Promise<CacheManager> => {
    const manager = await createCacheManager(config);
    setActiveCacheManager(manager);
    return manager;
};
