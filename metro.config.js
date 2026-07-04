const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // react-native-maps is native-only and cannot bundle for web. Resolve it
    // to an empty module so the app still bundles; the /map route uses
    // map.web.tsx (a placeholder) at runtime. Native builds are unaffected.
    if (moduleName === 'react-native-maps') {
      return { type: 'empty' };
    }
    // zustand's ESM build (esm/*.mjs) uses `import.meta.env`, which Metro does
    // not statically replace — it throws in the classic-script web bundle and
    // breaks the persist middleware (hydration never completes, no seed data).
    // Point zustand at its CommonJS build on web, which uses process.env instead.
    if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
      const sub = moduleName === 'zustand' ? 'index' : moduleName.slice('zustand/'.length);
      return {
        type: 'sourceFile',
        filePath: path.join(__dirname, 'node_modules', 'zustand', `${sub}.js`),
      };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
