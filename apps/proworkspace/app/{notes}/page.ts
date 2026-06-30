import type { ZeruxRequestContext } from "zeruxjs";
import {
    escapeHtml,
    getNotesContext,
    listNodes,
    listShares,
    listSpaces,
    notesSeedMarkdown,
    renderMarkdownPreview
} from "../../lib/notes.ts";

const asJson = (value: unknown) =>
    JSON.stringify(value).replace(/</g, "\\u003c");

const publicBasePath = (context: ZeruxRequestContext) => {
    const multisite = typeof context.state.multisite === "object" && context.state.multisite !== null
        ? context.state.multisite as { originalPathname?: unknown; url?: unknown }
        : null;
    const url = typeof multisite?.url === "string" ? multisite.url : "";
    let registeredPath = "";
    try {
        const parsed = new URL(url.includes("://") ? url : `http://${url || "localhost"}`);
        registeredPath = parsed.pathname.replace(/\/+$/g, "");
    } catch {
        registeredPath = "";
    }

    if (registeredPath && registeredPath !== "/") {
        return registeredPath;
    }

    const original = typeof multisite?.originalPathname === "string" ? multisite.originalPathname : context.url.pathname;
    const first = original.split("/").filter(Boolean)[0];
    return first === "notes" ? "/notes" : "";
};

const sampleNodes = [
    {
        id: 1,
        node_id: "pg_demo",
        parent_id: null,
        type: "page",
        title: "Product notes",
        slug: "product-notes",
        path: "product-notes",
        sort_order: 1,
        markdown: notesSeedMarkdown,
        status: "active",
        is_encrypted: false
    },
    {
        id: 2,
        node_id: "fld_projects",
        parent_id: null,
        type: "folder",
        title: "Projects",
        slug: "projects",
        path: "projects",
        sort_order: 2,
        markdown: "",
        status: "active",
        is_encrypted: false
    },
    {
        id: 3,
        node_id: "pg_launch",
        parent_id: 2,
        type: "page",
        title: "Launch checklist",
        slug: "launch-checklist",
        path: "projects/launch-checklist",
        sort_order: 3,
        markdown: "# Launch checklist\n\n- Confirm permissions\n- Review public pages\n- Revoke expired share links\n\n## Owners\n\n@team@example.com",
        status: "active",
        is_encrypted: false
    }
];

const renderTree = (nodes: typeof sampleNodes, parentId: number | null = null): string => {
    const children = nodes.filter((node) => (node.parent_id ?? null) === parentId);
    if (children.length === 0) return "";

    return `<ul>${children.map((node) => `<li>
        <button type="button" class="tree-item" data-node-id="${escapeHtml(node.node_id)}" data-node-type="${escapeHtml(node.type)}">
            <span class="tree-icon">${node.type === "folder" ? ">" : "[]"}</span>
            <span>${escapeHtml(node.title)}</span>
        </button>
        ${renderTree(nodes, node.id)}
    </li>`).join("")}</ul>`;
};

