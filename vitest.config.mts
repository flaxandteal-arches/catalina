import fs from 'fs';
import path from 'path';
import vue from "@vitejs/plugin-vue";

import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

import type { ViteUserConfig } from 'vitest/config';

// Webpack turns a `templates/*.htm` import into its relative path string (see
// the .htm rule in webpack/webpack.common.js). Do the same here, so that specs
// can import the Knockout-era modules that use them.
const htmTemplatePaths = {
    name: 'htm-template-paths',
    enforce: 'pre' as const,
    resolveId(id: string) {
        return id.startsWith('templates/') && id.endsWith('.htm') ? `\0${id}` : null;
    },
    load(id: string) {
        return id.startsWith('\0templates/') ? `export default ${JSON.stringify(id.slice(1))};` : null;
    },
};

function generateConfig(): Promise<ViteUserConfig> {
    return new Promise((resolve, reject) => {
        const filePath = path.dirname(fileURLToPath(import.meta.url));

        const exclude = [
            '**/*.d.ts',
            '**/node_modules/**',
            '**/dist/**',
            '**/install/**',
            '**/cypress/**',
            '**/.{idea,git,cache,output,temp}/**',
            '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
            '**/build/**',
            '**/staticfiles/**',
        ];

        const rawData = fs.readFileSync(path.join(__dirname, 'frontend_configuration', 'webpack-metadata.json'), 'utf-8');
        const parsedData = JSON.parse(rawData);

        const alias: { [key: string]: string } = {
            '@/arches': path.join(parsedData['ROOT_DIR'], 'app', 'src', 'arches'),
            'arches': path.join(parsedData['ROOT_DIR'], 'app', 'media', 'js', 'arches.js'),
        };

        for (
            const [archesApplicationName, archesApplicationPath] 
            of Object.entries(
                parsedData['ARCHES_APPLICATIONS_PATHS'] as { [key: string]: string }
            )
        ) {
            alias[`@/${archesApplicationName}`] = path.join(archesApplicationPath, 'src', archesApplicationName);
        }

        resolve({
            plugins: [vue() as any, htmTemplatePaths],
            test: {
                alias: alias,
                coverage: {
                    include: [path.join(parsedData['APP_RELATIVE_PATH'], 'src', path.sep)],
                    exclude: exclude,
                    reporter: [
                        ['clover', { 'file': 'coverage.xml' }],
                        'text',
                    ],
                    reportsDirectory: path.join(filePath, 'coverage', 'frontend'),
                },
                environment: "jsdom",
                globals: true,
                exclude: exclude,
                passWithNoTests: true,
                setupFiles: ['vitest.setup.mts'],
            },
        });

    });
};

export default (async () => {
    const config = await generateConfig();
    return defineConfig(config);
})();
