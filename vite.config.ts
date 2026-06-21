import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		react(),
		runtimeErrorOverlay(),
		...(process.env.NODE_ENV !== 'production' &&
		process.env.REPL_ID !== undefined
			? [
					await import('@replit/vite-plugin-cartographer').then(m =>
						m.cartographer()
					),
					await import('@replit/vite-plugin-dev-banner').then(m =>
						m.devBanner()
					),
			  ]
			: []),
	],
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, 'client', 'src'),
			'@shared': path.resolve(import.meta.dirname, 'shared'),
			'@assets': path.resolve(import.meta.dirname, 'attached_assets'),
		},
	},
	root: path.resolve(import.meta.dirname, 'client'),
	build: {
		outDir: path.resolve(import.meta.dirname, 'dist/public'),
		emptyOutDir: true,
		rollupOptions: {
			output: {
				manualChunks: {
					// Выделяем vendor библиотеки в отдельный чанк
					'react-vendor': ['react', 'react-dom'],
					'router-vendor': ['wouter'],
					'query-vendor': ['@tanstack/react-query'],
					// Админка будет загружаться отдельно благодаря lazy loading
				},
			},
		},
		// Увеличиваем лимит предупреждений о размере чанка
		chunkSizeWarningLimit: 1000,
	},
	server: {
		host: '0.0.0.0',
		fs: {
			strict: true,
			deny: ['**/.*'],
		},
		proxy: {
			'/api': {
				target: 'http://localhost:5001',
				changeOrigin: true,
				secure: false,
			}
		}
	},
})
