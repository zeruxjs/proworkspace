import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspaceRoots = [
    path.join(root, "packages"),
    path.join(root, "packages", "@zeruxjs")
];

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const packageDirs = workspaceRoots
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => fs.readdirSync(dir)
        .map((entry) => path.join(dir, entry))
        .filter((entry) => fs.existsSync(path.join(entry, "package.json"))));

const packages = new Map();

for (const dir of packageDirs) {
    const pkg = readJson(path.join(dir, "package.json"));
    if (!pkg.name) continue;
    packages.set(pkg.name, {
        dir,
        pkg,
        deps: Object.keys({
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {}),
            ...(pkg.peerDependencies ?? {})
        })
    });
}

const ordered = [];
const visiting = new Set();
const visited = new Set();

const visit = (name) => {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
        throw new Error(`Workspace dependency cycle at ${name}`);
    }

    const entry = packages.get(name);
    if (!entry) return;

    visiting.add(name);
    entry.deps
        .filter((dep) => packages.has(dep))
        .forEach(visit);
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
};

[...packages.keys()].forEach(visit);

for (const name of ordered) {
    const entry = packages.get(name);
    if (!entry?.pkg.scripts?.build) continue;

    console.log(`\n> build workspace ${name}`);
    const result = spawnSync("npm", ["run", "build", "--workspace", name], {
        cwd: root,
        stdio: "inherit"
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
