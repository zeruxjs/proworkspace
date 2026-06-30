import type { ZeruxRequestContext } from "zeruxjs";
import { escapeHtml, renderAdminPage, serviceLabel, serviceOptions } from "../../../lib/admin.ts";
import { normalizeSitePath } from "../../../lib/db.ts";

const sitePath = (site: string) => {
    const [, ...pathParts] = site.split("/");

    return normalizeSitePath(pathParts.join("/"));
};

const siteHost = (site: string) => site.split("/")[0] ?? "";

const domainRows = (model: any) =>
    model.sites.map((site: any) => `<tr data-row-id="${escapeHtml(site.id)}" data-site-service="${escapeHtml(site.for)}" data-site-domain="${escapeHtml(siteHost(site.site))}" data-site-path="${escapeHtml(sitePath(site.site) || "/")}" data-site-name="${escapeHtml(site.site)}">
        <td style="vertical-align: middle;">${escapeHtml(serviceLabel(site.for))}</td>
        <td data-field="domain" style="vertical-align: middle;"><span><code>${escapeHtml(siteHost(site.site))}</code></span></td>
        <td data-field="path" style="vertical-align: middle;"><span><code>${escapeHtml(sitePath(site.site) || "/")}</code></span></td>
        <td style="vertical-align: middle;"><code>${escapeHtml(site["active-identifier"])}</code></td>
        <td style="vertical-align: middle;"><span class="status ${escapeHtml(site.status)}">${escapeHtml(site.status)}</span></td>
        <td style="vertical-align: middle;"><span class="status ${site.reachable ? "reachable" : "unreachable"}">${site.reachable ? "reachable" : "unreachable"}</span></td>
        <td style="vertical-align: middle;">
            <div style="display:flex; gap:8px;">
                <button
                    class="secondary-button action-edit"
                    type="button"
                    title="Edit"
                    data-admin-site-edit="true"
                    style="padding: 4px 8px; display: flex; align-items: center; justify-content: center;"
                ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
                <button
                    class="primary action-save"
                    type="button"
                    title="Save"
                    data-admin-site-save="true"
                    style="padding: 4px 8px; display: none; align-items: center; justify-content: center;"
                ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg></button>
                <button
                    class="danger-button action-delete"
                    style="border-color:#f3b8b2; color:#b42318; padding: 4px 8px; display: none; align-items: center; justify-content: center;"
                    type="button"
                    title="Delete"
                    data-admin-site-delete="true"
                ><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            </div>
        </td>
    </tr>`).join("");

