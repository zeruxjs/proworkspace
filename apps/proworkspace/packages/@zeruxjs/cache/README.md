# @zeruxjs/cache

Core cache facade for ZeruxJS. Configure one provider from `zerux.config.ts`, then import stable helpers from `zeruxjs/cache` anywhere in the app.

```ts
const zeruxConfig = {
    cacheHelper: "@zeruxjs/cache-redis",
    cache: {
        prefix: "my-app",
        defaultTtlSeconds: 300,
        options: {
            host: "127.0.0.1",
            port: 6379
        }
    }
};
```

```ts
import { get, set, remove, has } from "zeruxjs/cache";
```
