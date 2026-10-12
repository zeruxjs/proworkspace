import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { discoverWorkspaces, planWorkspaces, executeWorkspacePlan } from './workspace-graph.mjs';

export function parseBuildOptions(args) {
  const options = { scopes: [], dryRun: false, verify: false, includeDependents: false, concurrency: 2, json: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--scope') { if (!args[i + 1]) throw new Error('Missing --scope value'); options.scopes.push(args[++i]); }
    else if (arg === '--concurrency') {
      if (!/^[0-9]+$/.test(args[i + 1] ?? '')) throw new Error('Invalid --concurrency value');
      options.concurrency = Number(args[++i]);
    } else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--verify') options.verify = true;
    else if (arg === '--with-dependents') options.includeDependents = true;
    else if (arg === '--json') options.json = true;
    else throw new Error(`Unknown build option: ${arg}`);
  }
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 32) throw new Error('Concurrency must be 1-32');
  return options;
}

/** Confirm the declared local package entrypoints actually exist after a build. */
function artifactTargets(pkg) {
  const files = new Set();
  for (const value of [pkg.main, pkg.types]) if (typeof value === 'string') files.add(value);
  const walk = value => {
    if (typeof value === 'string') { if (value.startsWith('./')) files.add(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(pkg.exports);
  walk(pkg.bin);
  return [...files].sort();
}

export function verifyWorkspaceArtifacts(entries, ordered) {
  const missing = [];
  for (const name of ordered) {
    const { dir, pkg } = entries.get(name);
    for (const target of artifactTargets(pkg)) {
      const dest = path.resolve(dir, target);
      if (!dest.startsWith(dir + path.sep) || !fs.existsSync(dest) || !fs.statSync(dest).isFile()) missing.push(`${name}: ${target}`);
    }
  }
  return missing;
}

export async function runWorkspaceBuild(root, options, { run, onEvent } = {}) {
  const entries = discoverWorkspaces(root);
  const plan = planWorkspaces(entries, options);
  if (options.dryRun) return { planned: plan.ordered, completed: [], missing: [] };
  const execute = run ?? ((name, signal) => new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--workspace', name], {
      cwd: root, stdio: 'inherit', signal, shell: false
    });
    child.once('error', reject);
    child.once('exit', (code, exitSignal) => code === 0 ? resolve() : reject(new Error(`Exited ${code ?? exitSignal}`)));
  }));
  const results = await executeWorkspacePlan(plan, { concurrency: options.concurrency, run: execute, onEvent });
  const missing = options.verify ? verifyWorkspaceArtifacts(entries, plan.ordered) : [];
  if (missing.length) throw new Error('Missing built entrypoints:\n' + missing.join('\n'));
  return { planned: plan.ordered, completed: results.map(result => result.name), missing };
}
