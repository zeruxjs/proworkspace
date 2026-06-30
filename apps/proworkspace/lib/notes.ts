import crypto from "node:crypto";
import { db } from "db";
import type { ZeruxRequestContext } from "zeruxjs";
import { getCurrentUser, getPrimaryOrganization, type CurrentUser } from "./auth.ts";
import { createNotesTables } from "./db.ts";

export type NotesNodeType = "folder" | "page";
export type NotesRole = "owner" | "editor" | "commenter" | "viewer";
export type NotesVisibility = "private" | "workspace" | "public";

type SpaceRow = {
    id: number;
    org_id: number;
    space_id: string;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    visibility: NotesVisibility;
    default_role: string;
    inheritance_mode: string;
    encryption_mode: string;
    created_by?: number;
    created_at?: string;
    updated_at?: string;
};

type NodeRow = {
    id: number;
    space_id: number;
    parent_id?: number | null;
    node_id: string;
    type: NotesNodeType;
    title: string;
    slug: string;
    path: string;
    sort_order: number;
    markdown: string;
    excerpt?: string;
    cover_image?: string;
    icon?: string;
    status: string;
    visibility_override?: NotesVisibility | null;
    is_encrypted?: boolean;
    created_at?: string;
    updated_at?: string;
};

type ShareRow = {
    id: number;
    share_id: string;
    label?: string;
    role: NotesRole;
    auth_required: boolean;
    allow_request_access: boolean;
    max_uses?: number | null;
    use_count: number;
    status: string;
    expires_at?: string | null;
    created_at?: string;
};

type LabelRow = {
    id: number;
    org_id: number;
    label_id: string;
    type: "tag" | "category";
    name: string;
    slug: string;
    color: string;
};

type CommentRow = {
    id: number;
    node_id: number;
    comment_id: string;
    anchor?: string;
    body_markdown: string;
    status: string;
    created_by?: number;
    created_at?: string;
    updated_at?: string;
};

export const escapeHtml = (value: unknown) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

export const notesPublicId = (prefix: string) =>
    `${prefix}_${crypto.randomBytes(14).toString("base64url")}`;

export const slugifyNote = (value: string, fallback = "untitled") => {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 160);

    return slug || `${fallback}-${Date.now().toString(36)}`;
};

const now = () => new Date().toISOString();

const firstRow = <T>(rows: unknown[] | undefined) =>
    (Array.isArray(rows) ? rows[0] as T | undefined : undefined);

const rowsOf = <T>(rows: unknown[] | undefined) =>
    (Array.isArray(rows) ? rows as T[] : []);

const roleRank: Record<string, number> = {
    none: 0,
    viewer: 1,
    commenter: 2,
    editor: 3,
    owner: 4
};

export const roleCan = (role: string, action: "view" | "comment" | "edit" | "manage") => {
    const rank = roleRank[role] ?? 0;
    if (action === "view") return rank >= 1;
    if (action === "comment") return rank >= 2;
    if (action === "edit") return rank >= 3;
    return rank >= 4;
};

export const getNotesContext = async (context: ZeruxRequestContext) => {
    await createNotesTables();
    const user = await getCurrentUser(context);
    const org = user
        ? { id: Number(user.org_id), name: "" }
        : await getPrimaryOrganization();

    return {
        user,
        orgId: Number(org?.id ?? 0)
    };
};

export const listSpaces = async (orgId: number, user: CurrentUser | null) => {
    if (!Number.isFinite(orgId) || orgId <= 0) return [];

    const result = await db.select({
        table: "notes_spaces",
        columns: ["id", "org_id", "space_id", "name", "slug", "description", "icon", "visibility", "default_role", "inheritance_mode", "encryption_mode", "created_by", "created_at", "updated_at"],
        where: {
            and: [
                { field: "org_id", operator: "eq", value: orgId },
                { field: "archived_at", operator: "isNull" }
            ]
        },
        orderBy: [{ by: "updated_at", direction: "desc" }]
    });

    const spaces = rowsOf<SpaceRow>(result.rows);
    if (!user) return spaces.filter((space) => space.visibility === "public");

    return spaces;
};

