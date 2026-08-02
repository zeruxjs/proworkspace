import type { ZeruxRequestContext } from "zeruxjs";
import { createNote, createVault, deleteNote, getNote, getVault, graph, listNotes, notesContext, relations, revisions, search, snapshot, updateNote } from "../../../../lib/notes.ts";

type Body = Record<string, unknown>;
const body = (value: unknown): Body => {
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Body;
    if (typeof value === "string") { try { return JSON.parse(value) as Body; } catch { return Object.fromEntries(new URLSearchParams(value)); } }
    return {};
};
const text = (value: Body, key: string, max = 500_000) => typeof value[key] === "string" ? value[key].slice(0, max) : "";
const fail = (message: string, status = 400) => ({ ok: false, status, message });

export const GET = async (context: ZeruxRequestContext) => {
    try {
        const user = await notesContext(context);
        const action = context.query.get("action") || "snapshot";
        const vaultId = context.query.get("vaultId") || "";
        if (action === "snapshot") return { ok: true, ...(await snapshot(user, vaultId)) };
        const vault = await getVault(vaultId, user);
        if (!vault) return fail("Vault not found.", 404);
        if (action === "search") return { ok: true, results: await search(vault.id, context.query.get("q") || "") };
        if (action === "graph") return { ok: true, graph: await graph(vault.id) };
        if (action === "relations" || action === "revisions") {
            const note = await getNote(context.query.get("noteId") || "", user);
            if (!note || note.space_id !== vault.id) return fail("Note not found.", 404);
            return action === "relations" ? { ok: true, relations: await relations(note) } : { ok: true, revisions: await revisions(note.id) };
        }
        return fail("Unknown request.");
    } catch (error) {
        return fail(error instanceof Error && error.message === "AUTH_REQUIRED" ? "Sign in is required." : error instanceof Error ? error.message : "Notes request failed.", error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500);
    }
};

export const POST = async (context: ZeruxRequestContext) => {
    try {
        const user = await notesContext(context); const input = body(context.body); const action = text(input, "action", 50);
        if (action === "create-vault") return { ok: true, vault: await createVault(user, text(input, "name", 190)) };
        const vault = await getVault(text(input, "vaultId", 100), user);
        if (!vault) return fail("Vault not found.", 404);
        if (action === "create-note" || action === "create-folder") {
            const parentId = Number(input.parentId);
            const note = await createNote(user, vault, { title: text(input, "title", 240), markdown: text(input, "markdown"), type: action === "create-folder" ? "folder" : "page", parentId: Number.isFinite(parentId) && parentId > 0 ? parentId : null, template: input.template === true });
            return { ok: true, note };
        }
        if (action === "daily-note") {
            const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
            const existing = (await listNotes(vault.id)).find((note) => note.title === date && note.type === "page");
            return { ok: true, note: existing ?? await createNote(user, vault, { title: date, markdown: `---\ndate: ${date}\ntags: [daily]\n---\n\n# ${date}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n`, type: "page" }) };
        }
        const note = await getNote(text(input, "noteId", 100), user);
        if (!note || note.space_id !== vault.id) return fail("Note not found.", 404);
        if (action === "save-note") return { ok: true, note: await updateNote(user, note, { title: text(input, "title", 240), markdown: text(input, "markdown"), ...(Object.prototype.hasOwnProperty.call(input, "parentId") ? { parentId: Number(input.parentId) || null } : {}) }) };
        if (action === "delete-note") { await deleteNote(note); return { ok: true }; }
        if (action === "duplicate-note") return { ok: true, note: await createNote(user, vault, { title: `${note.title} copy`, markdown: note.markdown, type: note.type, parentId: note.parent_id }) };
        if (action === "restore-revision") {
            const revisionId = text(input, "revisionId", 100); const history = await revisions(note.id); const revision = (history as Array<{ revision_id?: string; markdown?: string }>).find((item) => item.revision_id === revisionId);
            if (!revision) return fail("Revision not found.", 404);
            return { ok: true, note: await updateNote(user, note, { markdown: revision.markdown || "" }) };
        }
        return fail("Unknown action.");
    } catch (error) {
        return fail(error instanceof Error && error.message === "AUTH_REQUIRED" ? "Sign in is required." : error instanceof Error ? error.message : "Notes action failed.", error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500);
    }
};
