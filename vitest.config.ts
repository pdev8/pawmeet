import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Unit tests cover the pure logic in src/lib (geometry, review math, store
// business rules). They run in plain Node — never touching Metro/Expo — so the
// SDK-54 pin is unaffected. The only native import in that graph is
// AsyncStorage, aliased below to an in-memory mock.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'test/mocks/async-storage.ts',
      ),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
