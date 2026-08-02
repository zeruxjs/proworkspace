import crypto from "node:crypto";
import { db } from "db";
import type { ZeruxRequestContext } from "zeruxjs";
import { getCurrentUser, type CurrentUser } from "./auth.ts";
import { createNotesTables } from "./db.ts";

export type Vault = { id: number; space_id: string; org_id: number; name: string; slug: string; description: string; created_at?: string; updated_at?: string };
export type Note = { id: number; node_id: string; space_id: number; parent_id: number | null; type: "page" | "folder"; title: string; slug: string; path: string; markdown: string; is_template: boolean; created_at?: string; updated_at?: string };

const rows = <T>(value: { rows?: unknown[] }) => (Array.isArray(value.rows) ? value.rows as T[] : []);
const first = <T>(value: { rows?: unknown[] }) => rows<T>(value)[0] ?? null;
const id = (prefix: string) => `${prefix}_${crypto.randomBytes(14).toString("base64url")}`;
const iso = () => new Date().toISOString();
export const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
export const slug = (value: string, fallback = "untitled") => value.trim().toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160) || `${fallback}-${Date.now().toString(36)}`;

export const notesContext = async (context: ZeruxRequestContext) => {
    await createNotesTables();
    const user = await getCurrentUser(context);
    if (!user) throw new Error("AUTH_REQUIRED");
    return user;
};

export const listVaults = async (user: CurrentUser) => rows<Vault>(await db.select({
    table: "notes_spaces", columns: ["id", "space_id", "org_id", "name", "slug", "description", "created_at", "updated_at"],
    where: { and: [{ field: "org_id", operator: "eq", value: user.org_id }, { field: "archived_at", operator: "isNull" }] }, orderBy: [{ by: "updated_at", direction: "desc" }]
}));

export const getVault = async (publicId: string, user: CurrentUser) => first<Vault>(await db.select({
    table: "notes_spaces", columns: ["id", "space_id", "org_id", "name", "slug", "description", "created_at", "updated_at"],
    where: { and: [{ field: "space_id", operator: "eq", value: publicId }, { field: "org_id", operator: "eq", value: user.org_id }, { field: "archived_at", operator: "isNull" }] }, limit: 1
}));

export const listNotes = async (vaultPk: number) => rows<Note>(await db.select({
    table: "notes_nodes", columns: ["id", "node_id", "space_id", "parent_id", "type", "title", "slug", "path", "markdown", "is_template", "created_at", "updated_at"],
    where: { and: [{ field: "space_id", operator: "eq", value: vaultPk }, { field: "status", operator: "eq", value: "active" }, { field: "deleted_at", operator: "isNull" }] },
    orderBy: [{ by: "sort_order", direction: "asc" }, { by: "title", direction: "asc" }]
}));

export const getNote = async (publicId: string, user: CurrentUser) => {
    const note = first<Note>(await db.select({ table: "notes_nodes", columns: ["id", "node_id", "space_id", "parent_id", "type", "title", "slug", "path", "markdown", "is_template", "created_at", "updated_at"], where: { and: [{ field: "node_id", operator: "eq", value: publicId }, { field: "deleted_at", operator: "isNull" }] }, limit: 1 }));
    if (!note) return null;
    const allowed = first<{ id: number }>(await db.select({ table: "notes_spaces", columns: ["id"], where: { and: [{ field: "id", operator: "eq", value: note.space_id }, { field: "org_id", operator: "eq", value: user.org_id }] }, limit: 1 }));
    return allowed ? note : null;
};

export const createVault = async (user: CurrentUser, name: string) => {
    const title = name.trim().slice(0, 190) || "My vault";
    const publicId = id("vault");
    const inserted = await db.insert({ table: "notes_spaces", values: { org_id: user.org_id, space_id: publicId, name: title, slug: slug(title, "vault"), description: "", icon: "vault", visibility: "private", default_role: "none", inheritance_mode: "inherit", encryption_mode: "standard", created_by: user.id, updated_by: user.id }, returning: ["id"] });
    const vaultPk = Number(inserted.insertedIds?.[0] ?? first<{ id: number }>(inserted)?.id);
    await db.insert({ table: "notes_members", values: { space_id: vaultPk, user_id: user.id, email: user.email, role: "owner", status: "active", invited_by: user.id } });
    const vault = await getVault(publicId, user);
    if (!vault) throw new Error("Vault could not be created.");
    await createNote(user, vault, { title: "Welcome", markdown: `---\ntags: [welcome]\n---\n\n# Welcome\n\nYour vault stores Markdown in PostgreSQL.\n\nTry a link to [[Ideas]], add #notes, or create today's daily note.\n\n## Start here\n\n- [ ] Create a note\n- [ ] Link two notes\n- [ ] Open backlinks`, type: "page", parentId: null });
    return vault;
};

