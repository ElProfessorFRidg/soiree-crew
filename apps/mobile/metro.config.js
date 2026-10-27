const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const packages = path.resolve(__dirname, "../../packages");

// Workspace packages resolve to their source folders directly. On Windows, pnpm
// recreates the junctions on every install and a running Metro loses track of them.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@crew/bac": path.join(packages, "bac"),
  "@crew/units": path.join(packages, "units"),
  "@crew/design-tokens": path.join(packages, "design-tokens"),
  "@crew/games": path.join(packages, "games"),
};

module.exports = config;
