import type { ZeruxRequestContext } from "zeruxjs";
import { escapeHtml, getAdminModel, renderAdminPage } from "../../../lib/admin.ts";
import { ensureSystemDnsRecords, getDnsRecords } from "../../../lib/dns.ts";

const recordRows = (records: Awaited<ReturnType<typeof getDnsRecords>>) =>
    records.map((record) => `<tr>
        <td><code>${escapeHtml(record.name)}</code></td>
        <td><code>${escapeHtml(record.domain)}</code></td>
        <td>${escapeHtml(record.type)}</td>
        <td><code>${escapeHtml(record.value)}</code></td>
        <td>${record.type === "MX" ? escapeHtml(record.priority ?? 10) : "—"}</td>
        <td>${escapeHtml(record.ttl)}</td>
        <td><span class="status ${record.locked ? "active" : "reachable"}">${record.locked ? "locked" : "manual"}</span></td>
        <td>${record.locked ? "" : `<button type="button" data-dns-edit="${escapeHtml(record.id)}" data-name="${escapeHtml(record.name)}" data-type="${escapeHtml(record.type)}" data-value="${escapeHtml(record.value)}" data-priority="${escapeHtml(record.priority ?? 10)}" data-ttl="${escapeHtml(record.ttl)}">Edit</button> <button class="danger-button" type="button" data-dns-delete="${escapeHtml(record.id)}">Delete</button>`}</td>
    </tr>`).join("");

const script = `<script>
(() => {
    document.addEventListener("submit", async (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.id !== "dns-record-form") return;
        event.preventDefault();
        const message = form.querySelector(".message");
        const button = form.querySelector("button[type='submit']");
        button.disabled = true;
        message.textContent = "";
        try {
            const payload = Object.fromEntries(new FormData(form).entries());
            const response = await fetch(new URL("api/dns-records", window.location.href).href, {
                method: payload.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.error) throw new Error(result.message || "Unable to add DNS record.");
            window.location.reload();
        } catch (error) {
            message.textContent = error instanceof Error ? error.message : "Unable to add DNS record.";
            button.disabled = false;
        }
    });

    document.addEventListener("click", async (event) => {
        const edit = event.target instanceof Element ? event.target.closest("button[data-dns-edit]") : null;
        if (edit instanceof HTMLButtonElement) {
            const form = document.getElementById("dns-record-form");
            if (!(form instanceof HTMLFormElement)) return;
            form.elements.namedItem("id").value = edit.dataset.dnsEdit || "";
            form.elements.namedItem("name").value = edit.dataset.name || "";
            form.elements.namedItem("type").value = edit.dataset.type || "A";
            form.elements.namedItem("value").value = edit.dataset.value || "";
            form.elements.namedItem("priority").value = edit.dataset.priority || "10";
            form.elements.namedItem("ttl").value = edit.dataset.ttl || "300";
            form.querySelector("button[type='submit']").textContent = "Save record";
            form.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
        const button = event.target instanceof Element ? event.target.closest("button[data-dns-delete]") : null;
        if (!(button instanceof HTMLButtonElement)) return;
        button.disabled = true;
        try {
            const response = await fetch(new URL("api/dns-records", window.location.href).href, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ id: button.dataset.dnsDelete })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.error) throw new Error(result.message || "Unable to delete DNS record.");
            window.location.reload();
        } catch (error) {
            alert(error instanceof Error ? error.message : "Unable to delete DNS record.");
            button.disabled = false;
        }
    });
})();
</script>`;

export default async (context: ZeruxRequestContext) => {
    const model = await getAdminModel();
    const orgId = Number(model.organization?.id ?? model.sites[0]?.org_id);
    if (Number.isFinite(orgId) && model.organization) {
        await ensureSystemDnsRecords(orgId, model.organization.domain);
    }
    const records = Number.isFinite(orgId) ? await getDnsRecords(orgId) : [];
    const defaultDomain = process.env.MAIN_DOMAIN || model.organization?.domain || "";

    return renderAdminPage(context, {
        active: "dns",
        title: "DNS",
        body: () => `<section class="panel">
            <h2>Add DNS record</h2>
            <form id="dns-record-form" class="site-create-form">
                <input name="id" type="hidden">
                <label>
                    <span>Name</span>
                    <input name="name" autocomplete="off" maxlength="190" placeholder="@, www, api" required>
                </label>
                <label>
                    <span>Domain</span>
                    <input name="domain" autocomplete="off" maxlength="190" value="${escapeHtml(defaultDomain)}" placeholder="example.com">
                </label>
                <label>
                    <span>Type</span>
                    <select name="type">
                        <option>A</option>
                        <option>AAAA</option>
                        <option>CNAME</option>
                        <option>MX</option>
                        <option>TXT</option>
                        <option>NS</option>
                    </select>
                </label>
                <label>
                    <span>Value</span>
                    <input name="value" autocomplete="off" maxlength="500" required>
                </label>
                <label>
                    <span>MX priority</span>
                    <input name="priority" type="number" min="0" max="65535" value="10">
                </label>
                <label>
                    <span>TTL</span>
                    <input name="ttl" type="number" min="60" max="86400" value="300" required>
                </label>
                <button class="primary" type="submit">Add record</button>
                <div class="message" role="status"></div>
            </form>
        </section>
        <section class="panel" style="margin-top:16px">
            <h2>Records</h2>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Name</th><th>Domain</th><th>Type</th><th>Value</th><th>Priority</th><th>TTL</th><th>Source</th><th>Action</th></tr></thead>
                    <tbody>${recordRows(records)}</tbody>
                </table>
            </div>
        </section>
        ${script}`
    });
};
