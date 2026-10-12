# Section 39 — Search, SEO, Feed, Font and framework content endpoints

## Scope

This section implements one cohesive application-facing integration spanning **six packages**: `@zeruxjs/search`, `@zeruxjs/seo`, `@zeruxjs/feed`, `@zeruxjs/font`, `zeruxjs`, and `zyrojs`. Earlier server, fleet, security, and deployment changes remain intact.

## Modules and contracts

| Module | New API | Main guarantees |
|---|---|---|
| `@zeruxjs/search/http` | `createSearchHandler()` | GET/HEAD, bounded query and pagination, field projection, ETag/304, no-store for authenticated/filtered searches, no filtered suggestions |
| `@zeruxjs/search/persistence` | `saveSearchSnapshot()`, `loadSearchSnapshot()` | Bounded atomic snapshots, nofollow file loads, validated directories, reject unsafe/corrupt files without modifying live index |
| `@zeruxjs/seo/fetch` | `createCrawlerRoutes()`, `createCrawlerService()` | `robots.txt`, size-bounded sitemap pages and index, 50k-URL ceiling per sitemap, conditional responses, snapshot TTL and invalidation |
| `@zeruxjs/feed/fetch` | `createFeedFetchHandler()` | Public RSS/Atom/JSON endpoints, Accept negotiation and 406, ETag/Last-Modified, HEAD, maxItems, Vary |
| `@zeruxjs/font/http` | `createFontStylesheetHandler()` | CSS stylesheet delivery, dynamic ETags, preload hints, HEAD and caching |
| `zeruxjs/fetch-route` | `createFetchRoute()`, `registerFetchRoutes()`, `sendFetchResponse()` | Bridges standards-based Fetch endpoints to ZeruxJS routes; streaming, backpressure, cancellation, method preservation |
| `zyrojs/network/discovery` | `createDiscoveryClient()` | Browser/SSR search and feed consumption, ETag revalidation, bounded reads, cancellation, reactive resources |

Server-only APIs live on **separate subpath exports** to preserve the lightweight client-safe package entry points. All additions preserve the previous root-level public APIs. Six modified package manifests are versioned `0.0.1-alpha.2`, with corresponding workspace lockfile entries.

## Example integration

```ts
import { registerFetchRoutes } from 'zeruxjs/fetch-route';
import { createSearchIndex } from '@zeruxjs/search';
import { createSearchHandler } from '@zeruxjs/search/http';
import { createCrawlerService } from '@zeruxjs/seo/fetch';
import { createFeedFetchHandler } from '@zeruxjs/feed/fetch';
import { createFontRegistry } from '@zeruxjs/font';
import { createFontStylesheetHandler } from '@zeruxjs/font/http';

const index = createSearchIndex();
index.add({ id: 'intro', text: 'Welcome to ZeruxJS' });
const fonts = createFontRegistry();
fonts.add('ui', { family: 'Inter', sources: [{ url: '/fonts/inter.woff2' }] });
const crawler = createCrawlerService({ origin: 'https://example.com', entries: [{ loc: 'https://example.com/' }] });

export default (api) => registerFetchRoutes(api, [
  {pattern:'/search',handler:createSearchHandler({ index })},
  {pattern:'/feed',handler:createFeedFetchHandler({ feed: { title: 'News', description: 'Updates', siteUrl:'https://example.com',items: [] } })},
  {pattern:'/fonts.css',handler:createFontStylesheetHandler({ registry: fonts })},
  ...crawler.routes
]);
```

## Safety and limits

- Search snapshots are private local files, not a distributed search database or shared replication protocol. Keep snapshot directories private and do not use concurrent independent writers.
- `createSearchHandler()` returns full document fields unless `fields` is configured. Do not expose secret fields on public routes. Public caches are prohibited when a visibility filter is configured.
- Sitemap snapshots are refreshed with `invalidate()` or their TTL; callers must supply new iterables for dynamic data. Large sitemaps are split by count and byte size, but a full rebuild still consumes application memory.
- Public Feed and SEO endpoints should be backed only by publicly publishable content. Application authentication remains explicit.
- ZSRV proxy caching and response compression continue to apply independently. `Vary` and `ETag` are preserved by the Fetch route bridge; already-encoded upstream responses still pass through without double compression.
- HTTP/3 and WebTransport are unchanged by this section and continue to require an external QUIC terminator.

## Validation

Focused package suites include Search, SEO, Feed, Font, ZyroJS, and an **actual HTTP ZeruxJS runtime test**. Validation compiles affected packages independently using temporary Node typings; ZSRV protocol declarations and cache are compiled only as temporary validation dependencies. The complete monorepo build, external database providers, full browser suites, and cross-platform production certification are not part of this run.
