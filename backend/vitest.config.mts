import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // The Postgres tests share one database: run files one at a time when it is configured.
        fileParallelism: !process.env.TEST_DATABASE_URL,
    },
});
