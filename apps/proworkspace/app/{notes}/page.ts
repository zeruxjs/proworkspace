import type { ZeruxRequestContext } from "zeruxjs";
import { escapeHtml, notesContext, snapshot } from "../../lib/notes.ts";

const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
const basePath = (context: ZeruxRequestContext) => {
    const state = typeof context.state.multisite === "object" && context.state.multisite ? context.state.multisite as { originalPathname?: string; url?: string } : {};
    try { const path = new URL(state.url?.includes("://") ? state.url : `http://${state.url || "localhost"}`).pathname.replace(/\/$/, ""); if (path && path !== "/") return path; } catch {}
    return state.originalPathname?.split("/").filter(Boolean)[0] === "notes" ? "/notes" : "";
};

export default async function NotesPage(context: ZeruxRequestContext) {
    const base = basePath(context); const api = `${base}/api/workspace` || "/api/workspace";
    let initial: Record<string, unknown> = { user: null, vaults: [], vault: null, notes: [] };
    try { const user = await notesContext(context); const requested = typeof context.params.any === "string" ? context.params.any.split("/")[0] : ""; initial = await snapshot(user, requested); } catch {}
    const mainDomain = (process.env.MAIN_DOMAIN || "sh6.in").replace(/^\.+|\.+$/g, "");
    const accountUrl = mainDomain === "localhost" ? "/signin" : `https://accounts.${mainDomain}/signin?next=${encodeURIComponent(`https://notes.${mainDomain}/`)}`;
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notes · ProWorkspace</title><meta name="theme-color" content="#17141f"><link rel="stylesheet" href="/notes/notes.css?v=20260802"><script>window.__NOTES__=${json({ ...initial, api, accountUrl })}</script><script defer src="/notes/notes.js?v=20260802"></script></head>
<body>
<div class="app" data-app>
  <aside class="activity-bar">
    <a class="brand" href="/" title="ProWorkspace">P</a>
    <button class="activity active" data-command="files" title="Files">▱</button>
    <button class="activity" data-command="search-focus" title="Search">⌕</button>
    <button class="activity" data-command="graph" title="Graph">⌘</button>
    <button class="activity" data-command="daily" title="Daily note">▣</button>
    <span class="activity-spacer"></span>
    <button class="activity" data-command="theme" title="Theme">◐</button>
    <a class="activity" href="${escapeHtml(accountUrl)}" title="Account">◎</a>
  </aside>
  <aside class="sidebar" data-sidebar>
    <header class="vault-header"><button class="vault-switch" data-command="vault-menu"><strong data-vault-name>No vault</strong><span>⌄</span></button><button data-command="new-note" title="New note">＋</button></header>
    <div class="sidebar-actions"><button data-command="new-note">New note</button><button data-command="new-folder">New folder</button></div>
    <label class="search"><span>⌕</span><input data-search placeholder="Search notes…" autocomplete="off"><kbd>⌘K</kbd></label>
    <div class="file-tree" data-tree></div>
    <footer class="sidebar-footer"><span data-count>0 notes</span><span data-sync>Ready</span></footer>
  </aside>
  <main class="workspace">
    <header class="workspace-bar"><div class="tabs"><button class="tab active"><span data-tab-title>Notes</span><span>×</span></button></div><div class="workspace-actions"><button data-command="toggle-preview" title="Toggle reading view">◫</button><button data-command="relations" title="Right sidebar">◧</button><button data-command="more" title="More">•••</button></div></header>
    <section class="empty-state" data-empty>
      <div class="empty-mark">✦</div><h1>Your knowledge, connected.</h1><p>Create a database-backed Markdown vault. Link ideas with <code>[[wikilinks]]</code>, explore backlinks, and keep every revision.</p>
      <button class="primary" data-command="create-vault">Create your first vault</button><a class="signin-link" href="${escapeHtml(accountUrl)}" data-signin hidden>Sign in to Notes</a>
    </section>
    <section class="editor-shell" data-editor-shell hidden>
      <header class="note-header"><div class="breadcrumbs" data-breadcrumbs></div><div class="save-status" data-save>Saved</div></header>
      <div class="properties" data-properties></div>
      <input class="note-title" data-title placeholder="Untitled" maxlength="240">
      <div class="editor-grid" data-editor-grid>
        <textarea class="markdown-editor" data-markdown spellcheck="true" aria-label="Markdown editor"></textarea>
        <article class="preview" data-preview></article>
      </div>
      <footer class="statusbar"><span data-words>0 words</span><span>Markdown</span><span>UTF-8</span></footer>
    </section>
  </main>
  <aside class="right-sidebar" data-right hidden>
    <header><div class="right-tabs"><button class="active" data-right-tab="backlinks">Backlinks</button><button data-right-tab="outline">Outline</button><button data-right-tab="history">History</button></div><button data-command="relations">×</button></header>
    <div class="right-content" data-right-content></div>
  </aside>
</div>
<dialog data-vault-dialog><form method="dialog"><header><h2>Vaults</h2><button value="cancel">×</button></header><div data-vault-list></div><label>New vault<input name="vaultName" placeholder="My knowledge base" maxlength="190"></label><button class="primary" value="create">Create vault</button></form></dialog>
<dialog data-menu><form method="dialog"><button value="duplicate">Duplicate note</button><button value="move">Move note…</button><button value="delete" class="danger">Delete note</button></form></dialog>
<div class="toast" data-toast hidden></div>
</body></html>`;
}
