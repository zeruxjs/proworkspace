# Section 7: z-dev and zsrv

- zsrv: extracted authority parsing, trusted forwarding metadata, hop-count validation, longest-suffix routing; configured 30 s upstream socket timeouts.
- z-dev: extracted bounded request-body reader and local host validation into a reusable module.
- Tests: five focused runtime tests passed using temporary TypeScript transpilation.
- Constraints: no full workspace typecheck or browser/end-to-end network validation; production reverse proxy setup still requires integration testing.
