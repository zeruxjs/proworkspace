import type { ZeruxRequestContext } from "zeruxjs";
import {
    addComment,
    createAccessRequest,
    createLabel,
    createNode,
    createShare,
    createSpace,
    getNodeByPublicId,
    getNotesContext,
    getSpaceByPublicId,
    inviteToSpace,
    linkLabel,
    listComments,
    listLabels,
    listNodes,
    listShares,
    listSpaces,
    revokeShare,
    searchNotes,
    syncSpaceSince,
    updateSpace,
    updateNodeMarkdown,
    type NotesNodeType,
    type NotesRole
} from "../../../../lib/notes.ts";

type Body = Record<string, unknown>;

const asBody = (body: unknown): Body => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
        return body as Body;
    }

    if (typeof body === "string") {
        try {
            return JSON.parse(body) as Body;
        } catch {
            return Object.fromEntries(new URLSearchParams(body).entries());
        }
    }

    return {};
};

const text = (body: Body, key: string, max = 5000) =>
    (typeof body[key] === "string" ? body[key] : "").trim().slice(0, max);

const numberOrNull = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const nodeType = (value: string): NotesNodeType =>
    value === "folder" ? "folder" : "page";

const role = (value: string): NotesRole =>
    ["owner", "editor", "commenter", "viewer"].includes(value) ? value as NotesRole : "viewer";

const error = (message: string, status = 400) => ({
    ok: false,
    status,
    message
});

export const GET = async (context: ZeruxRequestContext) => {
    try {
        const { orgId, user } = await getNotesContext(context);
        if (!orgId) return error("Workspace setup is not complete.", 409);

        const action = context.query.get("action") ?? "snapshot";
        const spacePublicId = context.query.get("spaceId") ?? "";
        const space = spacePublicId ? await getSpaceByPublicId(spacePublicId) : null;

        if (action === "spaces") {
            return {
                ok: true,
                spaces: await listSpaces(orgId, user),
                labels: await listLabels(orgId)
            };
        }

        if (action === "search") {
            if (!space) return error("Space not found.", 404);
            return {
                ok: true,
                results: await searchNotes(space.id, context.query.get("q") ?? "")
            };
        }

        if (action === "sync") {
            if (!space) return error("Space not found.", 404);
            return {
                ok: true,
                ...(await syncSpaceSince(space.id, context.query.get("since") ?? ""))
            };
        }

        if (action === "comments") {
            const node = context.query.get("nodeId") ? await getNodeByPublicId(context.query.get("nodeId") ?? "") : null;
            if (!node) return error("Page not found.", 404);
            return {
                ok: true,
                comments: await listComments(node.id)
            };
        }

        if (!space) {
            return {
                ok: true,
                spaces: await listSpaces(orgId, user),
                labels: await listLabels(orgId)
            };
        }

        return {
            ok: true,
            space,
            nodes: await listNodes(space.id),
            shares: await listShares(space.id),
            labels: await listLabels(orgId),
            serverTime: new Date().toISOString()
        };
    } catch (caught) {
        return error(caught instanceof Error ? caught.message : "Unable to load notes.", 500);
    }
};

