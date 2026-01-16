const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Augmenter le nombre de workers et le timeout pour éviter le blocage
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    ...config.transformer?.minifierConfig,
  },
};

config.maxWorkers = 2;

module.exports = withNativeWind(config, { input: "./src/style/global.css" });
