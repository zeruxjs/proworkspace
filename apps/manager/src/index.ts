import chokidar from "chokidar";
import fs from "fs-extra";
import os from "node:os";
import path from "path";
import Docker from "dockerode";
import debounce from "lodash/debounce.js";
import dotenv from "dotenv";

dotenv.config({
    path: "/app/.env"
});

const docker = new Docker();

const CONFIG_PATH = "/config.json";

const GENERATED_PATH = "/generated";

const NGINX_FILE_PATH = path.join(GENERATED_PATH, "nginx.conf");
const CERTBOT_ISSUE_PATH = path.join(GENERATED_PATH, "certbot-issue.sh");
const CERTBOT_RENEW_PATH = path.join(GENERATED_PATH, "certbot-renew.sh");
const COREDNS_PATH = path.join(GENERATED_PATH, "coredns");
const COREFILE_PATH = path.join(COREDNS_PATH, "Corefile");
const DNS_ZONE_PATH = path.join(COREDNS_PATH, "db.zone");

const PROMETHEUS_FILE_PATH = path.join(
    GENERATED_PATH,
    "prometheus.yml"
);

const APP_ENV_FILE_PATH = path.join(
    GENERATED_PATH,
    "app.env"
);

type Config = {
    app_name: string;
    domain: string;

    prometheus?: {
        enabled?: boolean;
    };

    grafana?: {
        enabled?: boolean;
    };
};

const env = (key: string, fallback = "") => process.env[key] ?? fallback;

const splitCsv = (value: string) =>
    value.split(",").map((entry) => entry.trim()).filter(Boolean);

const labelDomain = (label: string, mainDomain: string) =>
    label.trim() ? `${label.trim()}.${mainDomain}` : mainDomain;

const unique = <T>(items: T[]) => [...new Set(items)];

const managedHttpDomains = (config: Config) => {
    const mainDomain = env("MAIN_DOMAIN", config.domain || "localhost").replace(/\.$/, "");
    const labels = [
        "",
        env("AUTH_DOMAIN", "auth"),
        env("DEV_DOMAIN", "dev"),
        env("DNS_DOMAIN", "dns")
    ];
    const explicitDomains = splitCsv(env("EXTRA_DOMAINS"));

    return unique([
        ...labels.map((label) => labelDomain(label, mainDomain)),
        ...explicitDomains
    ].map((domain) => domain.replace(/\.$/, "").toLowerCase()).filter(Boolean));
};

const isPublicIpv4 = (address: string) => {
    const parts = address.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    const first = parts[0] as number;
    const second = parts[1] as number;

    return !(
        first === 10 ||
        first === 127 ||
        first === 0 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 169 && second === 254)
    );
};

const isPublicIpv6 = (address: string) => {
    const lower = address.toLowerCase();

    return !(
        lower === "::1" ||
        lower.startsWith("fe80:") ||
        lower.startsWith("fc") ||
        lower.startsWith("fd")
    );
};

const getPublicIps = () => {
    const interfaces = os.networkInterfaces();
    const ipv4 = new Set<string>();
    const ipv6 = new Set<string>();

    Object.values(interfaces).flat().forEach((entry) => {
        if (!entry || entry.internal) return;
        if (entry.family === "IPv4" && isPublicIpv4(entry.address)) ipv4.add(entry.address);
        if (entry.family === "IPv6" && isPublicIpv6(entry.address)) ipv6.add(entry.address);
    });

    if (env("VPS_IPV4")) splitCsv(env("VPS_IPV4")).forEach((ip) => ipv4.add(ip));
    if (env("VPS_IPV6")) splitCsv(env("VPS_IPV6")).forEach((ip) => ipv6.add(ip));

    return {
        ipv4: [...ipv4],
        ipv6: [...ipv6]
    };
};

