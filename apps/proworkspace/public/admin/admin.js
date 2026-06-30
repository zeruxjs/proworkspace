(() => {
    const themeIcons = {
        system: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8"></path><path d="M12 16v4"></path></svg>',
        dark: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6.36 6.36 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>',
        light: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>'
    };
    const themeLabels = {
        system: "System",
        dark: "Dark",
        light: "Light"
    };
    const themeOrder = {
        system: "dark",
        dark: "light",
        light: "system"
    };
    const getThemeMode = () => {
        const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("theme="));
        const mode = match ? decodeURIComponent(match.slice(6)) : document.documentElement.classList.contains("dark") && !document.documentElement.classList.contains("system")
            ? "dark"
            : document.documentElement.classList.contains("light") && !document.documentElement.classList.contains("system")
                ? "light"
                : "system";
        return themeOrder[mode] ? mode : "system";
    };
    const getResolvedTheme = (mode) => mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : mode === "dark"
            ? "dark"
            : "light";
    const applyTheme = (mode) => {
        const resolved = getResolvedTheme(mode);
        document.documentElement.classList.remove("system", "dark", "light");
        document.documentElement.classList.add(mode);
        if (mode === "system") document.documentElement.classList.add(resolved);
        document.documentElement.style.colorScheme = resolved;
        document.cookie = `theme=${encodeURIComponent(mode)}; Path=/; Max-Age=31536000; SameSite=Lax`;

        document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
            button.dataset.themeMode = mode;
            button.setAttribute("aria-label", `Theme: ${themeLabels[mode]}`);
            button.setAttribute("title", `Theme: ${themeLabels[mode]}`);
            const icon = button.querySelector("[data-theme-icon]");
            if (icon) icon.innerHTML = themeIcons[mode];
        });
    };

    const sameOrigin = (href) => {
        try {
            return new URL(href, window.location.href).origin === window.location.origin;
        } catch {
            return false;
        }
    };

    const replaceView = async (href, options = {}) => {
        const response = await fetch(href, {
            headers: { "X-Soft-Load": "1" },
            credentials: "same-origin"
        });

        if (!response.ok) {
            window.location.href = href;
            return;
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const nextView = doc.getElementById("adminView");
        const view = document.getElementById("adminView");
        const nextTopbar = doc.querySelector(".topbar");
        const topbar = document.querySelector(".topbar");
        const nextNav = doc.querySelector(".sidebar nav");
        const nav = document.querySelector(".sidebar nav");

        if (!nextView || !view || !nextTopbar || !topbar || !nextNav || !nav) {
            window.location.href = href;
            return;
        }

        document.title = doc.title;
        topbar.replaceWith(nextTopbar);
        nav.replaceWith(nextNav);
        view.replaceWith(nextView);
        applyTheme(getThemeMode());

        if (options.pushState !== false) {
            window.history.pushState({}, "", href);
        }
    };

    document.addEventListener("click", (event) => {
        const menuButton = event.target instanceof Element ? event.target.closest("[data-menu-toggle]") : null;
        if (menuButton) {
            const open = !document.body.classList.contains("menu-open");
            document.body.classList.toggle("menu-open", open);
            menuButton.setAttribute("aria-expanded", String(open));
            return;
        }

        const themeButton = event.target instanceof Element ? event.target.closest("[data-theme-toggle]") : null;
        if (themeButton) {
            applyTheme(themeOrder[getThemeMode()]);
            return;
        }

        if (document.body.classList.contains("menu-open") && event.target === document.body) {
            document.body.classList.remove("menu-open");
            document.querySelector("[data-menu-toggle]")?.setAttribute("aria-expanded", "false");
            return;
        }

        const link = event.target instanceof Element ? event.target.closest("a[data-soft]") : null;
        if (!link || !sameOrigin(link.href) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        event.preventDefault();
        document.body.classList.remove("menu-open");
        document.querySelector("[data-menu-toggle]")?.setAttribute("aria-expanded", "false");
        replaceView(link.href).catch(() => {
            window.location.href = link.href;
        });
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (getThemeMode() === "system") applyTheme("system");
    });

    applyTheme(getThemeMode());

    window.addEventListener("popstate", () => {
        replaceView(window.location.href, { pushState: false }).catch(() => window.location.reload());
    });

    document.addEventListener("submit", async (event) => {
        const form = event.target instanceof HTMLFormElement ? event.target : null;
        if (!form || form.dataset.adminSiteForm !== "true") return;

        event.preventDefault();
        const row = form.closest("tr");
        const message = form.querySelector(".message") || row?.querySelector(".message");
        const button = event.submitter instanceof HTMLButtonElement
            ? event.submitter
            : form.querySelector("button[type='submit']") || document.querySelector(`button[form="${CSS.escape(form.id)}"]`);
        if (message) {
            message.textContent = "";
            message.className = "message";
        }
        if (button) button.disabled = true;

        try {
            const payload = Object.fromEntries(new FormData(form).entries());
            const response = await fetch(form.action, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.error) {
                throw new Error(result.message || "Unable to update site mapping.");
            }
            if (message) message.textContent = "Saved.";
            form.reset();
            await replaceView(window.location.href, { pushState: false });
            if (button) button.disabled = false;
        } catch (error) {
            if (message) {
                message.textContent = error instanceof Error ? error.message : "Unable to update site mapping.";
                message.className = "message error";
            }
            if (button) button.disabled = false;
        }
    });
})();