const dialogsScript = `<dialog id="delete-site-dialog" class="admin-dialog" style="padding: 24px; border-radius: 8px; border: 1px solid var(--border-color, #ccc); max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); background: var(--panel-bg, #fff); color: var(--text-color, #000);">
    <form id="delete-site-form">
        <h3 style="margin-top: 0;">Delete Site</h3>
        <p>Type <strong id="delete-site-name-display"></strong> to confirm deletion. This cannot be undone.</p>
        <label style="display: block; margin-bottom: 16px;">
            <input type="text" id="delete-site-confirm-input" required autocomplete="off" style="width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; background: var(--input-bg, #fff); color: var(--text-color, #000); border: 1px solid var(--border-color, #ccc); border-radius: 4px;">
        </label>
        <input type="hidden" id="delete-site-id">
        <input type="hidden" id="delete-site-name">
        <input type="hidden" id="delete-site-domain">
        <input type="hidden" id="delete-site-path">
        <div class="actions" style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" onclick="document.getElementById('delete-site-dialog').close()" style="padding: 8px 16px;">Cancel</button>
            <button type="submit" class="danger-button" style="border-color:#f3b8b2;color:#b42318; padding: 8px 16px;">Delete</button>
        </div>
        <div class="message error" role="status" style="margin-top: 8px; color: #b42318;"></div>
    </form>
</dialog>

<script>
(() => {
    if (window.__proworkspaceDomainDialogsReady) return;
    window.__proworkspaceDomainDialogsReady = true;

    const escapeHtml = (str) => {
        if (!str) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    };

    document.addEventListener("click", (event) => {
        const dialog = document.getElementById("delete-site-dialog");
        if (event.target === dialog) {
            dialog.close();
            return;
        }

        const deleteBtn = event.target instanceof Element ? event.target.closest("button[data-admin-site-delete='true']") : null;
        if (deleteBtn instanceof HTMLButtonElement) {
            if (!dialog) return;
            const tr = deleteBtn.closest("tr");
            
            document.getElementById("delete-site-id").value = tr.dataset.rowId || "";
            document.getElementById("delete-site-name").value = tr.dataset.siteName || "";
            document.getElementById("delete-site-domain").value = tr.dataset.siteDomain || "";
            document.getElementById("delete-site-path").value = tr.dataset.sitePath || "/";
            document.getElementById("delete-site-name-display").textContent = tr.dataset.siteName || "";
            document.getElementById("delete-site-confirm-input").value = "";
            document.querySelector("#delete-site-form .message").textContent = "";
            
            dialog.showModal();
            return;
        }

        const editBtn = event.target instanceof Element ? event.target.closest("button[data-admin-site-edit='true']") : null;
        if (editBtn instanceof HTMLButtonElement) {
            const tr = editBtn.closest("tr");
            if (!tr) return;
            
            tr.querySelector(".action-edit").style.display = "none";
            tr.querySelector(".action-save").style.display = "flex";
            tr.querySelector(".action-delete").style.display = "flex";
            
            const domainTd = tr.querySelector("td[data-field='domain']");
            const pathTd = tr.querySelector("td[data-field='path']");
            
            const domainVal = tr.dataset.siteDomain;
            let pathVal = tr.dataset.sitePath;
            if (pathVal.startsWith("/")) pathVal = pathVal.slice(1);
            
            domainTd.innerHTML = \`<input type="text" class="inline-domain" value="\${domainVal.replace(/"/g, '&quot;')}" style="width: 100%; box-sizing: border-box; padding: 4px; background: var(--input-bg, #fff); color: var(--text-color, #000); border: 1px solid var(--border-color, #ccc); border-radius: 4px;">\`;
            pathTd.innerHTML = \`<div style="display:flex; align-items:center; gap:4px; background: var(--input-bg, #fff); color: var(--text-color, #000); border: 1px solid var(--border-color, #ccc); border-radius: 4px; padding: 0 4px;"><span style="color:var(--text-muted, #666)">/</span><input type="text" class="inline-path" value="\${pathVal.replace(/"/g, '&quot;')}" style="width: 100%; box-sizing: border-box; padding: 4px; border: none; outline: none; background: transparent; color: inherit;"></div>\`;
            return;
        }

        const saveBtn = event.target instanceof Element ? event.target.closest("button[data-admin-site-save='true']") : null;
        if (saveBtn instanceof HTMLButtonElement) {
            const tr = saveBtn.closest("tr");
            if (!tr) return;
            
            saveBtn.disabled = true;
            const id = tr.dataset.rowId;
            const service = tr.dataset.siteService;
            const domain = tr.querySelector(".inline-domain").value;
            let path = tr.querySelector(".inline-path").value;
            
            if (path && !path.startsWith("/")) path = "/" + path;
            if (!path) path = "/";
            
            const origDomain = tr.dataset.siteDomain;
            const origPath = tr.dataset.sitePath === "/" ? "/" : tr.dataset.sitePath;
            
            if (domain === origDomain && path === origPath) {
                tr.querySelector(".action-edit").style.display = "flex";
                tr.querySelector(".action-save").style.display = "none";
                tr.querySelector(".action-delete").style.display = "none";
                
                tr.querySelector("td[data-field='domain']").innerHTML = '<span><code>' + escapeHtml(origDomain) + '</code></span>';
                tr.querySelector("td[data-field='path']").innerHTML = '<span><code>' + escapeHtml(origPath) + '</code></span>';
                saveBtn.disabled = false;
                return;
            }
            
            fetch(new URL("api/admin-sites", window.location.href).href, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ id, service, domain, path })
            }).then(res => res.json()).then(result => {
                if (result.error) throw new Error(result.message);
                
                tr.dataset.siteDomain = domain;
                tr.dataset.sitePath = path;
                tr.dataset.siteName = path === "/" ? domain : domain + path;
                
                tr.querySelector(".action-edit").style.display = "flex";
                tr.querySelector(".action-save").style.display = "none";
                tr.querySelector(".action-delete").style.display = "none";
                
                tr.querySelector("td[data-field='domain']").innerHTML = '<span><code>' + escapeHtml(domain) + '</code></span>';
                tr.querySelector("td[data-field='path']").innerHTML = '<span><code>' + escapeHtml(path) + '</code></span>';
                saveBtn.disabled = false;
            }).catch(err => {
                alert(err.message || "Unable to save");
                saveBtn.disabled = false;
            });
            return;
        }
    });

    document.addEventListener("submit", async (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        
        if (form.id === "delete-site-form") {
            event.preventDefault();
            const site = document.getElementById("delete-site-name").value;
            const typed = document.getElementById("delete-site-confirm-input").value;
            const message = form.querySelector(".message");
            const button = form.querySelector("button[type='submit']");
            
            if (typed !== site) {
                message.textContent = "The typed domain and path did not match.";
                return;
            }
            
            button.disabled = true;
            message.textContent = "";
            
            try {
                const response = await fetch(new URL("api/admin-sites", window.location.href).href, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({ 
                        id: document.getElementById("delete-site-id").value, 
                        domain: document.getElementById("delete-site-domain").value, 
                        path: document.getElementById("delete-site-path").value, 
                        confirmation: typed 
                    })
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.error) {
                    throw new Error(result.message || "Unable to delete site mapping.");
                }
                
                document.getElementById("delete-site-dialog").close();
                const idToDelete = document.getElementById("delete-site-id").value;
                const trToRemove = document.querySelector(\`tr[data-row-id='\${idToDelete}']\`);
                if (trToRemove) trToRemove.remove();
            } catch (error) {
                message.textContent = error instanceof Error ? error.message : "Unable to delete site mapping.";
                button.disabled = false;
            }
        }
    });
})();
</script>`;

