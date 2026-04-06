import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrate: {
    async adapter() {
      const { default: pg } = await import('pg');
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
      });
      return new PrismaPg(pool as any);
    },
  },
});
