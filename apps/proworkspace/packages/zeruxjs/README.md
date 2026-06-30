> [!WARNING]
> This package is in a very early stage of development and is only published for pre-saving the name from being taken by somebody else. All current versions follow the `0.0.1-alpha.x` pattern.

# ZeruxJS Framework

**ZeruxJS** is a next-generation, multi-engine meta-framework for Node.js designed to provide a unified developer experience regardless of your frontend choice.

## 🚀 Multi-Engine Support

ZeruxJS is engine-agnostic, allowing you to build applications using your favorite libraries while benefiting from a consistent backend and tooling layer:

- **Zyro**: Native integration with the ZyroJS Library for maximum performance.
- **React**: Full support for React components and hooks.
- **Vue**: Seamless integration with the Vue ecosystem.

## ✨ Key Features

- **Unified CLI**: A single command-line interface (`zcli`) to manage your entire lifecycle.
- **Advanced Server Orchestration**: Powered by `zsrv`, managing both app and dev servers with ease.
- **Hot-Module Replacement**: High-performance watching and reloading via `zwatch`.
- **Built-in Security**: Hardened by default with `@zeruxjs/security`.
- **Performance First**: Native support for Lighthouse reporting, Web-Vitals, and intelligent caching.

## 📦 Getting Started

The easiest way to start a new ZeruxJS project is using the official scaffolder:

```bash
npm create zerux-app@latest
```

## Runtime Workers and Thread Workers

Startup workers run after ZeruxJS finishes bootstrapping the runtime and before the HTTP server starts accepting requests. They are useful for background queues, schedulers, cache warmups, shared workers, and other services that must be ready before routes run.

Thread workers use Node.js `worker_threads` for CPU-heavy or isolated tasks. Set default thread limits in `zerux.config.ts`:

```ts
import type { ZeruxConfig } from "zeruxjs";

const zeruxConfig: ZeruxConfig = {
  worker: {
    minThreads: 1,
    maxThreads: 4
  }
};

export default zeruxConfig;
```

Register workers from a plugin or app entry file:

```ts
import { defineThreadWorker, defineWorker, type ZeruxPluginApi } from "zeruxjs";

export default (api: ZeruxPluginApi) => {
  api.addWorker("queue", defineWorker("queue", async ({ logger, state, env }) => {
    const queueUrl = env.QUEUE_URL;
    if (!queueUrl) {
      throw new Error("QUEUE_URL is required to start the queue worker.");
    }

    state.set("queue", { startedAt: new Date().toISOString() });
    logger.info("Queue worker started");

    return async () => {
      logger.info("Queue worker stopped");
    };
  }));

  api.addThreadWorker("math", defineThreadWorker("math", "workers/math.ts", {
    minThreads: 1,
    maxThreads: 2
  }));
};
```

Thread worker modules export a function:

```ts
export default function mathWorker(payload: { value: number }) {
  return {
    squared: payload.value * payload.value
  };
}
```

Use a thread worker from a route, middleware, or startup worker:

```ts
const math = context.runtime.asPluginApi().getThreadWorker("math");
const result = await math?.run({ value: 12 });
```

Worker helpers:

- `defineWorker(name, handler)`: creates a typed worker object.
- `registerWorker(api, name, worker)`: small helper around `api.addWorker`.
- `api.addWorker(name, worker)`: registers a worker directly.
- `api.removeWorker(name)`: removes a registered worker before startup.
- `api.getWorker(name)` and `api.getWorkers()`: inspect registered workers.
- `defineThreadWorker(name, script, options)`: creates a thread worker pool definition.
- `registerThreadWorker(api, name, worker)`: small helper around `api.addThreadWorker`.
- `api.addThreadWorker(name, worker)`: registers a Node.js worker thread pool.
- `api.getThreadWorker(name)` and `api.getThreadWorkers()`: inspect and run thread pools.

The startup worker handler receives `{ runtime, mode, config, structure, logger, env, state }`. Return a cleanup function when the worker owns intervals, sockets, queues, or other resources. In dev mode cleanup runs before the runtime is rebuilt, then the new worker set starts again. Thread pools are also stopped before dev reloads and restarted with the new runtime.

## Navigation

Use `zeruxjs/navigation` when a route handler or middleware needs to return an HTTP redirect:

```ts
import { redirect, RedirectType } from "zeruxjs/navigation";

export const GET = () => {
  return redirect("/dashboard", RedirectType.Temporary);
};
```

`RedirectType` includes `Temporary` (307), `Permanent` (308), `Found` (302), and `SeeOther` (303).

## Multisite Routing

Enable request-scoped multisite routing in `zerux.config.ts`:

```ts
import type { ZeruxConfig } from "zeruxjs";

const zeruxConfig: ZeruxConfig = {
  multisite: true
};

export default zeruxConfig;
```

Register host and path mappings from middleware:

```ts
export default async (context, next) => {
  context.multisiteRegister("*", "main");
  context.multisiteRegister("meow.com", "main");
  context.multisiteRegister("meow.com/apple/cat", "cat");
  context.multisiteRegister("meow.com/apple", "apple");

  await next();
};
```

Use `*` as the host to match any incoming host for that registration, such as local IPs, localhost, or temporary domains. Exact hosts still take priority over wildcard hosts when the path specificity is the same. Zerux sorts registrations by path depth before matching, so `meow.com/apple/cat` is checked before `meow.com/apple`. A match rewrites the internal route pathname to the selected root app folder segment. For example, `meow.com/apple/api/health` with folder `apple` routes through `app/{apple}/api/health/route.ts`.

When multisite is enabled and middleware registers mappings, requests that do not match any mapping are not allowed to fall through into root dynamic routes. This keeps an explicit mapping such as `meow.com` from accidentally serving an unrelated host like `cat.com/something`.