export default (context: ZeruxRequestContext) =>
    renderAdminPage(context, {
        active: "domains",
        title: "Domains",
        checkSiteActive: true,
        body: (model) => `<section class="panel">
            <h2>Add site</h2>
            <p>Add another domain and optional path for any service, similar to adding a DNS record.</p>
            <form class="site-create-form" data-admin-site-form="true" action="${model.basePath}/api/admin-sites" method="post">
                <label>
                    <span>Service</span>
                    <select name="service" required>${serviceOptions()}</select>
                </label>
                <label>
                    <span>Domain</span>
                    <input name="domain" autocomplete="off" required maxlength="190" pattern="[a-zA-Z0-9.*-]+(\\.[a-zA-Z0-9-]+)*" placeholder="example.com">
                </label>
                <label>
                    <span>Path</span>
                    <div class="path-input">
                        <span aria-hidden="true">/</span>
                        <input name="path" autocomplete="off" maxlength="120" pattern="[a-zA-Z0-9/_~-]*" placeholder="optional">
                    </div>
                </label>
                <button class="primary" type="submit">Add site</button>
                <div class="message" role="status"></div>
            </form>
        </section>
        <section class="panel" style="margin-top:16px">
            <h2>Sites</h2>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Service</th><th>Domain</th><th>Path</th><th>Identifier</th><th>Status</th><th>Reachable</th><th>Action</th></tr></thead>
                    <tbody>${domainRows(model)}</tbody>
                </table>
            </div>
        </section>
        ${dialogsScript}`
    });
