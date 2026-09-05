import { defineConfig } from 'drizzle-kit';

const config = defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['FACTORY_DIR']
      ? `${process.env['FACTORY_DIR']}/wake.sqlite`
      : '../../.factory/wake.sqlite',
  },
});

export { config as default };