export const getSpaceByPublicId = async (spaceId: string) => {
    const result = await db.select({
        table: "notes_spaces",
        columns: ["id", "org_id", "space_id", "name", "slug", "description", "icon", "visibility", "default_role", "inheritance_mode", "encryption_mode", "created_by", "created_at", "updated_at"],
        where: { field: "space_id", operator: "eq", value: spaceId },
        limit: 1
    });

    return firstRow<SpaceRow>(result.rows) ?? null;
};

export const listNodes = async (spacePk: number) => {
    const result = await db.select({
        table: "notes_nodes",
        columns: ["id", "space_id", "parent_id", "node_id", "type", "title", "slug", "path", "sort_order", "markdown", "excerpt", "cover_image", "icon", "status", "visibility_override", "is_encrypted", "created_at", "updated_at"],
        where: {
            and: [
                { field: "space_id", operator: "eq", value: spacePk },
                { field: "status", operator: "eq", value: "active" },
                { field: "deleted_at", operator: "isNull" }
            ]
        },
        orderBy: [
            { by: "sort_order", direction: "asc" },
            { by: "title", direction: "asc" }
        ]
    });

    return rowsOf<NodeRow>(result.rows);
};

export const getNodeByPublicId = async (nodeId: string) => {
    const result = await db.select({
        table: "notes_nodes",
        columns: ["id", "space_id", "parent_id", "node_id", "type", "title", "slug", "path", "sort_order", "markdown", "excerpt", "cover_image", "icon", "status", "visibility_override", "is_encrypted", "created_at", "updated_at"],
        where: { field: "node_id", operator: "eq", value: nodeId },
        limit: 1
    });

    return firstRow<NodeRow>(result.rows) ?? null;
};

export const createSpace = async (orgId: number, user: CurrentUser | null, name: string) => {
    const title = name.trim().slice(0, 190) || "Personal notes";
    const spacePublicId = notesPublicId("sp");
    const result = await db.insert({
        table: "notes_spaces",
        values: {
            org_id: orgId,
            space_id: spacePublicId,
            name: title,
            slug: slugifyNote(title, "space"),
            description: "",
            icon: "book-open",
            visibility: "private",
            default_role: "none",
            inheritance_mode: "inherit_until_override",
            encryption_mode: "standard",
            created_by: user?.id,
            updated_by: user?.id
        },
        returning: ["id", "space_id"]
    });

    const spacePk = Number(result.insertedIds?.[0] ?? firstRow<{ id?: number }>(result.rows)?.id);

    if (user && Number.isFinite(spacePk)) {
        await db.insert({
            table: "notes_members",
            values: {
                space_id: spacePk,
                user_id: user.id,
                email: user.email,
                role: "owner",
                status: "active",
                invited_by: user.id
            }
        });
    }

    return await getSpaceByPublicId(spacePublicId) ?? result;
};

export const updateSpace = async (space: SpaceRow, user: CurrentUser | null, values: {
    name?: string;
    description?: string;
    visibility?: NotesVisibility;
    defaultRole?: NotesRole | "none";
}) => {
    const name = values.name?.trim().slice(0, 190);
    const visibility = values.visibility && ["private", "workspace", "public"].includes(values.visibility)
        ? values.visibility
        : space.visibility;

    await db.update({
        table: "notes_spaces",
        values: {
            ...(name ? { name, slug: slugifyNote(name, "space") } : {}),
            ...(values.description !== undefined ? { description: values.description.trim().slice(0, 2000) } : {}),
            visibility,
            ...(values.defaultRole ? { default_role: values.defaultRole } : {}),
            updated_by: user?.id,
            updated_at: now()
        },
        where: { field: "id", operator: "eq", value: space.id }
    });

    return getSpaceByPublicId(space.space_id);
};

