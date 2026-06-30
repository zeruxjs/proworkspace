import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ZeruxConfig } from 'zeruxjs';

const configDir = path.dirname(
    fileURLToPath(
        import.meta.url
    )
);

const loadEnvFile = (filePath: string) => {

    if (!fs.existsSync(filePath)) {
        return;
    }

    const content = fs.readFileSync(
        filePath,
        "utf8"
    );

    for (const line of content.split(/\r?\n/)) {

        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmed.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();

        process.env[key] ??= value;
    }
};

loadEnvFile(
    path.resolve(
        configDir,
        "../../generated/app.env"
    )
);

const isDockerRuntime =
    fs.existsSync("/.dockerenv") ||
    process.env.PROWORKSPACE_DOCKER === "true";

const databaseUrl = (() => {

    const value = process.env.DATABASE_URL;

    if (!value || isDockerRuntime) {
        return value;
    }

    const parsed = new URL(value);

    if (parsed.hostname === "postgres") {
        parsed.hostname = "127.0.0.1";
    }

    return parsed.toString();
})();

const redisHost = (() => {

    const value = process.env.REDIS_HOST;

    if (!value || isDockerRuntime) {
        return value;
    }

    return value === "redis" ? "127.0.0.1" : value;
})();

const zeruxConfig: ZeruxConfig = {
    "type": "fix",
    "connectorManager": "@zeruxjs/db",
    "websocket": {
        "enabled": true,
        "path": "/ws"
    },
    "cache": {
        "connector": "@zeruxjs/cache-redis",
        "prefix": "proworkspace",
        "defaultTtlSeconds": 300,
        "options": {
            "socket": {
                "host": redisHost,
                "port": Number(process.env.REDIS_PORT || 6379)
            },
            "password": process.env.REDIS_PASSWORD
        }
    },
    "multisite": true,
    "devtools": {
        "modules": [
        ]
    },
    "allowedDomains": "*",
    "allowedDevDomain": "zdev.shubkb.me",
    "theme": {
        "default": "system",
        "cookieName": "theme",
        "disablePrefrenceHeader": false,
        "scriptPosition": "head",
        "scriptType": "module",
        "scriptLoadType": "async"
    },
    "db": {
        "default": "something",
        "connections": [
            {
                "name": "Something",
                "slug": "something",
                "connector": "@zeruxjs/db-pg",
                "options": {
                    "connectionString": databaseUrl,
                    "prefix": process.env.DB_PREFIX,
                    "polling": true,
                    "pollingInterval": 1000,
                }
            }
        ]
    },
    "apiKeys": {
        "lighthouse": process.env.LIGHTHOUSE_API_KEY
    },
    "security": {
        "keys": {
            "nonce": process.env.SECURITY_NONCE_KEY || "default-nonce-key-change-me",
            "cookie": process.env.SECURITY_COOKIE_KEY || "default-cookie-key-change-me",
            "session": process.env.SECURITY_SESSION_KEY || "default-session-key-change-me",
            "personalToken": process.env.SECURITY_PERSONAL_TOKEN_KEY || "default-personal-token-key-change-me",
            "password": process.env.SECURITY_PASSWORD_KEY || "default-password-key-change-me",
            "encryption": process.env.SECURITY_ENCRYPTION_KEY || "default-encryption-key-change-me",
            "p2p": process.env.SECURITY_P2P_KEY || "default-p2p-key-change-me"
        },
        "salts": {
            "nonce": process.env.SECURITY_NONCE_SALT || "default-nonce-salt-change-me",
            "cookie": process.env.SECURITY_COOKIE_SALT || "default-cookie-salt-change-me",
            "session": process.env.SECURITY_SESSION_SALT || "default-session-salt-change-me",
            "personalToken": process.env.SECURITY_PERSONAL_TOKEN_SALT || "default-personal-token-salt-change-me",
            "password": process.env.SECURITY_PASSWORD_SALT || "default-password-salt-change-me",
            "encryption": process.env.SECURITY_ENCRYPTION_SALT || "default-encryption-salt-change-me",
            "p2p": process.env.SECURITY_P2P_SALT || "default-p2p-salt-change-me"
        }
    },
    "auth": {
        "db": {
            "usersTable": "users",
            "rolesTable": "roles",
            "usermetaTable": "usermeta",
            "fields": {
                "userId": "id",
                "email": "email",
                "passwordHash": "password",
                "role": "role"
            }
        },
        "session": {
            "expiresIn": 86400
        },
        "sso": {
            "google": {
                "clientId": process.env.SSO_GOOGLE_CLIENT_ID || "",
                "clientSecret": process.env.SSO_GOOGLE_CLIENT_SECRET || "",
                "redirectUri": process.env.SSO_GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/sso/google/callback",
                "buttonName": "Sign in with Google",
                "logoUrl": "/assets/images/google.svg"
            }
        }
    }
};

export default zeruxConfig;
