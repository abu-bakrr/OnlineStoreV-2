import { useConfig } from '@/hooks/useConfig'
import { useLayoutEffect } from 'react'

function hexToHSL(hex: string): string {
	hex = hex.replace(/^#/, '')

	const r = parseInt(hex.substring(0, 2), 16) / 255
	const g = parseInt(hex.substring(2, 4), 16) / 255
	const b = parseInt(hex.substring(4, 6), 16) / 255

	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	let h = 0,
		s = 0,
		l = (max + min) / 2

	if (max !== min) {
		const d = max - min
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

		switch (max) {
			case r:
				h = ((g - b) / d + (g < b ? 6 : 0)) / 6
				break
			case g:
				h = ((b - r) / d + 2) / 6
				break
			case b:
				h = ((r - g) / d + 4) / 6
				break
		}
	}

	h = Math.round(h * 360)
	s = Math.round(s * 100)
	l = Math.round(l * 100)

	return `${h} ${s}% ${l}%`
}

import { useTheme } from '@/components/ThemeProvider'

// ... (keep helper functions)

export default function ThemeApplier() {
	const { config } = useConfig()
	const { theme } = useTheme()

	useLayoutEffect(() => {
		if (!config?.colorScheme) return

		const root = document.documentElement
		const scheme = config.colorScheme
		const isDark =
			theme === 'dark' ||
			(theme === 'system' &&
				window.matchMedia('(prefers-color-scheme: dark)').matches)

		// Все изменения CSS переменных применяются синхронно в useLayoutEffect
		// Это гарантирует, что все элементы меняют цвет одновременно

		// Apply primary colors regardless of theme (brand identity)
		// But if colorSchemeDark is provided, we might want to use IT for primary in dark mode
		const activeScheme =
			isDark && config.colorSchemeDark ? config.colorSchemeDark : scheme

		root.style.setProperty('--primary', hexToHSL(activeScheme.primary))
		root.style.setProperty(
			'--primary-foreground',
			hexToHSL(activeScheme.primaryForeground),
		)
		root.style.setProperty('--accent', hexToHSL(activeScheme.accent))
		root.style.setProperty(
			'--accent-foreground',
			hexToHSL(activeScheme.accentForeground),
		)

		// If in dark mode and colorSchemeDark exists, apply its variables
		if (isDark && config.colorSchemeDark) {
			const darkScheme = config.colorSchemeDark
			root.style.setProperty('--background', hexToHSL(darkScheme.background))
			root.style.setProperty('--foreground', hexToHSL(darkScheme.foreground))
			root.style.setProperty('--card', hexToHSL(darkScheme.card))
			root.style.setProperty(
				'--card-foreground',
				hexToHSL(darkScheme.cardForeground),
			)
			root.style.setProperty('--secondary', hexToHSL(darkScheme.secondary))
			root.style.setProperty(
				'--secondary-foreground',
				hexToHSL(darkScheme.secondaryForeground),
			)
			root.style.setProperty('--muted', hexToHSL(darkScheme.muted))
			root.style.setProperty(
				'--muted-foreground',
				hexToHSL(darkScheme.mutedForeground),
			)
			root.style.setProperty('--border', hexToHSL(darkScheme.border))
			root.style.setProperty('--input', hexToHSL(darkScheme.input))
			root.style.setProperty('--ring', hexToHSL(darkScheme.ring))

			root.style.setProperty('--card-border', hexToHSL(darkScheme.border))
			root.style.setProperty('--sidebar', hexToHSL(darkScheme.card))
			root.style.setProperty(
				'--sidebar-foreground',
				hexToHSL(darkScheme.cardForeground),
			)
			root.style.setProperty('--sidebar-border', hexToHSL(darkScheme.border))
			root.style.setProperty('--sidebar-primary', hexToHSL(darkScheme.primary))
			root.style.setProperty(
				'--sidebar-primary-foreground',
				hexToHSL(darkScheme.primaryForeground),
			)
			root.style.setProperty('--sidebar-accent', hexToHSL(darkScheme.accent))
			root.style.setProperty(
				'--sidebar-accent-foreground',
				hexToHSL(darkScheme.accentForeground),
			)
			root.style.setProperty('--sidebar-ring', hexToHSL(darkScheme.ring))
		} else if (!isDark) {
			// Light mode (default scheme)
			root.style.setProperty('--background', hexToHSL(scheme.background))
			root.style.setProperty('--foreground', hexToHSL(scheme.foreground))
			root.style.setProperty('--card', hexToHSL(scheme.card))
			root.style.setProperty(
				'--card-foreground',
				hexToHSL(scheme.cardForeground),
			)
			root.style.setProperty('--secondary', hexToHSL(scheme.secondary))
			root.style.setProperty(
				'--secondary-foreground',
				hexToHSL(scheme.secondaryForeground),
			)
			root.style.setProperty('--muted', hexToHSL(scheme.muted))
			root.style.setProperty(
				'--muted-foreground',
				hexToHSL(scheme.mutedForeground),
			)
			root.style.setProperty('--border', hexToHSL(scheme.border))
			root.style.setProperty('--input', hexToHSL(scheme.input))
			root.style.setProperty('--ring', hexToHSL(scheme.ring))

			root.style.setProperty('--card-border', hexToHSL(scheme.border))
			root.style.setProperty('--sidebar', hexToHSL(scheme.card))
			root.style.setProperty(
				'--sidebar-foreground',
				hexToHSL(scheme.cardForeground),
			)
			root.style.setProperty('--sidebar-border', hexToHSL(scheme.border))
			root.style.setProperty('--sidebar-primary', hexToHSL(scheme.primary))
			root.style.setProperty(
				'--sidebar-primary-foreground',
				hexToHSL(scheme.primaryForeground),
			)
			root.style.setProperty('--sidebar-accent', hexToHSL(scheme.accent))
			root.style.setProperty(
				'--sidebar-accent-foreground',
				hexToHSL(scheme.accentForeground),
			)
			root.style.setProperty('--sidebar-ring', hexToHSL(scheme.ring))
		} else {
			// In dark mode without colorSchemeDark config, remove inline styles
			// so that index.css .dark rules take effect
			const propsToRemove = [
				'--background',
				'--foreground',
				'--card',
				'--card-foreground',
				'--popover',
				'--popover-foreground',
				'--secondary',
				'--secondary-foreground',
				'--muted',
				'--muted-foreground',
				'--accent',
				'--accent-foreground',
				'--destructive',
				'--destructive-foreground',
				'--border',
				'--input',
				'--ring',
				'--card-border',
				'--sidebar',
				'--sidebar-foreground',
				'--sidebar-border',
				'--sidebar-primary',
				'--sidebar-primary-foreground',
				'--sidebar-accent',
				'--sidebar-accent-foreground',
				'--sidebar-ring',
			]
			propsToRemove.forEach(prop => root.style.removeProperty(prop))
		}
	}, [config, theme])

	return null
}