export const createNode = async (input: {
    spacePk: number;
    parentId?: number | null;
    type: NotesNodeType;
    title: string;
    markdown?: string;
    user?: CurrentUser | null;
}) => {
    const title = input.title.trim().slice(0, 240) || (input.type === "folder" ? "New folder" : "Untitled");
    const slug = slugifyNote(title, input.type);
    const parent = input.parentId
        ? await getNodeByPk(input.parentId)
        : null;
    const path = `${parent?.path ? `${parent.path}/` : ""}${slug}`;
    const markdown = input.type === "page"
        ? input.markdown ?? `# ${title}\n\nStart writing in Markdown.`
        : "";
    const nodePublicId = notesPublicId(input.type === "folder" ? "fld" : "pg");

    await db.insert({
        table: "notes_nodes",
        values: {
            space_id: input.spacePk,
            parent_id: input.parentId ?? null,
            node_id: nodePublicId,
            type: input.type,
            title,
            slug,
            path,
            sort_order: Date.now(),
            markdown,
            excerpt: markdown.replace(/[#>*_`-]/g, "").replace(/\s+/g, " ").trim().slice(0, 240),
            status: "active",
            created_by: input.user?.id,
            updated_by: input.user?.id
        },
        returning: ["id", "node_id"]
    });

    return getNodeByPublicId(nodePublicId);
};

const getNodeByPk = async (id: number) => {
    const result = await db.select({
        table: "notes_nodes",
        columns: ["id", "space_id", "parent_id", "node_id", "type", "title", "slug", "path", "sort_order", "markdown", "excerpt", "cover_image", "icon", "status", "visibility_override", "is_encrypted", "created_at", "updated_at"],
        where: { field: "id", operator: "eq", value: id },
        limit: 1
    });

    return firstRow<NodeRow>(result.rows) ?? null;
};

export const updateNodeMarkdown = async (node: NodeRow, markdown: string, user: CurrentUser | null, title?: string) => {
    await db.insert({
        table: "notes_revisions",
        values: {
            node_id: node.id,
            revision_id: notesPublicId("rev"),
            markdown: node.markdown,
            summary: "Autosaved before update",
            created_by: user?.id
        }
    });

    const cleanTitle = title?.trim().slice(0, 240);
    return db.update({
        table: "notes_nodes",
        values: {
            ...(cleanTitle ? { title: cleanTitle, slug: slugifyNote(cleanTitle, node.type) } : {}),
            markdown,
            excerpt: markdown.replace(/[#>*_`-]/g, "").replace(/\s+/g, " ").trim().slice(0, 240),
            checksum: crypto.createHash("sha256").update(markdown).digest("hex"),
            updated_by: user?.id,
            updated_at: now()
        },
        where: { field: "id", operator: "eq", value: node.id }
    });
};

export const listLabels = async (orgId: number) => {
    const result = await db.select({
        table: "notes_labels",
        columns: ["id", "org_id", "label_id", "type", "name", "slug", "color"],
        where: { field: "org_id", operator: "eq", value: orgId },
        orderBy: [{ by: "name", direction: "asc" }]
    });

    return rowsOf<LabelRow>(result.rows);
};

export const createLabel = async (orgId: number, user: CurrentUser | null, input: {
    type: "tag" | "category";
    name: string;
    color?: string;
}) => {
    const name = input.name.trim().slice(0, 120);
    if (!name) throw new Error("Label name is required.");
    const labelPublicId = notesPublicId(input.type === "category" ? "cat" : "tag");
    await db.insert({
        table: "notes_labels",
        values: {
            org_id: orgId,
            label_id: labelPublicId,
            type: input.type,
            name,
            slug: slugifyNote(name, input.type),
            color: input.color?.trim().slice(0, 40) || "default",
            created_by: user?.id
        },
        returning: ["label_id"]
    });

    const labels = await listLabels(orgId);
    return labels.find((label) => label.label_id === labelPublicId) ?? null;
};

export const linkLabel = async (labelPk: number, targetType: "space" | "node", targetPk: number) =>
    db.insert({
        table: "notes_label_links",
        values: {
            label_id: labelPk,
            target_type: targetType,
            target_id: targetPk
        }
    });

export const searchNotes = async (spacePk: number, query: string) => {
    const normalized = query.trim();
    if (!normalized) return [];

    const result = await db.select({
        table: "notes_nodes",
        columns: ["id", "space_id", "parent_id", "node_id", "type", "title", "slug", "path", "sort_order", "markdown", "excerpt", "cover_image", "icon", "status", "visibility_override", "is_encrypted", "created_at", "updated_at"],
        where: {
            and: [
                { field: "space_id", operator: "eq", value: spacePk },
                { field: "status", operator: "eq", value: "active" },
                {
                    or: [
                        { field: "title", operator: "ilike", value: `%${normalized}%` },
                        { field: "markdown", operator: "ilike", value: `%${normalized}%` },
                        { field: "path", operator: "ilike", value: `%${normalized}%` }
                    ]
                }
            ]
        },
        limit: 50
    });

    return rowsOf<NodeRow>(result.rows);
};

export const syncSpaceSince = async (spacePk: number, since: string) => {
    const sinceValue = since || "1970-01-01T00:00:00.000Z";
    const result = await db.select({
        table: "notes_nodes",
        columns: ["id", "space_id", "parent_id", "node_id", "type", "title", "slug", "path", "sort_order", "markdown", "excerpt", "cover_image", "icon", "status", "visibility_override", "is_encrypted", "created_at", "updated_at"],
        where: {
            and: [
                { field: "space_id", operator: "eq", value: spacePk },
                { field: "updated_at", operator: "gt", value: sinceValue }
            ]
        },
        orderBy: [{ by: "updated_at", direction: "asc" }]
    });

    return {
        serverTime: now(),
        nodes: rowsOf<NodeRow>(result.rows)
    };
};

export const listShares = async (spacePk: number) => {
    const result = await db.select({
        table: "notes_shares",
        columns: ["id", "share_id", "label", "role", "auth_required", "allow_request_access", "max_uses", "use_count", "status", "expires_at", "created_at"],
        where: { field: "space_id", operator: "eq", value: spacePk },
        orderBy: [{ by: "created_at", direction: "desc" }]
    });

    return rowsOf<ShareRow>(result.rows);
};

export const createShare = async (spacePk: number, nodePk: number | null, user: CurrentUser | null, input: {
    label?: string;
    role?: NotesRole;
    authRequired?: boolean;
    maxUses?: number | null;
    expiresAt?: string | null;
}) => {
    const token = crypto.randomBytes(24).toString("base64url");
    const sharePublicId = notesPublicId("shr");

    await db.insert({
        table: "notes_shares",
        values: {
            space_id: spacePk,
            node_id: nodePk,
            share_id: sharePublicId,
            token_hash: crypto.createHash("sha256").update(token).digest("hex"),
            label: input.label?.trim().slice(0, 190) || "Share link",
            role: input.role ?? "viewer",
            auth_required: input.authRequired ?? false,
            allow_request_access: true,
            max_uses: input.maxUses ?? null,
            status: "active",
            created_by: user?.id,
            expires_at: input.expiresAt ?? null
        },
        returning: ["share_id"]
    });

    const shares = await listShares(spacePk);
    return shares.find((share) => share.share_id === sharePublicId) ?? null;
};

export const revokeShare = async (shareId: string, _user: CurrentUser | null) =>
    db.update({
        table: "notes_shares",
        values: {
            status: "revoked",
            revoked_at: now()
        },
        where: { field: "share_id", operator: "eq", value: shareId }
    });

export const createAccessRequest = async (input: {
    spacePk: number;
    nodePk?: number | null;
    user?: CurrentUser | null;
    email: string;
    requestedRole: NotesRole;
    message?: string;
}) =>
    db.insert({
        table: "notes_access_requests",
        values: {
            space_id: input.spacePk,
            node_id: input.nodePk ?? null,
            requester_user_id: input.user?.id ?? null,
            requester_email: input.email.trim().toLowerCase(),
            requested_role: input.requestedRole,
            message: input.message?.trim() ?? "",
            status: "pending"
        },
        returning: ["id"]
    });

export const addComment = async (nodePk: number, body: string, user: CurrentUser | null, anchor = "") => {
    const comment = await db.insert({
        table: "notes_comments",
        values: {
            node_id: nodePk,
            comment_id: notesPublicId("cmt"),
            anchor,
            body_markdown: body.trim(),
            status: "open",
            created_by: user?.id
        },
        returning: ["id"]
    });
    const commentPk = Number(comment.insertedIds?.[0] ?? firstRow<{ id?: number }>(comment.rows)?.id);
    const mentions = [...new Set(body.match(/@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])]
        .map((entry) => entry.slice(1).toLowerCase());

    if (Number.isFinite(commentPk) && mentions.length > 0) {
        await db.insert({
            table: "notes_comment_mentions",
            values: mentions.map((email) => ({
                comment_id: commentPk,
                mentioned_email: email,
                status: "pending"
            }))
        });
    }

    return comment;
};

export const listComments = async (nodePk: number) => {
    const result = await db.select({
        table: "notes_comments",
        columns: ["id", "node_id", "comment_id", "anchor", "body_markdown", "status", "created_by", "created_at", "updated_at"],
        where: {
            and: [
                { field: "node_id", operator: "eq", value: nodePk },
                { field: "status", operator: "ne", value: "deleted" }
            ]
        },
        orderBy: [{ by: "created_at", direction: "desc" }]
    });

    return rowsOf<CommentRow>(result.rows);
};

export const inviteToSpace = async (spacePk: number, email: string, role: NotesRole, user: CurrentUser | null) => {
    const normalizedEmail = email.trim().toLowerCase();
    const token = crypto.randomBytes(24).toString("base64url");
    const existingUser = await db.select({
        table: "users",
        columns: ["id"],
        where: { field: "email", operator: "eq", value: normalizedEmail },
        limit: 1
    });
    const invitedUser = firstRow<{ id?: number }>(existingUser.rows);

    await db.insert({
        table: "notes_members",
        values: {
            space_id: spacePk,
            user_id: invitedUser?.id ?? null,
            email: normalizedEmail,
            role,
            status: invitedUser?.id ? "active" : "invited",
            invited_by: user?.id
        }
    });

    return db.insert({
        table: "notes_invitations",
        values: {
            space_id: spacePk,
            email: normalizedEmail,
            token_hash: crypto.createHash("sha256").update(token).digest("hex"),
            role,
            status: "pending",
            invited_by: user?.id,
            expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        returning: ["id"]
    });
};

export const renderMarkdownPreview = (markdown: string) => {
    const lines = markdown.split(/\r?\n/);
    const html: string[] = [];
    let inList = false;
    let inCode = false;
    let inTable = false;
    let tableRows: string[] = [];

    const closeList = () => {
        if (inList) {
            html.push("</ul>");
            inList = false;
        }
    };
    const closeTable = () => {
        if (inTable) {
            html.push(`<table>${tableRows.join("")}</table>`);
            tableRows = [];
            inTable = false;
        }
    };
    const inline = (value: string) =>
        escapeHtml(value)
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/`([^`]+)`/g, "<code>$1</code>");

    for (const line of lines) {
        if (line.trim().startsWith("```")) {
            closeList();
            closeTable();
            html.push(inCode ? "</code></pre>" : "<pre><code>");
            inCode = !inCode;
            continue;
        }
        if (inCode) {
            html.push(`${escapeHtml(line)}\n`);
            continue;
        }
        if (/^\|.+\|$/.test(line.trim())) {
            closeList();
            inTable = true;
            if (/^\|\s*-+/.test(line.trim())) continue;
            const cells = line.trim().slice(1, -1).split("|").map((cell) => `<td>${inline(cell.trim())}</td>`).join("");
            tableRows.push(`<tr>${cells}</tr>`);
            continue;
        }

        closeTable();
        if (!line.trim()) {
            closeList();
            html.push("<p></p>");
        } else if (line.startsWith("### ")) {
            closeList();
            html.push(`<h3>${inline(line.slice(4))}</h3>`);
        } else if (line.startsWith("## ")) {
            closeList();
            html.push(`<h2>${inline(line.slice(3))}</h2>`);
        } else if (line.startsWith("# ")) {
            closeList();
            html.push(`<h1>${inline(line.slice(2))}</h1>`);
        } else if (/^[-*]\s+/.test(line)) {
            if (!inList) {
                html.push("<ul>");
                inList = true;
            }
            html.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
        } else if (line.startsWith("> ")) {
            closeList();
            html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
        } else {
            closeList();
            html.push(`<p>${inline(line)}</p>`);
        }
    }

    closeList();
    closeTable();
    if (inCode) html.push("</code></pre>");

    return html.join("");
};

export const notesSeedMarkdown = `# Product notes

This page is stored as Markdown and can contain **bold text**, links, images, tables, code, and tasks.

## Planning

- [ ] Draft project spec
- [ ] Invite collaborators
- [ ] Publish public documentation

## Kanban

| Backlog | Doing | Done |
| --- | --- | --- |
| Access requests | Editor polish | Markdown storage |
| E2E encryption design | Comments | Share controls |

> Use folders and sub-pages to shape the workspace hierarchy.`;
