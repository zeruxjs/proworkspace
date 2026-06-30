export interface DatabaseConnection {
    name: string;
    slug: string;
    connector?: string;
    connecter?: string;
    options?: Record<string, unknown>;
}

export interface DatabaseConfig {
    default?: string;
    connections?: DatabaseConnection[];
    connection?: DatabaseConnection[];
}

export interface ZeruxStructureConfig {
    app?: string;
    middleware?: string | string[];
    controllers?: string | string[];
    composables?: string | string[];
    plugins?: string | string[];
    public?: string | string[];
    env?: string | string[];
}

export interface ZeruxServerConfig {
    port?: number;
    devPort?: number;
    allowedDomains?: string | string[];
    allowedDevDomain?: string;
}

export interface ZeruxDevtoolsModuleConfig {
    package: string;
    enabled?: boolean;
    options?: Record<string, unknown>;
}

export interface ZeruxDevtoolsConfig {
    modules?: Array<string | ZeruxDevtoolsModuleConfig>;
}

export interface ZeruxWorkerConfig {
    minThreads?: number;
    maxThreads?: number;
}

export interface SecuritySaltsAndKeys {
    nonce?: string;
    cookie?: string;
    session?: string;
    personalToken?: string;
    password?: string;
    encryption?: string;
    p2p?: string;
    [key: string]: string | undefined;
}

export interface SecurityConfig {
    keys?: SecuritySaltsAndKeys;
    salts?: SecuritySaltsAndKeys;
    [key: string]: any;
}

export interface AuthConfig {
    [key: string]: any;
}

export interface ZeruxConfig {
    type?: "fix" | "dynamic" | "function";
    entryPoint?: string;
    outDir?: string;
    multisite?: boolean;
    structure?: ZeruxStructureConfig;
    server?: ZeruxServerConfig;
    devtools?: ZeruxDevtoolsConfig;
    worker?: ZeruxWorkerConfig;
    allowedDomains?: string | string[];
    allowedDevDomain?: string;
    connectorManager?: string;
    db?: DatabaseConfig;
    database?: DatabaseConfig;
    websocket?: {
        enabled?: boolean;
        path?: string;
        maxPayload?: number;
    };
    cache?: {
        connector?: string;
        options?: Record<string, unknown>;
        prefix?: string;
        defaultTtlSeconds?: number;
        startupTimeoutMs?: number;
        required?: boolean;
    };
    security?: SecurityConfig;
    auth?: AuthConfig;
    theme?: import("./theme.js").ThemeConfig;
    [key: string]: any;
}

export type {
    ZeruxPluginApi,
    ZeruxRequestContext,
    ZeruxWorker,
    ZeruxWorkerCleanup,
    ZeruxWorkerContext,
    ZeruxWorkerHandler,
    ZeruxWorkerInput,
    ZeruxThreadWorkerInput,
    ZeruxThreadWorkerOptions,
    ZeruxThreadWorkerPool,
    ZeruxThreadWorkerTaskOptions
} from "./bootstrap/types.js";
export {
    defineThreadWorker,
    defineWorker,
    registerThreadWorker,
    registerWorker,
    runWorkers,
    ThreadWorkerPool
} from "./bootstrap/worker.js";
export { HttpError } from "./exceptions/http_error.js";
export { exceptionHandler } from "./exceptions/exception_handler.js";
export { logger, Logger } from "./bootstrap/logger.js";
export { redirect, isRedirectResponse, RedirectType } from "./navigation.js";
export type { RedirectResponse } from "./navigation.js";
