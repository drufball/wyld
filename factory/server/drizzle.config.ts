import { defineConfig } from 'drizzle-kit';

const config = defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['FACTORY_DIR']
      ? `${process.env['FACTORY_DIR']}/pak.sqlite`
      : '../../.factory/pak.sqlite',
  },
});

export { config as default };
