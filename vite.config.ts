import { resolve } from 'path'
import type { ConfigEnv, UserConfig } from 'vite'
import { loadEnv } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import progress from 'vite-plugin-progress'
import EslintPlugin from 'vite-plugin-eslint'
import { ViteEjsPlugin } from 'vite-plugin-ejs'
import PurgeIcons from 'vite-plugin-purge-icons'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import { createStyleImportPlugin, ElementPlusResolve } from 'vite-plugin-style-import'
import { visualizer } from 'rollup-plugin-visualizer'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import pkg from './package.json'
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
// 0.59以下使用下面
// import UnoCSS from 'unocss/vite'
const sourcemap = !!process.env.VSCODE_DEBUG
const isBuild = process.argv.slice(2).includes('build')

// https://vitejs.dev/config/
const root = process.cwd()

function pathResolve(dir: string) {
    return resolve(root, '.', dir)
}

export default async ({command, mode}: ConfigEnv): Promise<UserConfig> => {
    // 0.59以上使用下面 https://github.com/MellowCo/unocss-preset-weapp/issues/155#issuecomment-2316763709
    const UnoCss = await import('unocss/vite').then(i => i.default)
    let env = {} as any
    const isBuild = command === 'build'
    if (!isBuild) {
        env = loadEnv((process.argv[3] === '--mode' ? process.argv[4] : process.argv[3]), root)
    } else {
        env = loadEnv(mode, root)
    }
    return {
        base: env.VITE_BASE_PATH,
        plugins: [
            Vue(),
            VueJsx(),
            progress(),
            Components({
                resolvers: [ElementPlusResolver()],
            }),
            env.VITE_USE_ALL_ELEMENT_PLUS_STYLE === 'false'
                ? createStyleImportPlugin({
                    resolves: [ElementPlusResolve()],
                    libs: [
                        {
                            libraryName: 'element-plus',
                            esModule: true,
                            resolveStyle: (name) => {
                                if (name === 'click-outside') {
                                    return ''
                                }
                                return `element-plus/es/components/${name.replace(/^el-/, '')}/style/css`
                            }
                        }
                    ]
                })
                : undefined,
            EslintPlugin({
                cache: false,
                failOnWarning: false,
                failOnError: false,
                include: ['src/**/*.vue', 'src/**/*.ts', 'src/**/*.tsx'] // 检查的文件
            }),
            VueI18nPlugin({
                runtimeOnly: true,
                compositionOnly: true,
                include: [resolve(__dirname, 'src/locales/**')]
            }),
            createSvgIconsPlugin({
                iconDirs: [pathResolve('src/assets/svgs')],
                symbolId: 'icon-[dir]-[name]',
                svgoOptions: true
            }),
            PurgeIcons(),
            ViteEjsPlugin({
                title: env.VITE_APP_TITLE
            }),
            UnoCss(),
            electron([
                {
                    // Main-Process entry file of the Electron App.
                    entry: 'electron/main/index.ts',
                    onstart(options) {
                        if (process.env.VSCODE_DEBUG) {
                            console.log(/* For `.vscode/.debug.script.mjs` */'[startup] Electron App')
                        } else {
                            options.startup(['.', '--no-sandbox'])
                        }
                    },
                    vite: {
                        build: {
                            sourcemap,
                            minify: isBuild,
                            outDir: 'dist-electron/main',
                            rollupOptions: {
                                external: Object.keys(pkg.dependencies),
                            },
                        },
                    },
                },
                {
                    entry: 'electron/preload/index.ts',
                    onstart(options) {
                        // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
                        // instead of restarting the entire Electron App.
                        options.reload()
                    },
                    vite: {
                        build: {
                            sourcemap,
                            minify: isBuild,
                            outDir: 'dist-electron/preload',
                            rollupOptions: {
                                external: Object.keys(pkg.dependencies),
                            },
                        },
                    },
                }
            ]),
            // Use Node.js API in the Renderer-process
            renderer({
                nodeIntegration: true,
                optimizeDeps: {
                    include: [
                        'fs/promises',
                        'process',
                    ],
                },
            }),
        ],

        css: {
            preprocessorOptions: {
                less: {
                    additionalData: '@import "./src/styles/variables.module.less";',
                    javascriptEnabled: true
                }
            }
        },
        resolve: {
            extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.less', '.css'],
            alias: [
                {
                    find: 'vue-i18n',
                    replacement: 'vue-i18n/dist/vue-i18n.cjs.js'
                },
                {
                    find: /\@\//,
                    replacement: `${pathResolve('src')}/`
                }
            ]
        },
        esbuild: {
            pure: env.VITE_DROP_CONSOLE === 'true' ? ['console.log'] : undefined,
            drop: env.VITE_DROP_DEBUGGER === 'true' ? ['debugger'] : undefined
        },
        build: {
            target: 'es2015',
            minify: 'terser',
            outDir: env.VITE_OUT_DIR || 'dist',
            sourcemap: env.VITE_SOURCEMAP === 'true',
            // brotliSize: false,
            rollupOptions: {
                plugins: env.VITE_USE_BUNDLE_ANALYZER === 'true' ? [visualizer()] : undefined,
                // 拆包
                output: {
                    manualChunks: {
                        'vue-chunks': ['vue', 'vue-router', 'pinia', 'vue-i18n'],
                        'element-plus': ['element-plus'],
                        'wang-editor': ['@wangeditor/editor', '@wangeditor/editor-for-vue'],
                        echarts: ['echarts', 'echarts-wordcloud']
                    }
                }
            },
            cssCodeSplit: !(env.VITE_USE_CSS_SPLIT === 'false'),
            cssTarget: ['chrome31']
        },
        server: {
            port: 4000,
            proxy: {
                // 选项写法
                '/api': {
                    target: 'http://127.0.0.1:8000',
                    changeOrigin: true,
                    rewrite: path => path.replace(/^\/api/, '')
                }
            },
            hmr: {
                overlay: false
            },
            host: '0.0.0.0',
            open: false
        },
        optimizeDeps: {
            include: [
                'vue',
                'vue-router',
                'vue-types',
                'element-plus/es/locale/lang/zh-cn',
                // 'element-plus/es/locale/lang/en',
                '@iconify/iconify',
                '@vueuse/core',
                'axios',
                'qs',
                // 'echarts',
                // 'echarts-wordcloud',
                'qrcode',
                // '@wangeditor/editor',
                // '@wangeditor/editor-for-vue',
                'vue-json-pretty',
                '@zxcvbn-ts/core',
                'dayjs',
                'cropperjs'
            ]
        }
    }
}
