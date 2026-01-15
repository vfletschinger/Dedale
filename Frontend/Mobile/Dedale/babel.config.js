module.exports = function (api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === "test";

  return {
    presets: [
      [
        "babel-preset-expo",
        { jsxImportSource: isTest ? undefined : "nativewind" },
      ],
      ...(isTest ? [] : ["nativewind/babel"]),
    ],
    plugins: [
      // react-native-reanimated/plugin DOIT être le dernier plugin
    ],
  };
};
