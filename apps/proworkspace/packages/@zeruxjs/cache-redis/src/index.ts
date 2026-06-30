import { createClient, type RedisClientOptions, type RedisClientType } from "redis";

import type {
    CacheHelper,
    CacheHelperFactory,
    CacheSetOptions,
    CacheValue
} from "@zeruxjs/cache";

export interface RedisCacheOptions extends RedisClientOptions {
    url?: string;
}

const serialize = (value: CacheValue) => JSON.stringify(value);
const deserialize = (value: string): CacheValue => JSON.parse(value) as CacheValue;

/**
 * Title: Redis client-backed cache helper
 * Description: Uses the official Redis client and exposes the common Zerux cache operations.
 * Global Variables: none
 */
class RedisCacheHelper implements CacheHelper {
    readonly #client: RedisClientType;

    constructor(client: RedisClientType) {
        this.#client = client;
    }

    async get(key: string): Promise<CacheValue | undefined> {
        const value = await this.#client.get(key);
        return value === null ? undefined : deserialize(value);
    }

    async set(key: string, value: CacheValue, options: CacheSetOptions = {}): Promise<void> {
        await this.#client.set(key, serialize(value), options.ttlSeconds ? { EX: Math.ceil(options.ttlSeconds) } : {});
    }

    async delete(key: string): Promise<boolean> {
        return await this.#client.del(key) > 0;
    }

    async has(key: string): Promise<boolean> {
        return await this.#client.exists(key) > 0;
    }

    async clear(): Promise<void> {
        await this.#client.flushDb();
    }

    async getMany(keys: string[]): Promise<Record<string, CacheValue | undefined>> {
        const values = keys.length > 0 ? await this.#client.mGet(keys) : [];
        return Object.fromEntries(keys.map((key, index) => [
            key,
            values[index] === null ? undefined : deserialize(values[index] as string)
        ]));
    }

    async setMany(values: Record<string, CacheValue>, options: CacheSetOptions = {}): Promise<void> {
        const entries = Object.entries(values);
        if (entries.length === 0) return;

        if (!options.ttlSeconds) {
            await this.#client.mSet(Object.fromEntries(entries.map(([key, value]) => [key, serialize(value)])));
            return;
        }

        const multi = this.#client.multi();
        entries.forEach(([key, value]) => {
            multi.set(key, serialize(value), { EX: Math.ceil(options.ttlSeconds as number) });
        });
        await multi.exec();
    }

    async deleteMany(keys: string[]): Promise<number> {
        return keys.length === 0 ? 0 : await this.#client.del(keys);
    }

    async increment(key: string, amount = 1): Promise<number> {
        return this.#client.incrBy(key, amount);
    }

    async decrement(key: string, amount = 1): Promise<number> {
        return this.#client.decrBy(key, amount);
    }

    async touch(key: string, ttlSeconds: number): Promise<boolean> {
        return await this.#client.expire(key, Math.ceil(ttlSeconds)) > 0;
    }

    async close(): Promise<void> {
        await this.#client.close();
    }

    native(): RedisClientType {
        return this.#client;
    }
}

/**
 * Title: Redis helper factory
 * Description: Creates and connects the official Redis client before exposing it through Zerux cache.
 * Global Variables: none
 * @param options Redis client options.
 * @returns Redis helper.
 */
export const createCacheHelper: CacheHelperFactory = async (options) => {
    const client = createClient(options as RedisCacheOptions);
    client.on("error", () => undefined);
    await client.connect();
    return new RedisCacheHelper(client as RedisClientType);
};

export default createCacheHelper;