async function generateCoreDns(config: Config) {
    const mainDomain = env("MAIN_DOMAIN", config.domain || "localhost").replace(/\.$/, "");
    const nsLabels = splitCsv(env("NS_DOMAIN", "ns1,ns2"));
    const dnsLabel = env("DNS_DOMAIN", "dns");
    const ips = getPublicIps();
    const serial = Math.floor(Date.now() / 1000);
    const origin = `${mainDomain}.`;
    const records: string[] = [
        `$ORIGIN ${origin}`,
        `$TTL 300`,
        `@ IN SOA ${labelDomain(nsLabels[0] ?? "ns1", mainDomain)}. hostmaster.${mainDomain}. (${serial} 300 120 1209600 300)`
    ];

    nsLabels.forEach((label) => {
        records.push(`@ IN NS ${labelDomain(label, mainDomain)}.`);
    });

    [...nsLabels, dnsLabel, env("DEV_DOMAIN", "dev")].filter(Boolean).forEach((label) => {
        ips.ipv4.forEach((ip) => records.push(`${label} IN A ${ip}`));
        ips.ipv6.forEach((ip) => records.push(`${label} IN AAAA ${ip}`));
    });

    if (ips.ipv4.length === 0 && ips.ipv6.length === 0) {
        records.push("; No public VPS IP detected. Set VPS_IPV4 and/or VPS_IPV6 in .env.");
    }

    await fs.ensureDir(COREDNS_PATH);
    await fs.writeFile(DNS_ZONE_PATH, records.join("\n") + "\n");
    await fs.writeFile(COREFILE_PATH, `${mainDomain}:53 {
    file /etc/coredns/db.zone
    log
    errors
}
.:53 {
    forward . 1.1.1.1 8.8.8.8
    cache 300
    log
    errors
}
`);

    console.log("Generated CoreDNS config");
}

async function generateNginx(config: Config) {
    const mainDomain = env("MAIN_DOMAIN", config.domain || "localhost").replace(/\.$/, "");
    const devHost = labelDomain(env("DEV_DOMAIN", "dev"), mainDomain);
    const allDomains = managedHttpDomains(config);
    const appDomains = allDomains.filter((domain) => domain !== devHost);
    const appPort = env("APP_PORT", "3010");
    const adminerPort = env("ADMINER_PORT", "5050");
    const environment = env("ENVIRONMENT", "development");
    const acmeWebroot = env("CERTBOT_WEBROOT", "/var/www/certbot");
    const sslLine = environment === "development"
        ? `    # mkcert: use certificates such as ./generated/certs/${mainDomain}.pem and ${mainDomain}-key.pem when enabling HTTPS locally.`
        : "    # certbot: run ./generated/certbot-issue.sh after this file is installed in nginx.";

    const nginxConfig = `
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

upstream proworkspace_app {
    server 127.0.0.1:${appPort};
}

upstream proworkspace_adminer {
    server 127.0.0.1:${adminerPort};
}

server {
    listen 80;
    listen [::]:80;
    server_name ${appDomains.join(" ")};
${sslLine}

    location ^~ /.well-known/acme-challenge/ {
        root ${acmeWebroot};
        default_type "text/plain";
        try_files $uri =404;
    }

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_pass http://proworkspace_app;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${devHost};

    location ^~ /.well-known/acme-challenge/ {
        root ${acmeWebroot};
        default_type "text/plain";
        try_files $uri =404;
    }

    location /adminer/ {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://proworkspace_adminer/;
    }

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://proworkspace_app;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name _;

    location ^~ /.well-known/acme-challenge/ {
        root ${acmeWebroot};
        default_type "text/plain";
        try_files $uri =404;
    }

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://proworkspace_app;
    }
}
`;

    await fs.writeFile(NGINX_FILE_PATH, nginxConfig.trim() + "\n");
    console.log("Generated nginx.conf");
}

async function generateCertbotScripts(config: Config) {
    const domains = managedHttpDomains(config);
    const email = env("CERTBOT_EMAIL");
    const acmeWebroot = env("CERTBOT_WEBROOT", "/var/www/certbot");
    const stagingFlag = env("CERTBOT_STAGING", "false") === "true" ? " --staging" : "";
    const emailFlags = email
        ? `--email ${email}`
        : "--register-unsafely-without-email";
    const domainFlags = domains.map((domain) => `-d ${domain}`).join(" ");
    const issueScript = `#!/usr/bin/env sh
set -eu

mkdir -p ${acmeWebroot}
certbot certonly --webroot -w ${acmeWebroot} ${domainFlags} ${emailFlags} --agree-tos --no-eff-email --keep-until-expiring${stagingFlag}
nginx -t
nginx -s reload
`;
    const renewScript = `#!/usr/bin/env sh
set -eu

certbot renew --webroot -w ${acmeWebroot}
nginx -t
nginx -s reload
`;

    await fs.writeFile(CERTBOT_ISSUE_PATH, issueScript, { mode: 0o755 });
    await fs.writeFile(CERTBOT_RENEW_PATH, renewScript, { mode: 0o755 });
    console.log("Generated certbot scripts");
}

