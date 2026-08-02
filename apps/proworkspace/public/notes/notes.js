(() => {
  const boot = window.__NOTES__ || {};
  const state = { user: boot.user, vaults: boot.vaults || [], vault: boot.vault, notes: boot.notes || [], activeId: null, selectedFolderId: null, dirty: false, preview: true, rightTab: "backlinks", relations: null };
  const $ = (selector) => document.querySelector(selector);
  const els = { empty: $("[data-empty]"), shell: $("[data-editor-shell]"), tree: $("[data-tree]"), title: $("[data-title]"), markdown: $("[data-markdown]"), preview: $("[data-preview]"), save: $("[data-save]"), vaultName: $("[data-vault-name]"), count: $("[data-count]"), sync: $("[data-sync]"), tabTitle: $("[data-tab-title]"), crumbs: $("[data-breadcrumbs]"), properties: $("[data-properties]"), words: $("[data-words]"), right: $("[data-right]"), rightContent: $("[data-right-content]"), search: $("[data-search]"), vaultDialog: $("[data-vault-dialog]"), vaultList: $("[data-vault-list]"), menu: $("[data-menu]"), toast: $("[data-toast]"), signin: $("[data-signin]") };
  let saveTimer = 0; let searchTimer = 0;
  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const active = () => state.notes.find((note) => note.node_id === state.activeId) || null;
  const noteByPk = (id) => state.notes.find((note) => Number(note.id) === Number(id));

  async function request(params = {}, payload) {
    const url = new URL(boot.api, location.origin); Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, payload ? { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(payload) } : { credentials: "same-origin", headers: { accept: "application/json" } });
    const result = await response.json().catch(() => ({}));
    if (result.status === 401) { els.signin.hidden = false; throw new Error("Sign in to use Notes."); }
    if (!response.ok || result.ok === false) throw new Error(result.message || "Request failed.");
    return result;
  }
  const post = (action, values = {}) => request({}, { action, vaultId: state.vault?.space_id, ...values });
  function notify(message) { els.toast.textContent = message; els.toast.hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => { els.toast.hidden = true; }, 2600); }

  function inline(value) {
    return esc(value)
      .replace(/!\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => `<div class="embed-card"><span>Embedded note</span><strong>${alias || target}</strong></div>`)
      .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => `<button class="wikilink" data-wikilink="${target}">${alias || target}</button>`)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(?<!\*)\*([^*]+)\*/g, "<em>$1</em>").replace(/~~([^~]+)~~/g, "<del>$1</del>");
  }
  function renderMarkdown(markdown) {
    const lines = String(markdown || "").split(/\r?\n/); const html = []; let fence = false; let list = null; let frontmatter = lines[0]?.trim() === "---"; let quote = false;
    const close = () => { if (list) { html.push(`</${list}>`); list = null; } if (quote) { html.push("</blockquote>"); quote = false; } };
    lines.forEach((line, index) => {
      if (index === 0 && frontmatter) { html.push('<div class="frontmatter"><span>Properties</span>'); return; }
      if (frontmatter) { if (line.trim() === "---") { frontmatter = false; html.push("</div>"); } else { const p = line.match(/^([\w-]+):\s*(.*)$/); if (p) html.push(`<div><strong>${esc(p[1])}</strong><span>${inline(p[2])}</span></div>`); } return; }
      if (line.trim().startsWith("```")) { close(); fence = !fence; html.push(fence ? `<pre><code data-language="${esc(line.trim().slice(3))}">` : "</code></pre>"); return; }
      if (fence) { html.push(`${esc(line)}\n`); return; }
      if (!line.trim()) { close(); return; }
      const h = line.match(/^(#{1,6})\s+(.+)$/); if (h) { close(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); return; }
      if (/^>\s?/.test(line)) { if (!quote) { close(); html.push("<blockquote>"); quote = true; } html.push(`<p>${inline(line.replace(/^>\s?/, ""))}</p>`); return; }
      const task = line.match(/^\s*- \[([ xX])\]\s+(.+)$/); if (task) { if (list !== "ul") { close(); list = "ul"; html.push('<ul class="tasks">'); } html.push(`<li><input type="checkbox" disabled ${task[1].toLowerCase() === "x" ? "checked" : ""}><span>${inline(task[2])}</span></li>`); return; }
      const bullet = line.match(/^\s*[-*+]\s+(.+)$/); if (bullet) { if (list !== "ul") { close(); list = "ul"; html.push("<ul>"); } html.push(`<li>${inline(bullet[1])}</li>`); return; }
      const ordered = line.match(/^\s*\d+\.\s+(.+)$/); if (ordered) { if (list !== "ol") { close(); list = "ol"; html.push("<ol>"); } html.push(`<li>${inline(ordered[1])}</li>`); return; }
      close(); html.push(`<p>${inline(line).replace(/(^|\s)#([\w/-]+)/g, '$1<span class="tag">#$2</span>')}</p>`);
    }); close(); if (fence) html.push("</code></pre>"); return html.join("");
  }

  function visibleNotes() { return state.notes.filter((note) => !note.deleted_at); }
  function treeBranch(parentId = null, depth = 0) {
    return visibleNotes().filter((note) => (note.parent_id ?? null) === parentId).sort((a, b) => a.type === b.type ? a.title.localeCompare(b.title) : a.type === "folder" ? -1 : 1).map((note) => `<div class="tree-row ${note.node_id === state.activeId || note.id === state.selectedFolderId ? "active" : ""}" style="--depth:${depth}" data-note-id="${esc(note.node_id)}"><span class="tree-icon">${note.type === "folder" ? "▾" : "◇"}</span><span>${esc(note.title)}</span>${note.type === "page" ? "" : `<span class="tree-create"><button data-new-in="page" data-parent-id="${note.id}" title="New note inside">＋</button><button data-new-in="folder" data-parent-id="${note.id}" title="New subfolder inside">▱</button></span>`}</div>${note.type === "folder" ? treeBranch(note.id, depth + 1) : ""}`).join("");
  }
  function renderTree(notes = visibleNotes()) {
    if (notes !== state.notes && notes.length !== visibleNotes().length) els.tree.innerHTML = notes.map((note) => `<div class="tree-row search-result" data-note-id="${esc(note.node_id)}"><span class="tree-icon">⌕</span><span><strong>${esc(note.title)}</strong><small>${esc(note.path)}</small></span></div>`).join("") || '<div class="tree-message">No matching notes</div>';
    else els.tree.innerHTML = treeBranch() || '<div class="tree-message">No notes yet</div>';
    els.count.textContent = `${visibleNotes().filter((note) => note.type === "page").length} notes`;
  }
  function parseProperties(markdown) {
    if (!markdown.startsWith("---\n")) return []; const end = markdown.indexOf("\n---", 4); if (end < 0) return [];
    return markdown.slice(4, end).split("\n").map((line) => line.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map((match) => ({ key: match[1], value: match[2] }));
  }
  function renderNote(note) {
    state.activeId = note?.node_id || null; if (note) state.selectedFolderId = note.parent_id ?? null; state.dirty = false; els.empty.hidden = Boolean(note); els.shell.hidden = !note;
    if (!note) { renderTree(); return; }
    els.title.value = note.title; els.markdown.value = note.markdown || ""; els.preview.innerHTML = renderMarkdown(note.markdown); els.tabTitle.textContent = note.title; els.save.textContent = "Saved";
    const parts = note.path.split("/"); els.crumbs.innerHTML = `<span>${esc(state.vault.name)}</span>${parts.map((part) => `<i>/</i><span>${esc(part)}</span>`).join("")}`;
    els.properties.innerHTML = parseProperties(note.markdown).map((property) => `<span><strong>${esc(property.key)}</strong>${esc(property.value)}</span>`).join("");
    const words = (note.markdown.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length; els.words.textContent = `${words} words`;
    renderTree(); history.replaceState({}, "", state.vault ? `/${state.vault.space_id}/${note.path}` : "/"); loadRight().catch(() => {});
  }
  function renderApp() {
    els.vaultName.textContent = state.vault?.name || "No vault"; els.empty.hidden = Boolean(state.vault && visibleNotes().length); els.shell.hidden = true;
    if (!state.user) { els.signin.hidden = false; $("[data-command='create-vault']").hidden = true; }
    renderTree(); const first = visibleNotes().find((note) => note.type === "page"); if (first) renderNote(first);
  }

  async function save() {
    const note = active(); if (!note || note.type !== "page" || !state.dirty) return;
    els.save.textContent = "Saving…"; els.sync.textContent = "Syncing";
    try { const result = await post("save-note", { noteId: note.node_id, title: els.title.value.trim() || "Untitled", markdown: els.markdown.value }); Object.assign(note, result.note); state.dirty = false; els.save.textContent = "Saved"; els.sync.textContent = "Synced"; renderTree(); }
    catch (error) { els.save.textContent = "Save failed"; els.sync.textContent = "Offline"; localStorage.setItem(`notes:draft:${note.node_id}`, JSON.stringify({ title: els.title.value, markdown: els.markdown.value })); notify(error.message); }
  }
  function changed() { const note = active(); if (!note) return; note.title = els.title.value; note.markdown = els.markdown.value; state.dirty = true; els.save.textContent = "Unsaved"; els.preview.innerHTML = renderMarkdown(note.markdown); els.tabTitle.textContent = note.title || "Untitled"; const words = (note.markdown.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length; els.words.textContent = `${words} words`; clearTimeout(saveTimer); saveTimer = setTimeout(save, 700); }

  async function createItem(type, parentId = state.selectedFolderId) {
    if (!state.vault) return openVaultDialog(true); const title = type === "folder" ? "New folder" : "Untitled";
    try { const result = await post(type === "folder" ? "create-folder" : "create-note", { title, markdown: type === "page" ? "# Untitled\n\n" : "", parentId }); state.notes.push(result.note); renderTree(); if (type === "page") { renderNote(result.note); els.title.select(); } }
    catch (error) { notify(error.message); }
  }
  async function daily() { if (!state.vault) return openVaultDialog(true); try { const result = await post("daily-note"); if (!state.notes.some((note) => note.node_id === result.note.node_id)) state.notes.push(result.note); renderNote(state.notes.find((note) => note.node_id === result.note.node_id)); } catch (error) { notify(error.message); } }
  async function refresh(vaultId) { const result = await request({ action: "snapshot", ...(vaultId ? { vaultId } : {}) }); Object.assign(state, { user: result.user, vaults: result.vaults, vault: result.vault, notes: result.notes, activeId: null }); renderApp(); }

  async function loadRight() {
    const note = active(); if (!note || !state.vault || els.right.hidden) return;
    if (state.rightTab === "history") { const result = await request({ action: "revisions", vaultId: state.vault.space_id, noteId: note.node_id }); els.rightContent.innerHTML = result.revisions.length ? result.revisions.map((rev) => `<button class="history-row" data-revision-id="${esc(rev.revision_id)}"><strong>${new Date(rev.created_at).toLocaleString()}</strong><span>${esc(rev.summary || "Revision")}</span></button>`).join("") : '<div class="panel-empty">No revisions yet.</div>'; return; }
    const result = await request({ action: "relations", vaultId: state.vault.space_id, noteId: note.node_id }); state.relations = result.relations;
    if (state.rightTab === "outline") { els.rightContent.innerHTML = result.relations.headings.length ? result.relations.headings.map((h) => `<button class="outline-row" style="--level:${h.level}">${esc(h.heading)}</button>`).join("") : '<div class="panel-empty">Add headings to build an outline.</div>'; return; }
    const incoming = result.relations.backlinks.map((link) => `<button class="backlink" data-note-id="${esc(link.source.node_id)}"><strong>${esc(link.source.title)}</strong><span>Line ${link.line}</span></button>`).join("");
    const outgoing = result.relations.outgoing.map((link) => `<button class="backlink" ${link.note ? `data-note-id="${esc(link.note.node_id)}"` : "disabled"}><strong>${esc(link.note?.title || link.target)}</strong><span>${esc(link.kind)} · line ${link.line}</span></button>`).join("");
    els.rightContent.innerHTML = `<section><h3>Linked mentions <b>${result.relations.backlinks.length}</b></h3>${incoming || '<div class="panel-empty">No backlinks.</div>'}</section><section><h3>Outgoing links <b>${result.relations.outgoing.length}</b></h3>${outgoing || '<div class="panel-empty">No outgoing links.</div>'}</section><section><h3>Tags</h3><div class="tag-list">${result.relations.tags.map((t) => `<span>#${esc(t.tag)}</span>`).join("") || "None"}</div></section>`;
  }
  function openVaultDialog(focus = false) { els.vaultList.innerHTML = state.vaults.map((vault) => `<button type="button" data-vault-id="${esc(vault.space_id)}" class="vault-option ${vault.space_id === state.vault?.space_id ? "active" : ""}"><span>✦</span><strong>${esc(vault.name)}</strong></button>`).join("") || '<p class="panel-empty">No vaults yet.</p>'; els.vaultDialog.showModal(); if (focus) setTimeout(() => els.vaultDialog.querySelector("input").focus(), 50); }

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("button, a"); if (!target) return;
    if (target.dataset.newIn && target.dataset.parentId) { event.stopPropagation(); return createItem(target.dataset.newIn, Number(target.dataset.parentId)); }
    if (target.dataset.noteId) { await save(); const note = state.notes.find((item) => item.node_id === target.dataset.noteId); if (note?.type === "page") renderNote(note); else if (note?.type === "folder") { state.selectedFolderId = note.id; state.activeId = null; renderTree(); notify(`Creating inside ${note.title}`); } return; }
    if (target.dataset.wikilink) { const wanted = target.dataset.wikilink.toLowerCase(); const note = state.notes.find((item) => item.type === "page" && [item.title, item.path, item.slug].some((value) => String(value).toLowerCase() === wanted)); if (note) renderNote(note); else if (confirm(`Create “${target.dataset.wikilink}”?`)) { const result = await post("create-note", { title: target.dataset.wikilink, markdown: `# ${target.dataset.wikilink}\n\n` }); state.notes.push(result.note); renderNote(result.note); } return; }
    if (target.dataset.vaultId) { els.vaultDialog.close(); await save(); return refresh(target.dataset.vaultId); }
    const command = target.dataset.command;
    if (command === "new-note") return createItem("page"); if (command === "new-folder") return createItem("folder"); if (command === "daily") return daily();
    if (command === "create-vault" || command === "vault-menu") return openVaultDialog(true);
    if (command === "search-focus") return els.search.focus();
    if (command === "theme") { const dark = document.documentElement.classList.toggle("light"); localStorage.setItem("notes:theme", dark ? "light" : "dark"); return; }
    if (command === "toggle-preview") { state.preview = !state.preview; els.preview.hidden = !state.preview; $("[data-editor-grid]").classList.toggle("editor-only", !state.preview); return; }
    if (command === "relations") { els.right.hidden = !els.right.hidden; document.body.classList.toggle("right-open", !els.right.hidden); return loadRight(); }
    if (command === "graph") { els.right.hidden = false; document.body.classList.add("right-open"); const result = state.vault ? await request({ action: "graph", vaultId: state.vault.space_id }) : { graph: { nodes: [], edges: [] } }; els.rightContent.innerHTML = `<div class="graph-summary"><div><strong>${result.graph.nodes.length}</strong><span>notes</span></div><div><strong>${result.graph.edges.filter((e) => e.target_node_id).length}</strong><span>connections</span></div></div><div class="graph-list">${result.graph.nodes.map((node) => `<button data-note-id="${esc(node.node_id)}">${esc(node.title)}</button>`).join("")}</div>`; return; }
    if (command === "more") return active() && els.menu.showModal();
    if (target.dataset.rightTab) { state.rightTab = target.dataset.rightTab; document.querySelectorAll("[data-right-tab]").forEach((button) => button.classList.toggle("active", button === target)); return loadRight(); }
    if (target.dataset.revisionId && confirm("Restore this revision?")) { const result = await post("restore-revision", { noteId: active().node_id, revisionId: target.dataset.revisionId }); Object.assign(active(), result.note); renderNote(active()); notify("Revision restored"); }
  });

  els.vaultDialog.addEventListener("close", async () => { if (els.vaultDialog.returnValue !== "create") return; const input = els.vaultDialog.querySelector("input[name='vaultName']"); if (!input.value.trim()) return; try { const result = await request({}, { action: "create-vault", name: input.value.trim() }); input.value = ""; await refresh(result.vault.space_id); } catch (error) { notify(error.message); } });
  els.menu.addEventListener("close", async () => { const note = active(); const action = els.menu.returnValue; if (!note || !["duplicate", "delete", "move"].includes(action)) return; try { if (action === "delete" && confirm(`Delete “${note.title}”?`)) { await post("delete-note", { noteId: note.node_id }); state.notes = state.notes.filter((item) => item.node_id !== note.node_id); renderNote(visibleNotes().find((item) => item.type === "page") || null); } else if (action === "duplicate") { const result = await post("duplicate-note", { noteId: note.node_id }); state.notes.push(result.note); renderNote(result.note); } else if (action === "move") { const folders = state.notes.filter((item) => item.type === "folder"); const selected = prompt(`Folder ID (blank for root):\n${folders.map((f) => `${f.id}: ${f.title}`).join("\n")}`); const result = await post("save-note", { noteId: note.node_id, title: note.title, markdown: note.markdown, parentId: selected ? Number(selected) : null }); Object.assign(note, result.note); renderNote(note); } } catch (error) { notify(error.message); } });
  els.title.addEventListener("input", changed); els.markdown.addEventListener("input", changed);
  els.markdown.addEventListener("keydown", (event) => { if (event.key === "Tab") { event.preventDefault(); const start = els.markdown.selectionStart; els.markdown.setRangeText("  ", start, els.markdown.selectionEnd, "end"); changed(); } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(); } });
  els.search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(async () => { const q = els.search.value.trim(); if (!q) return renderTree(); try { const result = await request({ action: "search", vaultId: state.vault.space_id, q }); renderTree(result.results); } catch (error) { notify(error.message); } }, 180); });
  document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); els.search.focus(); } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") { event.preventDefault(); createItem("page"); } });
  window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
  if (localStorage.getItem("notes:theme") === "light") document.documentElement.classList.add("light"); renderApp();
})();
