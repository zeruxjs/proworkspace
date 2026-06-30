import type { ZeruxRequestContext } from "zeruxjs";
import { RedirectType, redirect } from "zeruxjs/navigation";
import { escapeHtml } from "../../../lib/admin.ts";
import {
    createActiveUser,
    createSignupAttempt,
    deleteSignupAttempt,
    getOrgOption,
    getPrimaryOrganization,
    isEmail,
    isOldEnough,
    normalizeEmail,
    renderAuthShell,
    signInWithPassword
} from "../../../lib/auth.ts";

const asBodyObject = (body: unknown): Record<string, unknown> => {
    if (body && typeof body === "object" && !Array.isArray(body)) {
        return body as Record<string, unknown>;
    }

    if (typeof body === "string") {
        return Object.fromEntries(new URLSearchParams(body).entries());
    }

    return {};
};

const text = (body: Record<string, unknown>, key: string, max = 190) =>
    (typeof body[key] === "string" ? body[key] : "").replace(/\s+/g, " ").trim().slice(0, max);

const username = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "").slice(0, 64);

const emailDomain = (value: string) => value.split("@")[1]?.toLowerCase() ?? "";

const allowedRegistration = async (orgId: number, orgPolicy: string) =>
    getOrgOption(orgId, "signup_registration_mode", orgPolicy === "anyone" ? "anyone" : orgPolicy);

const signupForm = async (message = "") => {
    const org = await getPrimaryOrganization();
    const fixedDomain = org?.domain ?? "example.com";

    return renderAuthShell("Create account", `<section class="panel auth-panel">
        <p>ProWorkspace Accounts</p>
        <h1>Create account</h1>
        <form method="post" class="form-grid" style="margin-top:16px">
            <label class="field">
                <span>First name</span>
                <input name="firstName" autocomplete="given-name" required>
            </label>
            <label class="field">
                <span>Last name</span>
                <input name="lastName" autocomplete="family-name" required>
            </label>
            <label class="field">
                <span>Date of birth</span>
                <input name="dob" type="date" autocomplete="bday" required>
            </label>
            <label class="field">
                <span>Gender</span>
                <select name="gender" required>
                    <option value="">Choose</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="non_binary">Non-binary</option>
                    <option value="not_shared">Prefer not to say</option>
                </select>
            </label>
            <label class="field">
                <span>Email option</span>
                <select name="emailMode">
                    <option value="own">Use my email</option>
                    <option value="fixed">Create ${escapeHtml(fixedDomain)} address</option>
                </select>
            </label>
            <label class="field">
                <span>Email</span>
                <input name="email" type="email" autocomplete="email">
            </label>
            <label class="field">
                <span>${escapeHtml(fixedDomain)} username</span>
                <input name="fixedUsername" autocomplete="username">
            </label>
            <label class="field">
                <span>Password</span>
                <input name="password" type="password" autocomplete="new-password" minlength="10" required>
            </label>
            <label class="field">
                <span>Confirm password</span>
                <input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required>
            </label>
            <label class="field" style="grid-column:1 / -1">
                <span><input name="acceptsPolicies" type="checkbox" value="yes" required style="width:auto;min-height:auto"> I accept the terms, privacy policy, and data handling notice.</span>
            </label>
            <button class="primary" type="submit">Create account</button>
        </form>
        ${message ? `<p class="message error">${escapeHtml(message)}</p>` : ""}
        <p style="margin-top:16px"><a href="/signin">Sign in instead</a></p>
    </section>`);
};

export const GET = () => signupForm();

export const POST = async (context: ZeruxRequestContext) => {
    try {
        const org = await getPrimaryOrganization();
        if (!org) {
            return signupForm("Workspace setup is not complete.");
        }

        const mode = await allowedRegistration(Number(org.id), org.email_policy);
        if (mode === "admin_only" || mode === "disabled") {
            return signupForm("Self-service registration is not available for this workspace.");
        }

        const body = asBodyObject(context.body);
        const firstName = text(body, "firstName", 120);
        const lastName = text(body, "lastName", 120);
        const dob = text(body, "dob", 20);
        const gender = text(body, "gender", 40);
        const password = text(body, "password", 500);
        const confirmPassword = text(body, "confirmPassword", 500);
        const minAge = Number(await getOrgOption(Number(org.id), "signup_min_age", "13"));
        const selectedUsers = (await getOrgOption(Number(org.id), "selected_email_users", ""))
            .split(",")
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean);
        const fixedDomain = await getOrgOption(Number(org.id), "signup_fixed_email_domain", org.domain);
        const emailMode = text(body, "emailMode") === "fixed" ? "fixed" : "own";
        const email = emailMode === "fixed"
            ? normalizeEmail(`${username(text(body, "fixedUsername"))}@${fixedDomain}`)
            : normalizeEmail(text(body, "email"));

        if (!firstName || !lastName) throw new Error("First name and last name are required.");
        if (!isOldEnough(dob, Number.isFinite(minAge) ? minAge : 13)) throw new Error(`You must be at least ${Number.isFinite(minAge) ? minAge : 13} years old to register.`);
        if (!["female", "male", "non_binary", "not_shared"].includes(gender)) throw new Error("Choose a valid gender option.");
        if (!isEmail(email)) throw new Error("Enter a valid email address.");
        if (password.length < 10) throw new Error("Password must be at least 10 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        if (text(body, "acceptsPolicies") !== "yes") throw new Error("Accept the terms, privacy policy, and data handling notice.");
        if ((mode === "only_domain" || mode === "allowed_domain") && emailDomain(email) !== org.domain) {
            throw new Error(`Use an email address from ${org.domain}.`);
        }
        if (mode === "selected_email_users" && !selectedUsers.includes(email)) {
            throw new Error("This email is not on the workspace registration list.");
        }

        await createSignupAttempt(Number(org.id), email, {
            firstName,
            lastName,
            dob,
            gender,
            acceptedPoliciesAt: new Date().toISOString()
        });
        await createActiveUser({
            orgId: Number(org.id),
            firstName,
            lastName,
            email,
            password,
            dob,
            gender
        });
        await deleteSignupAttempt(Number(org.id), email);
        await signInWithPassword(context, email, password);

        return redirect("/", RedirectType.SeeOther);
    } catch (caught) {
        return signupForm(caught instanceof Error ? caught.message : "Unable to create account.");
    }
};