const noteByPk = async (pk: number) => first<Note>(await db.select({ table: "notes_nodes", columns: ["id", "node_id", "space_id", "parent_id", "type", "title", "slug", "path", "markdown", "is_template", "created_at", "updated_at"], where: { field: "id", operator: "eq", value: pk }, limit: 1 }));

const uniquePath = async (vaultPk: number, parent: Note | null, title: string, ignorePk = 0) => {
    const base = `${parent?.path ? `${parent.path}/` : ""}${slug(title)}`;
    const notes = await listNotes(vaultPk);
    let candidate = base; let suffix = 2;
    while (notes.some((note) => note.path === candidate && note.id !== ignorePk)) candidate = `${base}-${suffix++}`;
    return candidate;
};

export const createNote = async (user: CurrentUser, vault: Vault, input: { title: string; markdown?: string; type?: "page" | "folder"; parentId?: number | null; template?: boolean }) => {
    const type = input.type === "folder" ? "folder" : "page";
    const title = input.title.trim().slice(0, 240) || (type === "folder" ? "New folder" : "Untitled");
    const parent = input.parentId ? await noteByPk(input.parentId) : null;
    if (parent && parent.space_id !== vault.id) throw new Error("Invalid parent folder.");
    const markdown = type === "page" ? (input.markdown ?? "") : "";
    const publicId = id(type === "page" ? "note" : "folder");
    await db.insert({ table: "notes_nodes", values: { space_id: vault.id, parent_id: parent?.id ?? null, node_id: publicId, type, title, slug: slug(title), path: await uniquePath(vault.id, parent, title), sort_order: Date.now(), markdown, excerpt: markdown.replace(/[#>*_`-]/g, "").replace(/\s+/g, " ").slice(0, 240), status: "active", is_template: Boolean(input.template), checksum: crypto.createHash("sha256").update(markdown).digest("hex"), created_by: user.id, updated_by: user.id }, returning: ["id"] });
    const note = await getNote(publicId, user);
    if (!note) throw new Error("Note could not be created.");
    if (type === "page") await indexNote(note);
    return note;
};

export const updateNote = async (user: CurrentUser, note: Note, input: { title?: string; markdown?: string; parentId?: number | null }) => {
    await db.insert({ table: "notes_revisions", values: { node_id: note.id, revision_id: id("revision"), markdown: note.markdown, summary: "Autosave", created_by: user.id } });
    const title = input.title?.trim().slice(0, 240) || note.title;
    const markdown = input.markdown ?? note.markdown;
    const parent = input.parentId ? await noteByPk(input.parentId) : input.parentId === null ? null : note.parent_id ? await noteByPk(note.parent_id) : null;
    await db.update({ table: "notes_nodes", values: { title, slug: slug(title), path: await uniquePath(note.space_id, parent, title, note.id), parent_id: parent?.id ?? null, markdown, excerpt: markdown.replace(/[#>*_`-]/g, "").replace(/\s+/g, " ").slice(0, 240), checksum: crypto.createHash("sha256").update(markdown).digest("hex"), updated_by: user.id, updated_at: iso() }, where: { field: "id", operator: "eq", value: note.id } });
    const updated = await getNote(note.node_id, user);
    if (!updated) throw new Error("Note was not found after saving.");
    await indexNote(updated);
    return updated;
};

export const deleteNote = async (note: Note) => db.update({ table: "notes_nodes", values: { status: "deleted", deleted_at: iso(), updated_at: iso() }, where: { field: "id", operator: "eq", value: note.id } });

type Parsed = { links: Array<Record<string, unknown>>; headings: Array<Record<string, unknown>>; blocks: Array<Record<string, unknown>>; properties: Array<Record<string, unknown>>; tags: Array<Record<string, unknown>> };
export const parseMarkdown = (markdown: string): Parsed => {
    const parsed: Parsed = { links: [], headings: [], blocks: [], properties: [], tags: [] };
    const lines = markdown.split(/\r?\n/); let frontmatter = lines[0]?.trim() === "---"; let fence = false;
    lines.forEach((raw, offset) => {
        const line = offset + 1;
        if (offset === 0 && frontmatter) return;
        if (frontmatter) { if (raw.trim() === "---") { frontmatter = false; return; } const match = raw.match(/^([\w-]+):\s*(.*)$/); if (match) parsed.properties.push({ property_key: match[1], property_value: match[2].trim(), value_type: match[2].trim().startsWith("[") ? "list" : "text" }); return; }
        if (raw.trim().startsWith("```")) { fence = !fence; return; } if (fence) return;
        const heading = raw.match(/^(#{1,6})\s+(.+?)\s*#*$/); if (heading) parsed.headings.push({ heading: heading[2], slug: slug(heading[2]), level: heading[1].length, line });
        const block = raw.match(/\s\^([\w-]+)\s*$/); if (block) parsed.blocks.push({ block_id: block[1], line, content: raw.replace(/\s\^[\w-]+\s*$/, "") });
        for (const match of raw.matchAll(/(!)?\[\[([^\]|#]+)(?:(#[^\]|]+))?(?:\|([^\]]+))?\]\]/g)) parsed.links.push({ target: match[2].trim(), subpath: (match[3] ?? "").replace(/^#/, ""), alias: (match[4] ?? "").trim(), kind: match[1] ? "embed" : "link", line });
        for (const match of raw.replace(/!?\[\[[^\]]+\]\]/g, "").replace(/`[^`]*`/g, "").matchAll(/(^|\s)#([\p{L}\p{N}_/-]+)/gu)) parsed.tags.push({ tag: match[2], line });
    });
    return parsed;
};

export const indexNote = async (note: Note) => {
    for (const table of ["notes_links", "notes_headings", "notes_blocks", "notes_properties", "notes_tags"]) await db.delete({ table, where: { field: table === "notes_links" ? "source_node_id" : "node_id", operator: "eq", value: note.id } });
    const parsed = parseMarkdown(note.markdown); const all = await listNotes(note.space_id);
    const target = (name: unknown) => all.find((item) => item.type === "page" && [item.title, item.path, item.slug].some((value) => value.toLowerCase() === String(name).toLowerCase()));
    if (parsed.links.length) await db.insert({ table: "notes_links", values: parsed.links.map((link) => ({ ...link, space_id: note.space_id, source_node_id: note.id, target_node_id: target(link.target)?.id ?? null })) });
    if (parsed.headings.length) await db.insert({ table: "notes_headings", values: parsed.headings.map((value) => ({ ...value, node_id: note.id })) });
    if (parsed.blocks.length) await db.insert({ table: "notes_blocks", values: parsed.blocks.map((value) => ({ ...value, node_id: note.id })) });
    if (parsed.properties.length) await db.insert({ table: "notes_properties", values: parsed.properties.map((value) => ({ ...value, node_id: note.id })) });
    if (parsed.tags.length) await db.insert({ table: "notes_tags", values: [...new Map(parsed.tags.map((value) => [String(value.tag).toLowerCase(), value])).values()].map((value) => ({ ...value, space_id: note.space_id, node_id: note.id })) });
};

export const relations = async (note: Note) => {
    const all = await listNotes(note.space_id); const byId = new Map(all.map((item) => [item.id, item]));
    const outgoing = rows<Record<string, unknown>>(await db.select({ table: "notes_links", columns: ["target_node_id", "target", "alias", "subpath", "kind", "line"], where: { field: "source_node_id", operator: "eq", value: note.id }));
    const backlinks = rows<Record<string, unknown>>(await db.select({ table: "notes_links", columns: ["source_node_id", "alias", "subpath", "kind", "line"], where: { field: "target_node_id", operator: "eq", value: note.id })).map((link) => ({ ...link, source: byId.get(Number(link.source_node_id)) }));
    const select = async (table: string, columns: string[]) => rows<Record<string, unknown>>(await db.select({ table, columns, where: { field: "node_id", operator: "eq", value: note.id } }));
    return { outgoing: outgoing.map((link) => ({ ...link, note: byId.get(Number(link.target_node_id)) })), backlinks, headings: await select("notes_headings", ["heading", "slug", "level", "line"]), properties: await select("notes_properties", ["property_key", "property_value", "value_type"]), tags: await select("notes_tags", ["tag", "line"]) };
};

export const graph = async (vaultPk: number) => ({ nodes: (await listNotes(vaultPk)).filter((note) => note.type === "page").map(({ id, node_id, title, path }) => ({ id, node_id, title, path })), edges: rows(await db.select({ table: "notes_links", columns: ["source_node_id", "target_node_id", "target", "kind"], where: { field: "space_id", operator: "eq", value: vaultPk } })) });
export const revisions = async (notePk: number) => rows(await db.select({ table: "notes_revisions", columns: ["id", "revision_id", "markdown", "summary", "created_at"], where: { field: "node_id", operator: "eq", value: notePk }, orderBy: [{ by: "created_at", direction: "desc" }], limit: 50 }));
export const search = async (vaultPk: number, query: string) => { const q = query.trim(); if (!q) return []; return rows<Note>(await db.select({ table: "notes_nodes", columns: ["id", "node_id", "space_id", "parent_id", "type", "title", "slug", "path", "markdown", "is_template", "created_at", "updated_at"], where: { and: [{ field: "space_id", operator: "eq", value: vaultPk }, { field: "deleted_at", operator: "isNull" }, { or: [{ field: "title", operator: "ilike", value: `%${q}%` }, { field: "markdown", operator: "ilike", value: `%${q}%` }] }] }, limit: 100 })); };

export const snapshot = async (user: CurrentUser, requestedVault = "") => {
    const vaults = await listVaults(user); const vault = vaults.find((item) => item.space_id === requestedVault) ?? vaults[0] ?? null;
    const notes = vault ? await listNotes(vault.id) : [];
    return { user: { id: user.id, name: `${user.first_name} ${user.last_name}`.trim(), email: user.email }, vaults, vault, notes };
};
