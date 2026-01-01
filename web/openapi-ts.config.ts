import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../api/_bundle.yaml',
  output: 'src/client',
  plugins: [
    '@hey-api/client-fetch',
    '@tanstack/react-query',
    'zod',
  ]
});
