(() => {
    const app = window.__PROWORKSPACE_NOTES__ || {};
    const apiPath = app.apiPath || "/notes/api/workspace";
    const editor = document.querySelector("[data-editor]");
    const markdownSource = document.querySelector("[data-markdown]");
    const titleInput = document.querySelector("[data-title]");
    const preview = document.querySelector("[data-preview]");
    const outline = document.querySelector("[data-outline]");
    const activity = document.querySelector("[data-activity]");
    const saveState = document.querySelector("[data-save-state]");
    const tree = document.querySelector("[data-tree]");
    const shareList = document.querySelector("[data-share-list]");
    const commentsList = document.querySelector("[data-comments-list]");
    const searchResults = document.querySelector("[data-search-results]");
    const spaceModal = document.querySelector("[data-space-modal]");
    const spaceForm = document.querySelector("[data-space-form]");
    const nodes = Array.isArray(app.nodes) ? app.nodes : [];
    const shares = Array.isArray(app.shares) ? app.shares : [];
    let activeNodeId = app.activeNodeId;
    let activeRole = "viewer";
    let saveTimer = 0;
    let dirty = false;
    let lastSync = window.localStorage.getItem(syncKey()) || "";
    let lastTableCell = null;
    let reconnectTimer = 0;
    let reconnectDelay = 1000;
    let fallbackSyncTimer = 0;

    const themeIcons = {
        system: "S",
        dark: "D",
        light: "L"
    };
    const themeOrder = { system: "dark", dark: "light", light: "system" };

    function storageKey(name) {
        return `proworkspace:notes:${app.space?.space_id || "demo"}:${name}`;
    }

    function syncKey() {
        return storageKey("last-sync");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function activeNode() {
        return nodes.find((node) => node.node_id === activeNodeId) || nodes.find((node) => node.type === "page") || nodes[0];
    }

    function inlineMarkdown(value) {
        return escapeHtml(value)
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/`([^`]+)`/g, "<code>$1</code>");
    }

    function markdownToHtml(markdown) {
        const lines = String(markdown || "").split(/\r?\n/);
        const html = [];
        let listOpen = false;
        let codeOpen = false;
        let tableRows = [];
        const closeList = () => {
            if (listOpen) {
                html.push("</ul>");
                listOpen = false;
            }
        };
        const closeTable = () => {
            if (tableRows.length) {
                html.push(`<table><tbody>${tableRows.join("")}</tbody></table>`);
                tableRows = [];
            }
        };

        for (const line of lines) {
            if (line.trim().startsWith("```")) {
                closeList();
                closeTable();
                html.push(codeOpen ? "</code></pre>" : "<pre><code>");
                codeOpen = !codeOpen;
                continue;
            }
            if (codeOpen) {
                html.push(`${escapeHtml(line)}\n`);
                continue;
            }
            if (/^\|.+\|$/.test(line.trim())) {
                closeList();
                if (/^\|\s*-+/.test(line.trim())) continue;
                const cells = line.trim().slice(1, -1).split("|").map((cell) => `<td>${inlineMarkdown(cell.trim())}</td>`).join("");
                tableRows.push(`<tr>${cells}</tr>`);
                continue;
            }
            closeTable();
            if (!line.trim()) {
                closeList();
                html.push("<p><br></p>");
            } else if (line.startsWith("### ")) {
                closeList();
                html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
            } else if (line.startsWith("## ")) {
                closeList();
                html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
            } else if (line.startsWith("# ")) {
                closeList();
                html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
            } else if (/^- \[ \]\s+/.test(line)) {
                closeList();
                html.push(`<p><input type="checkbox"> ${inlineMarkdown(line.replace(/^- \[ \]\s+/, ""))}</p>`);
            } else if (/^[-*]\s+/.test(line)) {
                if (!listOpen) {
                    html.push("<ul>");
                    listOpen = true;
                }
                html.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`);
            } else if (line.startsWith("> ")) {
                closeList();
                html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
            } else {
                closeList();
                html.push(`<p>${inlineMarkdown(line)}</p>`);
            }
        }
        closeList();
        closeTable();
        if (codeOpen) html.push("</code></pre>");
        return html.join("");
    }

    function textOf(node) {
        return (node.textContent || "").replace(/\u00a0/g, " ").trim();
    }

    function inlineHtmlToMarkdown(root) {
        let out = "";
        root.childNodes.forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                out += child.textContent || "";
                return;
            }
            if (!(child instanceof Element)) return;
            const tag = child.tagName.toLowerCase();
            if (tag === "strong" || tag === "b") out += `**${inlineHtmlToMarkdown(child)}**`;
            else if (tag === "em" || tag === "i") out += `*${inlineHtmlToMarkdown(child)}*`;
            else if (tag === "span" && child.classList.contains("inline-heading-h1")) out += `**${inlineHtmlToMarkdown(child)}**`;
            else if (tag === "span" && child.classList.contains("inline-heading-h2")) out += `**${inlineHtmlToMarkdown(child)}**`;
            else if (tag === "code") out += `\`${textOf(child)}\``;
            else if (tag === "a") out += `[${textOf(child)}](${child.getAttribute("href") || ""})`;
            else if (tag === "img") out += `![${child.getAttribute("alt") || ""}](${child.getAttribute("src") || ""})`;
            else if (tag === "br") out += "\n";
            else out += inlineHtmlToMarkdown(child);
        });
        return out;
    }

    function htmlToMarkdown(root) {
        const lines = [];
        root.childNodes.forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                const value = (child.textContent || "").trim();
                if (value) lines.push(value);
                return;
            }
            if (!(child instanceof Element)) return;
            const tag = child.tagName.toLowerCase();
            if (tag === "h1") lines.push(`# ${inlineHtmlToMarkdown(child)}`);
            else if (tag === "h2") lines.push(`## ${inlineHtmlToMarkdown(child)}`);
            else if (tag === "h3") lines.push(`### ${inlineHtmlToMarkdown(child)}`);
            else if (tag === "blockquote") lines.push(`> ${inlineHtmlToMarkdown(child)}`);
            else if (tag === "pre") lines.push(`\`\`\`\n${textOf(child)}\n\`\`\``);
            else if (tag === "ul") child.querySelectorAll(":scope > li").forEach((li) => lines.push(`- ${inlineHtmlToMarkdown(li)}`));
            else if (tag === "ol") child.querySelectorAll(":scope > li").forEach((li, index) => lines.push(`${index + 1}. ${inlineHtmlToMarkdown(li)}`));
            else if (tag === "table") {
                const rows = [...child.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("th,td")].map((cell) => inlineHtmlToMarkdown(cell).trim()));
                if (rows.length) {
                    lines.push(`| ${rows[0].join(" | ")} |`);
                    lines.push(`| ${rows[0].map(() => "---").join(" | ")} |`);
                    rows.slice(1).forEach((row) => lines.push(`| ${row.join(" | ")} |`));
                }
            } else {
                const checkbox = child.querySelector("input[type='checkbox']");
                if (checkbox) lines.push(`- [${checkbox.checked ? "x" : " "}] ${textOf(child).replace(/^\s*/, "")}`);
                else lines.push(inlineHtmlToMarkdown(child));
            }
        });
        return lines.map((line) => line.trimEnd()).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    }

    async function apiGet(params) {
        const url = new URL(apiPath, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
        });
        const response = await fetch(url, { headers: { accept: "application/json" }, credentials: "same-origin" });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json.ok === false) throw new Error(json.message || "Request failed.");
        return json;
    }

    async function apiPost(payload, queue = true) {
        let status = undefined;
        try {
            const response = await fetch(apiPath, {
                method: "POST",
                headers: { "content-type": "application/json", accept: "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            });
            status = response.status;
            const json = await response.json().catch(() => ({}));
            if (!response.ok || json.ok === false) {
                const err = new Error(json.message || "Request failed.");
                err.status = response.status;
                throw err;
            }
            return json;
        } catch (error) {
            const errStatus = error.status !== undefined ? error.status : status;
            const isTemporary = errStatus === undefined || errStatus >= 500;
            if (queue && isTemporary) queueOutbox(payload);
            throw error;
        }
    }

    function queueOutbox(payload) {
        const outbox = JSON.parse(window.localStorage.getItem(storageKey("outbox")) || "[]");
        outbox.push({ payload, queuedAt: new Date().toISOString() });
        window.localStorage.setItem(storageKey("outbox"), JSON.stringify(outbox).slice(0, 750000));
        if (saveState) saveState.textContent = "Offline draft queued";
    }

    async function flushOutbox() {
        const outbox = JSON.parse(window.localStorage.getItem(storageKey("outbox")) || "[]");
        if (!outbox.length || !navigator.onLine) return;
        const remaining = [];
        for (const entry of outbox) {
            try {
                await apiPost(entry.payload, false);
            } catch (error) {
                const errStatus = error.status;
                const isTemporary = errStatus === undefined || errStatus >= 500;
                if (isTemporary) {
                    remaining.push(entry);
                }
            }
        }
        window.localStorage.setItem(storageKey("outbox"), JSON.stringify(remaining));
    }

    function currentMarkdown() {
        return document.body.classList.contains("markdown-mode")
            ? markdownSource.value
            : htmlToMarkdown(editor);
    }

    function updatePreview() {
        const markdown = currentMarkdown();
        if (preview) preview.innerHTML = markdownToHtml(markdown);
        if (outline) {
            const headings = markdown.split(/\r?\n/)
                .filter((line) => /^#{1,3}\s+/.test(line))
                .map((line) => {
                    const level = line.match(/^#+/)?.[0].length || 1;
                    return `<button type="button" style="margin-left:${(level - 1) * 14}px">${escapeHtml(line.replace(/^#{1,3}\s+/, ""))}</button>`;
                });
            outline.innerHTML = headings.length ? headings.join("") : "<p>No headings yet.</p>";
        }
    }

    function renderTreeBranch(parentId = null) {
        const children = nodes.filter((node) => (node.parent_id ?? null) === parentId);
        if (!children.length) return "";
        return `<ul>${children.map((node) => `<li>
            <button type="button" class="tree-item" data-node-id="${escapeHtml(node.node_id)}" data-node-type="${escapeHtml(node.type)}">
                <span class="tree-icon">${node.type === "folder" ? ">" : "[]"}</span>
                <span>${escapeHtml(node.title)}</span>
            </button>
            ${renderTreeBranch(node.id)}
        </li>`).join("")}</ul>`;
    }

    function renderTree() {
        if (!tree) return;
        tree.innerHTML = renderTreeBranch();
        document.querySelectorAll(".tree-item").forEach((item) => item.classList.toggle("active", item.dataset.nodeId === activeNodeId));
    }

    function renderNode() {
        const node = activeNode();
        if (!node) return;
        if (titleInput) titleInput.value = node.title || "Untitled";
        if (editor) editor.innerHTML = markdownToHtml(node.markdown || "");
        if (markdownSource) markdownSource.value = node.markdown || "";
        renderTree();
        updatePreview();
        loadComments().catch(() => {});
    }

    function scheduleSave() {
        const node = activeNode();
        if (!node || !editor || !node.node_id || node.node_id.includes("_demo")) {
            if (saveState) saveState.textContent = "Create a space to save";
            return;
        }
        dirty = true;
        node.title = titleInput?.value || node.title;
        node.markdown = currentMarkdown();
        node.updated_at = new Date().toISOString();
        updatePreview();
        if (saveState) saveState.textContent = "Saving";
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(async () => {
            try {
                await apiPost({
                    action: "update-node",
                    nodeId: node.node_id,
                    title: node.title,
                    markdown: node.markdown
                });
                dirty = false;
                if (saveState) saveState.textContent = "Saved";
                broadcast({ type: "node-updated", node });
                sendRealtime({ type: "node-updated", node });
            } catch {
                window.localStorage.setItem(storageKey(`draft:${node.node_id}`), JSON.stringify(node));
            }
        }, 650);
    }

    function exec(command, value = null) {
        editor.focus();
        document.execCommand(command, false, value);
        scheduleSave();
    }

    function insertHtml(html) {
        editor.focus();
        document.execCommand("insertHTML", false, html);
        scheduleSave();
    }

    function insertBlock(kind) {
        if (kind === "table") insertHtml('<table><tbody><tr><td>Column</td><td>Column</td></tr><tr><td>Value</td><td>Value</td></tr></tbody></table><p><br></p>');
        else if (kind === "kanban") insertHtml('<table><tbody><tr><td>Backlog</td><td>Doing</td><td>Done</td></tr><tr><td>Idea</td><td>Draft</td><td>Shipped</td></tr></tbody></table><p><br></p>');
        else if (kind === "task") insertHtml('<p><input type="checkbox"> Task</p>');
        else if (kind === "quote") insertHtml("<blockquote>Quote</blockquote><p><br></p>");
        else if (kind === "image") {
            const src = window.prompt("Image URL");
            if (src) insertHtml(`<p><img src="${escapeHtml(src)}" alt=""></p>`);
        } else if (kind === "link") {
            const href = window.prompt("Link URL");
            if (href) exec("createLink", href);
        }
    }

    async function createNode(type) {
        const parent = activeNode();
        const title = type === "folder" ? "New folder" : "Untitled";
        const local = {
            id: Date.now(),
            node_id: `${type}_local_${Date.now()}`,
            parent_id: parent?.type === "folder" ? parent.id : null,
            type,
            title,
            slug: title.toLowerCase().replace(/\s+/g, "-"),
            path: title.toLowerCase().replace(/\s+/g, "-"),
            sort_order: Date.now(),
            markdown: type === "page" ? `# ${title}\n\n` : "",
            status: "active"
        };
        nodes.push(local);
        activeNodeId = local.node_id;
        renderNode();
        if (!app.space?.space_id || app.space.space_id === "sp_demo") return;
        try {
            const result = await apiPost({
                action: "create-node",
                spaceId: app.space.space_id,
                parentNodeId: parent?.type === "folder" ? parent.node_id : "",
                type,
                title,
                markdown: local.markdown
            });
            if (result.node) {
                Object.assign(local, result.node);
                broadcast({ type: "node-updated", node: local });
                sendRealtime({ type: "node-updated", node: local });
            }
            activeNodeId = local.node_id;
            renderNode();
        } catch {}
    }

    async function createSpace(values) {
        const result = await apiPost({ action: "create-space", name: values.name });
        if (result.space?.space_id) {
            app.space = result.space;
            await apiPost({
                action: "update-space",
                spaceId: result.space.space_id,
                name: values.name,
                description: values.description,
                visibility: values.visibility
            }, false).catch(() => null);
            window.location.href = `${app.basePath === "/" ? "" : app.basePath}/${result.space.space_id}`.replace(/\/+/g, "/");
        }
    }

    function openPanel(name) {
        document.body.classList.add("panel-open");
        document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.viewPanel !== name));
        const title = document.querySelector("[data-details-title]");
        if (title) title.textContent = name.slice(0, 1).toUpperCase() + name.slice(1);
    }

    async function loadComments() {
        const node = activeNode();
        if (!commentsList || !node?.node_id || node.node_id.includes("_demo")) {
            commentsList.innerHTML = "<p>No comments on unsaved pages.</p>";
            return;
        }
        const result = await apiGet({ action: "comments", nodeId: node.node_id });
        const comments = Array.isArray(result.comments) ? result.comments : [];
        commentsList.innerHTML = comments.length
            ? comments.map((comment) => `<div class="share-row"><strong>Comment</strong><span>${escapeHtml(comment.body_markdown)}</span></div>`).join("")
            : "<p>No comments yet.</p>";
    }

    function renderShares() {
        if (!shareList) return;
        shareList.innerHTML = shares.length
            ? shares.map((share) => `<div class="share-row"><strong>${escapeHtml(share.label || share.share_id)}</strong><span>${escapeHtml(share.role || "viewer")} - ${escapeHtml(share.status || "active")}</span><button type="button" data-share-id="${escapeHtml(share.share_id)}">Revoke</button></div>`).join("")
            : "<p>No share links yet.</p>";
    }

    async function syncRemote() {
        if (!app.space?.space_id || app.space.space_id === "sp_demo" || dirty) return;
        try {
            const result = await apiGet({ action: "sync", spaceId: app.space.space_id, since: lastSync });
            lastSync = result.serverTime || new Date().toISOString();
            window.localStorage.setItem(syncKey(), lastSync);
            (result.nodes || []).forEach((remote) => {
                const local = nodes.find((node) => node.node_id === remote.node_id);
                if (local) Object.assign(local, remote);
                else nodes.push(remote);
            });
            renderTree();
            if (result.nodes?.some((node) => node.node_id === activeNodeId)) renderNode();
        } catch {}
    }

    let ws = null;
    function websocketOpen() {
        return ws && ws.readyState === WebSocket.OPEN;
    }

    function sendRealtime(message) {
        if (websocketOpen()) {
            ws.send(JSON.stringify({ ...message, spaceId: app.space?.space_id }));
        }
    }

    function scheduleFallbackSync() {
        window.clearTimeout(fallbackSyncTimer);
        fallbackSyncTimer = window.setTimeout(async () => {
            if (!websocketOpen()) {
                await syncRemote();
                scheduleFallbackSync();
            }
        }, websocketOpen() ? 60_000 : 15_000);
    }

    function connectWebSocket() {
        if (!app.space?.space_id || app.space.space_id === "sp_demo") return;
        window.clearTimeout(reconnectTimer);
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}${app.basePath === "/" ? "" : app.basePath}/ws`;
        
        try {
            ws = new WebSocket(wsUrl);
            ws.onopen = () => {
                reconnectDelay = 1000;
                syncRemote().catch(() => {});
                flushOutbox().catch(() => {});
                if (saveState) saveState.textContent = dirty ? "Saving" : "Live";
                scheduleFallbackSync();
            };
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.spaceId !== app.space?.space_id) return;
                    
                    if (data.type === "node-updated") {
                        const remote = data.node;
                        const local = nodes.find((node) => node.node_id === remote.node_id);
                        if (local) {
                            if (!dirty || local.node_id !== activeNodeId) {
                                Object.assign(local, remote);
                                if (remote.node_id === activeNodeId) renderNode();
                                else renderTree();
                            }
                        } else {
                            nodes.push(remote);
                            renderTree();
                        }
                    } else if (data.type === "comment-added") {
                        if (data.nodeId === activeNodeId) {
                            loadComments().catch(() => {});
                        }
                    } else if (data.type === "sync-request") {
                        syncRemote().catch(() => {});
                    }
                } catch (e) {
                    console.error("Error handling WS message:", e);
                }
            };
            ws.onclose = () => {
                if (saveState && !dirty) saveState.textContent = "Offline";
                scheduleFallbackSync();
                reconnectTimer = window.setTimeout(connectWebSocket, reconnectDelay);
                reconnectDelay = Math.min(reconnectDelay * 2, 30000);
            };
            ws.onerror = () => {
                ws.close();
            };
        } catch (e) {
            console.error("Failed to connect websocket:", e);
        }
    }

    const tableGroup = document.querySelector(".table-actions-group");

    function getSelectedCell() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return lastTableCell?.isConnected ? lastTableCell : null;
        let node = selection.getRangeAt(0).startContainer;
        while (node && node !== editor) {
            if (node.nodeName === "TD" || node.nodeName === "TH") {
                lastTableCell = node;
                return node;
            }
            node = node.parentNode;
        }
        return lastTableCell?.isConnected ? lastTableCell : null;
    }

    function addRow(below = true) {
        const cell = getSelectedCell();
        if (!cell) return;
        const tr = cell.closest("tr");
        const table = cell.closest("table");
        if (!tr || !table) return;
        
        const newTr = document.createElement("tr");
        const colCount = tr.cells.length;
        for (let i = 0; i < colCount; i++) {
            const newCell = document.createElement("td");
            newCell.innerHTML = "New cell";
            newTr.appendChild(newCell);
        }
        if (below) {
            tr.parentNode.insertBefore(newTr, tr.nextSibling);
        } else {
            tr.parentNode.insertBefore(newTr, tr);
        }
        scheduleSave();
    }

    function addColumn(right = true) {
        const cell = getSelectedCell();
        if (!cell) return;
        const tr = cell.closest("tr");
        const table = cell.closest("table");
        if (!tr || !table) return;
        
        const index = cell.cellIndex;
        const insertIndex = right ? index + 1 : index;
        
        const rows = table.querySelectorAll("tr");
        rows.forEach((row) => {
            const tag = row.parentNode.nodeName === "THEAD" ? "th" : "td";
            const newCell = document.createElement(tag);
            newCell.innerHTML = "New cell";
            if (insertIndex >= row.cells.length) {
                row.appendChild(newCell);
            } else {
                row.insertBefore(newCell, row.cells[insertIndex]);
            }
        });
        scheduleSave();
    }

    function deleteRow() {
        const cell = getSelectedCell();
        if (!cell) return;
        const tr = cell.closest("tr");
        if (!tr) return;
        tr.remove();
        scheduleSave();
    }

    function deleteColumn() {
        const cell = getSelectedCell();
        if (!cell) return;
        const tr = cell.closest("tr");
        const table = cell.closest("table");
        if (!tr || !table) return;
        
        const index = cell.cellIndex;
        const rows = table.querySelectorAll("tr");
        rows.forEach((row) => {
            if (row.cells[index]) {
                row.cells[index].remove();
            }
        });
        scheduleSave();
    }

    function updateToolbarState() {
        if (!tableGroup) return;
        const cell = getSelectedCell();
        if (cell) {
            tableGroup.style.display = "flex";
        } else {
            tableGroup.style.display = "none";
        }
    }

    function applyHeadingToSelection(tag) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (range.collapsed) {
            document.execCommand("formatBlock", false, tag);
            scheduleSave();
            return;
        }

        const selectedContent = range.extractContents();
        const inline = document.createElement("span");
        inline.className = tag === "h1" ? "inline-heading-h1" : "inline-heading-h2";
        inline.appendChild(selectedContent);
        range.insertNode(inline);
        selection.removeAllRanges();
        const nextRange = document.createRange();
        nextRange.selectNodeContents(inline);
        selection.addRange(nextRange);
        
        scheduleSave();
    }

    const channel = "BroadcastChannel" in window ? new BroadcastChannel("proworkspace-notes") : null;
    function broadcast(message) {
        channel?.postMessage({ ...message, spaceId: app.space?.space_id });
    }
    channel?.addEventListener("message", (event) => {
        if (event.data?.spaceId !== app.space?.space_id || event.data?.type !== "node-updated") return;
        const remote = event.data.node;
        const local = nodes.find((node) => node.node_id === remote.node_id);
        if (local) Object.assign(local, remote);
        else nodes.push(remote);
        if (!dirty && remote.node_id === activeNodeId) renderNode();
        else renderTree();
    });

    function applyTheme(mode) {
        const resolved = mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : mode === "dark" ? "dark" : "light";
        document.documentElement.classList.remove("system", "dark", "light");
        document.documentElement.classList.add(mode);
        if (mode === "system") document.documentElement.classList.add(resolved);
        document.documentElement.style.colorScheme = resolved;
        document.cookie = `theme=${encodeURIComponent(mode)}; Path=/; Max-Age=31536000; SameSite=Lax`;
        document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
            button.dataset.themeMode = mode;
            const icon = button.querySelector("[data-theme-icon]");
            if (icon) icon.textContent = themeIcons[mode] || "S";
        });
    }

    function getThemeMode() {
        const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("theme="));
        const mode = match ? decodeURIComponent(match.slice(6)) : "system";
        return themeOrder[mode] ? mode : "system";
    }

    document.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target.closest("button, a") : null;
        if (!target) return;
        if (target.matches("[data-node-id]")) {
            activeNodeId = target.dataset.nodeId;
            dirty = false;
            renderNode();
        } else if (target.matches("[data-action='toggle-sidebar']")) {
            document.body.classList.toggle("sidebar-open");
            document.body.classList.toggle("sidebar-collapsed");
        } else if (target.matches("[data-action='close-panel']")) {
            document.body.classList.remove("panel-open");
        } else if (target.matches("[data-panel]")) {
            openPanel(target.dataset.panel || "share");
        } else if (target.matches("[data-action='new-space']")) {
            spaceModal?.showModal();
        } else if (target.matches("[data-action='close-space-modal']")) {
            spaceModal?.close();
        } else if (target.matches("[data-action='new-page']")) {
            await createNode("page");
        } else if (target.matches("[data-action='new-folder']")) {
            await createNode("folder");
        } else if (target.matches("[data-table-op]")) {
            event.preventDefault();
            const op = target.dataset.tableOp;
            if (op === "add-row-above") addRow(false);
            else if (op === "add-row-below") addRow(true);
            else if (op === "add-col-left") addColumn(false);
            else if (op === "add-col-right") addColumn(true);
            else if (op === "delete-row") deleteRow();
            else if (op === "delete-col") deleteColumn();
        } else if (target.matches("[data-command]")) {
            const cmd = target.dataset.command;
            const val = target.dataset.value || null;
            if (cmd === "formatBlock" && (val === "h1" || val === "h2")) {
                applyHeadingToSelection(val);
            } else {
                exec(cmd, val);
            }
        } else if (target.matches("[data-block]")) {
            insertBlock(target.dataset.block);
        } else if (target.matches("[data-action='toggle-mode']")) {
            const markdownMode = !document.body.classList.contains("markdown-mode");
            if (markdownMode) markdownSource.value = htmlToMarkdown(editor);
            else editor.innerHTML = markdownToHtml(markdownSource.value);
            document.body.classList.toggle("markdown-mode", markdownMode);
            target.textContent = markdownMode ? "Visual" : "Markdown";
            updatePreview();
        } else if (target.matches("[data-view]")) {
            document.querySelectorAll("[data-view]").forEach((button) => button.classList.remove("active"));
            target.classList.add("active");
            preview?.classList.toggle("hidden", target.dataset.view !== "preview");
            outline?.classList.toggle("hidden", target.dataset.view !== "outline");
            activity?.classList.toggle("hidden", target.dataset.view !== "activity");
        } else if (target.matches("[data-role]")) {
            activeRole = target.dataset.role || "viewer";
            document.querySelectorAll("[data-role]").forEach((button) => button.classList.toggle("active", button === target));
        } else if (target.matches("[data-action='save-space']")) {
            const result = await apiPost({
                action: "update-space",
                spaceId: app.space?.space_id,
                name: document.querySelector("[data-space-name]")?.value || "",
                description: document.querySelector("[data-space-description]")?.value || "",
                visibility: document.querySelector("[data-space-visibility]")?.value || "private"
            });
            if (result.space) app.space = result.space;
            if (saveState) saveState.textContent = "Space saved";
        } else if (target.matches("[data-action='invite']")) {
            const input = document.querySelector("[data-invite-email]");
            const email = input?.value?.trim();
            if (!email) return;
            await apiPost({ action: "invite", spaceId: app.space?.space_id, email, role: activeRole });
            input.value = "";
            if (saveState) saveState.textContent = "Invite saved";
        } else if (target.matches("[data-action='create-share']")) {
            const mode = document.querySelector("[data-share-mode]")?.value || "unlimited";
            const result = await apiPost({
                action: "create-share",
                spaceId: app.space?.space_id,
                nodeId: activeNodeId,
                label: mode === "one-time" ? "One-time link" : mode === "auth" ? "Signed-in link" : "Public link",
                maxUses: mode === "one-time" ? 1 : null,
                authRequired: mode === "auth"
            });
            if (result.share?.share_id) shares.unshift(result.share);
            else shares.unshift({ share_id: `local_${Date.now()}`, label: "Share link", role: "viewer", status: "active" });
            renderShares();
        } else if (target.matches("[data-share-id]")) {
            await apiPost({ action: "revoke-share", shareId: target.dataset.shareId });
            target.closest(".share-row")?.remove();
        } else if (target.matches("[data-action='comment']")) {
            const input = document.querySelector("[data-comment]");
            const body = input?.value?.trim();
            if (!body) return;
            const targetNodeId = activeNode()?.node_id;
            if (!targetNodeId || targetNodeId.includes("_demo")) {
                if (saveState) saveState.textContent = "Save this page first";
                return;
            }
            await apiPost({ action: "comment", nodeId: targetNodeId, body });
            input.value = "";
            await loadComments();
            sendRealtime({ type: "comment-added", nodeId: targetNodeId });
        } else if (target.matches("[data-action='request-access']")) {
            await apiPost({ action: "request-access", spaceId: app.space?.space_id, nodeId: activeNodeId, role: "editor", message: "Requesting edit access." });
            if (saveState) saveState.textContent = "Access requested";
        } else if (target.matches("[data-action='save-labels']")) {
            const node = activeNode();
            if (!node?.id) return;
            const tagNames = (document.querySelector("[data-tags]")?.value || "").split(",").map((item) => item.trim()).filter(Boolean);
            const categoryName = (document.querySelector("[data-category]")?.value || "").trim();
            for (const name of tagNames) {
                const result = await apiPost({ action: "create-label", type: "tag", name });
                if (result.label?.id) await apiPost({ action: "link-label", labelPk: result.label.id, targetType: "node", targetPk: node.id });
            }
            if (categoryName) {
                const result = await apiPost({ action: "create-label", type: "category", name: categoryName });
                if (result.label?.id) await apiPost({ action: "link-label", labelPk: result.label.id, targetType: "node", targetPk: node.id });
            }
            if (saveState) saveState.textContent = "Tags saved";
        } else if (target.matches("[data-theme-toggle]")) {
            applyTheme(themeOrder[getThemeMode()]);
        }
    });

    document.addEventListener("mousedown", (event) => {
        const target = event.target instanceof Element ? event.target.closest("[data-table-op], [data-command], [data-block]") : null;
        if (target) event.preventDefault();
    });

    editor?.addEventListener("input", scheduleSave);
    markdownSource?.addEventListener("input", scheduleSave);
    titleInput?.addEventListener("input", scheduleSave);
    document.querySelector("[data-search]")?.addEventListener("input", async (event) => {
        const query = event.target.value.toLowerCase();
        document.querySelectorAll(".tree-item").forEach((item) => {
            item.closest("li").hidden = Boolean(query && !item.textContent.toLowerCase().includes(query));
        });
        if (query.length > 1 && app.space?.space_id && !app.space.space_id.includes("demo")) {
            try {
                const result = await apiGet({ action: "search", spaceId: app.space.space_id, q: query });
                if (searchResults) {
                    searchResults.innerHTML = (result.results || []).slice(0, 8).map((node) =>
                        `<button type="button" data-node-id="${escapeHtml(node.node_id)}">${escapeHtml(node.title)}<br><span>${escapeHtml(node.path || "")}</span></button>`
                    ).join("");
                }
                if (saveState) saveState.textContent = `${result.results?.length || 0} results`;
            } catch {}
        } else if (searchResults) {
            searchResults.innerHTML = "";
        }
    });

    spaceForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(spaceForm);
        await createSpace({
            name: String(formData.get("name") || ""),
            description: String(formData.get("description") || ""),
            visibility: String(formData.get("visibility") || "private")
        });
    });

    document.addEventListener("keydown", (event) => {
        const mod = event.metaKey || event.ctrlKey;
        if (mod && event.key.toLowerCase() === "s") {
            event.preventDefault();
            scheduleSave();
        } else if (mod && event.key.toLowerCase() === "b") {
            event.preventDefault();
            exec("bold");
        } else if (mod && event.key.toLowerCase() === "i") {
            event.preventDefault();
            exec("italic");
        } else if (mod && event.key.toLowerCase() === "k") {
            event.preventDefault();
            insertBlock("link");
        } else if (event.altKey && event.key === "1") {
            event.preventDefault();
            exec("formatBlock", "h1");
        } else if (event.altKey && event.key === "2") {
            event.preventDefault();
            exec("formatBlock", "h2");
        } else if (event.key === "/" && document.activeElement === editor) {
            if (saveState) saveState.textContent = "Use toolbar or shortcuts";
        }
    });

    window.addEventListener("online", () => {
        flushOutbox();
        syncRemote();
        connectWebSocket();
    });

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/notes/service-worker.js").catch(() => {});
    }

    renderShares();
    renderNode();
    applyTheme(getThemeMode());
    flushOutbox();
    connectWebSocket();
    document.addEventListener("selectionchange", updateToolbarState);
    editor?.addEventListener("click", updateToolbarState);
    editor?.addEventListener("keyup", updateToolbarState);
    scheduleFallbackSync();
})();
