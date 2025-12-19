// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    settings: {
      "import/ignore": ["react-native", "@expo/vector-icons"],
    },
    rules: {
      "import/namespace": "off",
      "import/no-unresolved": ["error", { ignore: ["@expo/vector-icons"] }],
    },
  },
]);
