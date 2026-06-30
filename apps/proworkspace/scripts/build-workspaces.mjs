import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const workspaceRoots = [
    path.join(root, "packages"),
    path.join(root, "packages", "@zeruxjs")
];

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const concurrency = Math.max(
    1,
    Number(process.env.WORKSPACE_BUILD_CONCURRENCY || Math.min(2, os.cpus().length)) || 1
);

const packageDirs = workspaceRoots
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => fs.readdirSync(dir)
        .map((entry) => path.join(dir, entry))
        .filter((entry) => fs.existsSync(path.join(entry, "package.json"))));

const packages = new Map();

for (const dir of packageDirs) {
    const pkg = readJson(path.join(dir, "package.json"));
    if (!pkg.name || !pkg.scripts?.build) continue;
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

const graph = new Map();
const reverseGraph = new Map();
const pendingDeps = new Map();

for (const [name, entry] of packages) {
    const deps = entry.deps.filter((dep) => packages.has(dep));
    graph.set(name, deps);
    pendingDeps.set(name, deps.length);
    deps.forEach((dep) => {
        if (!reverseGraph.has(dep)) reverseGraph.set(dep, []);
        reverseGraph.get(dep).push(name);
    });
}

const ready = [...pendingDeps.entries()]
    .filter(([, count]) => count === 0)
    .map(([name]) => name)
    .sort();
const running = new Set();
const completed = new Set();
let failed = false;

const runBuild = (name) => new Promise((resolve, reject) => {
    console.log(`\n> build workspace ${name}`);
    const child = spawn("npm", ["run", "build", "--workspace", name], {
        cwd: root,
        stdio: "inherit"
    });

    child.on("exit", (code) => {
        if (code === 0) {
            resolve();
            return;
        }

        reject(new Error(`${name} build failed with exit code ${code}`));
    });
});

const schedule = async () => new Promise((resolve, reject) => {
    const pump = () => {
        if (failed) return;

        while (running.size < concurrency && ready.length > 0) {
            const name = ready.shift();
            running.add(name);

            runBuild(name)
                .then(() => {
                    running.delete(name);
                    completed.add(name);

                    for (const dependent of reverseGraph.get(name) ?? []) {
                        const nextCount = (pendingDeps.get(dependent) ?? 0) - 1;
                        pendingDeps.set(dependent, nextCount);
                        if (nextCount === 0) {
                            ready.push(dependent);
                            ready.sort();
                        }
                    }

                    if (completed.size === packages.size) {
                        resolve();
                        return;
                    }

                    pump();
                })
                .catch((error) => {
                    failed = true;
                    reject(error);
                });
        }

        if (running.size === 0 && ready.length === 0 && completed.size !== packages.size) {
            reject(new Error("Workspace dependency graph could not be fully built."));
        }
    };

    console.log(`Building ${packages.size} workspaces with concurrency ${concurrency}.`);
    pump();
});

await schedule();