export const POST = async (context: ZeruxRequestContext) => {
    try {
        const body = asBody(context.body);
        const action = text(body, "action", 80);
        const { orgId, user } = await getNotesContext(context);

        if (!orgId) {
            return error("Workspace setup is not complete.", 409);
        }

        if (action === "create-space") {
            if (!user) return error("Sign in is required.", 401);
            const space = await createSpace(orgId, user, text(body, "name", 190));
            return { ok: true, space };
        }

        if (action === "update-space") {
            if (!user) return error("Sign in is required.", 401);
            const space = await getSpaceByPublicId(text(body, "spaceId", 100));
            if (!space) return error("Space not found.", 404);
            const updated = await updateSpace(space, user, {
                name: text(body, "name", 190),
                description: text(body, "description", 2000),
                visibility: text(body, "visibility", 40) as "private" | "workspace" | "public",
                defaultRole: role(text(body, "defaultRole", 40))
            });
            return { ok: true, space: updated };
        }

        if (action === "create-node") {
            if (!user) return error("Sign in is required.", 401);
            const space = await getSpaceByPublicId(text(body, "spaceId", 100));
            if (!space) return error("Space not found.", 404);
            const parentNodePublicId = text(body, "parentNodeId", 100);
            const parentNode = parentNodePublicId ? await getNodeByPublicId(parentNodePublicId) : null;
            const node = await createNode({
                spacePk: space.id,
                parentId: parentNode?.id ?? numberOrNull(body.parentId),
                type: nodeType(text(body, "type", 20)),
                title: text(body, "title", 240),
                markdown: text(body, "markdown", 200_000),
                user
            });
            return { ok: true, node };
        }

        if (action === "update-node") {
            if (!user) return error("Sign in is required.", 401);
            const node = await getNodeByPublicId(text(body, "nodeId", 100));
            if (!node) return error("Page not found.", 404);
            await updateNodeMarkdown(node, text(body, "markdown", 500_000), user, text(body, "title", 240));
            return { ok: true, serverTime: new Date().toISOString() };
        }

        if (action === "create-share") {
            if (!user) return error("Sign in is required.", 401);
            const space = await getSpaceByPublicId(text(body, "spaceId", 100));
            if (!space) return error("Space not found.", 404);
            const node = text(body, "nodeId", 100) ? await getNodeByPublicId(text(body, "nodeId", 100)) : null;
            const share = await createShare(space.id, node?.id ?? null, user, {
                label: text(body, "label", 190),
                role: role(text(body, "role", 40)),
                authRequired: body.authRequired === true || body.authRequired === "true",
                maxUses: numberOrNull(body.maxUses)
            });
            return { ok: true, share };
        }

        if (action === "revoke-share") {
            if (!user) return error("Sign in is required.", 401);
            const shareId = text(body, "shareId", 100);
            if (!shareId) return error("Share ID is required.");
            await revokeShare(shareId, user);
            return { ok: true };
        }

        if (action === "invite") {
            if (!user) return error("Sign in is required.", 401);
            const space = await getSpaceByPublicId(text(body, "spaceId", 100));
            if (!space) return error("Space not found.", 404);
            const email = text(body, "email", 190).toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Valid email is required.");
            await inviteToSpace(space.id, email, role(text(body, "role", 40)), user);
            return { ok: true };
        }

        if (action === "create-label") {
            if (!user) return error("Sign in is required.", 401);
            const labelType = text(body, "type", 40) === "category" ? "category" : "tag";
            const label = await createLabel(orgId, user, {
                type: labelType,
                name: text(body, "name", 120),
                color: text(body, "color", 40)
            });
            return { ok: true, label };
        }

        if (action === "link-label") {
            if (!user) return error("Sign in is required.", 401);
            const labelPk = numberOrNull(body.labelPk);
            const targetPk = numberOrNull(body.targetPk);
            const targetType = text(body, "targetType", 40) === "space" ? "space" : "node";
            if (!labelPk || !targetPk) return error("Label and target are required.");
            await linkLabel(labelPk, targetType, targetPk);
            return { ok: true };
        }

        if (action === "comment") {
            const node = await getNodeByPublicId(text(body, "nodeId", 100));
            if (!node) return error("Page is required before adding a comment.", 400);
            const comment = text(body, "body", 20_000);
            if (!comment) return error("Comment cannot be empty.");
            await addComment(node.id, comment, user, text(body, "anchor", 1000));
            return { ok: true };
        }

        if (action === "request-access") {
            const space = await getSpaceByPublicId(text(body, "spaceId", 100));
            if (!space) return error("Space not found.", 404);
            const node = text(body, "nodeId", 100) ? await getNodeByPublicId(text(body, "nodeId", 100)) : null;
            const email = user?.email ?? text(body, "email", 190).toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Valid email is required.");
            await createAccessRequest({
                spacePk: space.id,
                nodePk: node?.id ?? null,
                user,
                email,
                requestedRole: role(text(body, "role", 40) || "viewer"),
                message: text(body, "message", 1000)
            });
            return { ok: true };
        }

        return error("Unknown notes action.");
    } catch (caught) {
        return error(caught instanceof Error ? caught.message : "Unable to process notes request.", 500);
    }
};
