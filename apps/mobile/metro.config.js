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

// ts-mls loads optional algorithms with import() inside try/catch, and @hpke reaches for Node's
// crypto only where WebCrypto is missing. None of them is used here (ADR 0005): they resolve to
// an empty module, so the bundle builds and the library reports them as unavailable.
const emptyModule = path.join(__dirname, "metro.empty.js");
const optional = new Set(["crypto", "@hpke/chacha20poly1305", "@hpke/dhkem-x448", "@hpke/hybridkem-x-wing", "@hpke/ml-kem", "@noble/post-quantum/ml-dsa.js"]);

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const entry = workspace[moduleName];
  if (entry) return { type: "sourceFile", filePath: entry };
  if (optional.has(moduleName)) return { type: "sourceFile", filePath: emptyModule };
  return defaultResolve ? defaultResolve(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};
// The server's own node_modules are nothing the app bundles, and pnpm's links there trip Metro's crawler on Windows.
const existing = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), /[\\/]apps[\\/]server[\\/].*/];
config.watchFolders = [...(config.watchFolders ?? []), packages, path.resolve(__dirname, "../../design")];

module.exports = config;