const renderNotesPage = async (context: ZeruxRequestContext) => {
    const { orgId, user } = await getNotesContext(context);
    const spaces = await listSpaces(orgId, user);
    const requestedPath = typeof context.params.any === "string" ? context.params.any : "";
    const requestedSpaceId = requestedPath.split("/").filter(Boolean)[0] ?? "";
    const activeSpace = spaces.find((space) => space.space_id === requestedSpaceId || space.slug === requestedSpaceId) ?? spaces[0] ?? {
        id: 0,
        org_id: orgId,
        space_id: "sp_demo",
        name: "Notes",
        slug: "notes",
        description: "Notion style pages with Obsidian friendly Markdown.",
        icon: "book-open",
        visibility: "private",
        default_role: "none",
        inheritance_mode: "inherit_until_override",
        encryption_mode: "standard"
    };
    const nodes = activeSpace.id ? await listNodes(Number(activeSpace.id)) : sampleNodes;
    const requestedNodePath = requestedPath.split("/").filter(Boolean).slice(1).join("/");
    const activeNode = nodes.find((node) => node.path === requestedNodePath || node.slug === requestedNodePath) ??
        nodes.find((node) => node.type === "page") ??
        sampleNodes[0];
    const shares = activeSpace.id ? await listShares(Number(activeSpace.id)) : [];
    const userLabel = user ? `${user.first_name} ${user.last_name}` : "Public viewer";
    const basePath = publicBasePath(context);
    const apiPath = `${basePath}/api/workspace`.replace(/^\/api/, "/api");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(activeNode.title)} - ProWorkspace Notes</title>
    <meta name="theme-color" content="#2f6f5e">
    <link rel="manifest" href="/notes/manifest.webmanifest">
    <link rel="stylesheet" href="/notes/notes.css?v=20260531-1">
    <script>
        window.__PROWORKSPACE_NOTES__ = {
            space: ${asJson(activeSpace)},
            nodes: ${asJson(nodes)},
            shares: ${asJson(shares)},
            activeNodeId: ${asJson(activeNode.node_id)},
            basePath: ${asJson(basePath || "/")},
            apiPath: ${asJson(apiPath)}
        };
    </script>
    <script defer src="/notes/notes.js?v=20260531-1"></script>
