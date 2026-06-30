import type { ZeruxRequestContext } from "zeruxjs";

const escapeHtml = (value: unknown) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

export const renderServicePage = (context: ZeruxRequestContext, service: string) => {
    const site = typeof context.state.site === "object" && context.state.site !== null
        ? context.state.site as { site?: string }
        : null;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(service)} - ProWorkspace</title>
    <link rel="stylesheet" href="/admin/admin.css">
</head>
<body>
    <main class="content">
        <section class="panel">
            <p>ProWorkspace service</p>
            <h1>${escapeHtml(service)}</h1>
            <p>${escapeHtml(site?.site ?? context.req.headers.host ?? "")}</p>
        </section>
    </main>
</body>
</html>`;
};