async function generatePrometheus() {

    const prometheusConfig = `
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "prometheus"

    static_configs:
      - targets:
          - "localhost:9090"
`;

    await fs.writeFile(
        PROMETHEUS_FILE_PATH,
        prometheusConfig.trim() + "\n"
    );

    console.log(
        "Generated prometheus.yml"
    );
}

async function generateAppEnv() {

    const appEnv = `
NODE_ENV=${process.env.NODE_ENV}
ENVIRONMENT=${env("ENVIRONMENT", "development")}
MAIN_DOMAIN=${env("MAIN_DOMAIN")}
NS_DOMAIN=${env("NS_DOMAIN", "ns1,ns2")}
DNS_DOMAIN=${env("DNS_DOMAIN", "dns")}
DEV_DOMAIN=${env("DEV_DOMAIN", "dev")}
AUTH_DOMAIN=${env("AUTH_DOMAIN", "auth")}

DATABASE_URL=postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@postgres:5432/${process.env.POSTGRES_DB}
DB_HOST=postgres
DB_USER=${process.env.POSTGRES_USER}
DB_PASSWORD=${process.env.POSTGRES_PASSWORD}
DB_NAME=${process.env.POSTGRES_DB}
DB_PORT=5432
DB_PREFIX=${process.env.DB_PREFIX ?? ""}

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${process.env.REDIS_PASSWORD}

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=${process.env.MINIO_ROOT_USER}
MINIO_SECRET_KEY=${process.env.MINIO_ROOT_PASSWORD}

MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=${process.env.MEILI_MASTER_KEY}

PROMETHEUS_URL=http://prometheus:9090
`;

    await fs.writeFile(
        APP_ENV_FILE_PATH,
        appEnv.trim() + "\n"
    );

    console.log(
        "Generated app.env"
    );
}

async function reloadPrometheus() {

    try {

        const container =
            docker.getContainer(
                "proworkspace-prometheus"
            );

        const info =
            await container.inspect();

        if (!info.State.Running) {

            console.log(
                "Prometheus container not running yet"
            );

            return;
        }

        const exec =
            await container.exec({
                Cmd: [
                    "wget",
                    "--method=POST",
                    "-qO-",
                    "http://localhost:9090/-/reload"
                ],
                AttachStdout: true,
                AttachStderr: true
            });

        await exec.start({});

        console.log(
            "Reloaded Prometheus"
        );

    } catch (error) {

        console.error(
            "Failed to reload Prometheus"
        );

        console.error(error);

    }
}

async function ensureDirectories() {

    await fs.ensureDir(
        GENERATED_PATH
    );
    await fs.ensureDir(COREDNS_PATH);
}

async function reloadConfig() {

    try {

        const config: Config =
            await fs.readJson(
                CONFIG_PATH
            );

        console.log(
            "Config updated"
        );

        console.log(config);

        await ensureDirectories();

        await generateCoreDns(config);
        await generateNginx(config);
        await generateCertbotScripts(config);

        await generatePrometheus();

        await generateAppEnv();

        await reloadPrometheus();

    } catch (error) {

        console.error(
            "Failed to reload config"
        );

        console.error(error);

    }
}

const debouncedReload = debounce(
    async () => {

        await reloadConfig();

    },
    1000
);

async function start() {

    console.log(
        "Manager started"
    );

    await reloadConfig();

    chokidar.watch(
        CONFIG_PATH,
        {
            ignoreInitial: true
        }
    ).on(
        "all",
        async (event) => {

            console.log(
                `Config event: ${event}`
            );

            debouncedReload();

        }
    );
}

start();