</head>
<body>
    <div class="notes-shell">
        <aside class="spaces-rail" aria-label="Spaces">
            <a class="rail-brand" href="/" aria-label="ProWorkspace">P</a>
            <button class="space-dot active" type="button" title="${escapeHtml(activeSpace.name)}">${escapeHtml(activeSpace.name.slice(0, 1))}</button>
            <button class="icon-button" type="button" data-action="new-space" title="New space" aria-label="New space">+</button>
            <a class="icon-button" href="/notes/settings" title="Notes settings" aria-label="Notes settings">S</a>
        </aside>

        <aside class="notes-sidebar">
            <div class="sidebar-header">
                <div>
                    <p>Space</p>
                    <h1>${escapeHtml(activeSpace.name)}</h1>
                </div>
                <button class="icon-button" type="button" data-panel="space" aria-label="Space settings">S</button>
            </div>
            <div class="quick-actions">
                <button type="button" data-action="new-page">New page</button>
                <button type="button" data-action="new-folder">New folder</button>
            </div>
            <label class="search-box">
                <span>Search</span>
                <input data-search placeholder="Find pages, folders, comments">
            </label>
            <div class="search-results" data-search-results></div>
            <nav class="tree" data-tree aria-label="Pages and folders">
                ${renderTree(nodes as typeof sampleNodes)}
            </nav>
            <section class="shared-section">
                <div class="section-title">
                    <span>Shared</span>
                    <button type="button" data-panel="shares">Manage</button>
                </div>
                <a href="/notes/shared">Shared with me</a>
                <a href="/notes/requests">Access requests</a>
            </section>
        </aside>

        <main class="notes-main">
            <header class="topbar">
                <button class="icon-button mobile-only" type="button" data-action="toggle-sidebar" aria-label="Open sidebar">M</button>
                <nav class="breadcrumbs" data-breadcrumbs>
                    <a href="/notes/${escapeHtml(activeSpace.space_id)}">${escapeHtml(activeSpace.name)}</a>
                    ${activeNode.path.split("/").map((part) => `<span>/</span><a href="/notes/${escapeHtml(activeSpace.space_id)}/${escapeHtml(part)}">${escapeHtml(part)}</a>`).join("")}
                </nav>
                <div class="top-actions">
                    <span class="save-state" data-save-state>Saved</span>
                    <button type="button" data-action="toggle-mode">Markdown</button>
                    <button type="button" data-panel="comments">Comments</button>
                    <button type="button" data-panel="share">Share</button>
                    <button type="button" data-panel="settings">Settings</button>
                    <button class="icon-button" type="button" data-theme-toggle data-theme-mode="system" aria-label="Theme: System" title="Theme: System"><span data-theme-icon>S</span></button>
                    <span class="avatar" title="${escapeHtml(userLabel)}">${escapeHtml(userLabel.slice(0, 1).toUpperCase())}</span>
                </div>
            </header>

            <section class="editor-layout">
                <article class="editor-pane">
                    <div class="page-meta">
                        <input class="title-input" data-title value="${escapeHtml(activeNode.title)}" aria-label="Page title">
                        <div class="page-flags">
                            <span>${escapeHtml(activeNode.type)}</span>
                            <span>${escapeHtml(activeSpace.visibility)}</span>
                            <span>${activeNode.is_encrypted ? "Encrypted" : "Standard"}</span>
                        </div>
                    </div>
                    <div class="toolbar" role="toolbar" aria-label="Editor toolbar">
                        <button type="button" data-command="formatBlock" data-value="h1">H1</button>
                        <button type="button" data-command="formatBlock" data-value="h2">H2</button>
                        <button type="button" data-command="formatBlock" data-value="p">Text</button>
                        <button type="button" data-command="bold">B</button>
                        <button type="button" data-command="italic">I</button>
                        <button type="button" data-command="insertUnorderedList">List</button>
                        <button type="button" data-block="task">Task</button>
                        <button type="button" data-block="quote">Quote</button>
                        <button type="button" data-block="table">Table</button>
                        <button type="button" data-block="kanban">Kanban</button>
                        <button type="button" data-block="image">Image</button>
                        <button type="button" data-block="link">Link</button>
                        <button type="button" data-command="formatBlock" data-value="pre">Code</button>
                        <div class="table-actions-group">
                            <button type="button" data-table-op="add-row-above" title="Add Row Above">+ Row ⬆</button>
                            <button type="button" data-table-op="add-row-below" title="Add Row Below">+ Row ⬇</button>
                            <button type="button" data-table-op="add-col-left" title="Add Column Left">+ Col ⬅</button>
                            <button type="button" data-table-op="add-col-right" title="Add Column Right">+ Col ➡</button>
                            <button type="button" data-table-op="delete-row" title="Delete Row" style="color: var(--accent-2); font-weight: bold;">- Row</button>
                            <button type="button" data-table-op="delete-col" title="Delete Column" style="color: var(--accent-2); font-weight: bold;">- Col</button>
                        </div>
                    </div>
                    <div class="wysiwyg-editor" data-editor contenteditable="true" spellcheck="true" aria-label="Page editor"></div>
                    <textarea class="markdown-source" data-markdown spellcheck="false">${escapeHtml(activeNode.markdown)}</textarea>
                </article>

                <aside class="preview-pane">
                    <div class="preview-tabs">
                        <button class="active" type="button" data-view="preview">Preview</button>
                        <button type="button" data-view="outline">Outline</button>
                        <button type="button" data-view="activity">Activity</button>
                    </div>
                    <div class="markdown-preview" data-preview>${renderMarkdownPreview(activeNode.markdown)}</div>
                    <div class="outline hidden" data-outline></div>
                    <div class="activity hidden" data-activity>
                        <p>Markdown revisions, comments, and share changes are tracked in the notes tables.</p>
                    </div>
                </aside>
            </section>
        </main>

        <aside class="details-panel" data-details>
            <header>
                <h2 data-details-title>Share</h2>
                <button class="icon-button" type="button" data-action="close-panel" aria-label="Close panel">x</button>
            </header>
            <div class="panel-view" data-view-panel="share">
                <label class="field">
                    <span>Invite people</span>
                    <input data-invite-email type="email" placeholder="name@example.com">
                </label>
                <div class="segmented">
                    <button type="button" data-role="viewer">View</button>
                    <button type="button" data-role="commenter">Comment</button>
                    <button type="button" data-role="editor">Edit</button>
                </div>
                <button class="primary" type="button" data-action="invite">Invite</button>
                <hr>
                <label class="field">
                    <span>Share link</span>
                    <select data-share-mode>
                        <option value="unlimited">Unlimited views</option>
                        <option value="one-time">One-time link</option>
                        <option value="auth">Require sign in</option>
                    </select>
                </label>
                <button type="button" data-action="create-share">Create link</button>
                <div class="share-list" data-share-list>
                    ${shares.length ? shares.map((share) => `<div class="share-row">
                        <strong>${escapeHtml(share.label ?? share.share_id)}</strong>
                        <span>${escapeHtml(share.role)} - ${escapeHtml(share.status)}</span>
                        <button type="button" data-share-id="${escapeHtml(share.share_id)}">Revoke</button>
                    </div>`).join("") : "<p>No share links yet.</p>"}
                </div>
            </div>
            <div class="panel-view hidden" data-view-panel="comments">
                <label class="field">
                    <span>Comment</span>
                    <textarea data-comment placeholder="Use @email mentions anywhere"></textarea>
                </label>
                <button class="primary" type="button" data-action="comment">Add comment</button>
                <div data-comments-list></div>
            </div>
            <div class="panel-view hidden" data-view-panel="settings">
                <label class="field">
                    <span>Tags</span>
                    <input data-tags placeholder="product, roadmap">
                </label>
                <label class="field">
                    <span>Category</span>
                    <input data-category placeholder="Documentation">
                </label>
                <button type="button" data-action="save-labels">Save tags</button>
                <label class="field">
                    <span>Visibility</span>
                    <select data-visibility>
                        <option value="inherit">Inherit from parent</option>
                        <option value="private">Private</option>
                        <option value="workspace">Workspace</option>
                        <option value="public">Public</option>
                    </select>
                </label>
                <label class="check-row">
                    <input type="checkbox" data-encrypted>
                    <span>Prepare this page for future E2E encrypted storage</span>
                </label>
                <button type="button" data-action="request-access">Request access flow</button>
            </div>
            <div class="panel-view hidden" data-view-panel="space">
                <label class="field">
                    <span>Space name</span>
                    <input data-space-name value="${escapeHtml(activeSpace.name)}">
                </label>
                <label class="field">
                    <span>Description</span>
                    <textarea data-space-description>${escapeHtml(activeSpace.description ?? "")}</textarea>
                </label>
                <label class="field">
                    <span>Visibility</span>
                    <select data-space-visibility>
                        <option value="private"${activeSpace.visibility === "private" ? " selected" : ""}>Private</option>
                        <option value="workspace"${activeSpace.visibility === "workspace" ? " selected" : ""}>Workspace</option>
                        <option value="public"${activeSpace.visibility === "public" ? " selected" : ""}>Public</option>
                    </select>
                </label>
                <button class="primary" type="button" data-action="save-space">Save space</button>
            </div>
        </aside>

        <dialog class="modal" data-space-modal>
            <form method="dialog" class="modal-card" data-space-form>
                <header>
                    <h2>Create space</h2>
                    <button class="icon-button" type="button" data-action="close-space-modal" aria-label="Close">x</button>
                </header>
                <label class="field">
                    <span>Name</span>
                    <input name="name" required placeholder="Design docs">
                </label>
                <label class="field">
                    <span>Description</span>
                    <textarea name="description" placeholder="What this space is for"></textarea>
                </label>
                <label class="field">
                    <span>Visibility</span>
                    <select name="visibility">
                        <option value="private">Private</option>
                        <option value="workspace">Workspace</option>
                        <option value="public">Public</option>
                    </select>
                </label>
                <button class="primary" type="submit">Create</button>
            </form>
        </dialog>
    </div>
</body>
</html>`;
};

export default renderNotesPage;
