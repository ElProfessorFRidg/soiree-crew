const path = require("node:path");
const fs = require("node:fs");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const packages = path.resolve(__dirname, "../../packages");

// Workspace packages resolve straight to their source entry. On Windows, pnpm recreates
// the junctions in node_modules on every install and a running Metro loses track of them.
const workspace = Object.fromEntries(
  fs
    .readdirSync(packages, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packages, entry.name, "package.json")))
    .map((entry) => [`@crew/${entry.name}`, path.join(packages, entry.name, "src", "index.ts")]),
);

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const entry = workspace[moduleName];
  if (entry) return { type: "sourceFile", filePath: entry };
  return defaultResolve ? defaultResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};
config.watchFolders = [...(config.watchFolders ?? []), packages, path.resolve(__dirname, "../../design")];

module.exports = config;
