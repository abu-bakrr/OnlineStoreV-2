import { useQuery } from '@tanstack/react-query'

export interface AppConfig {
	shopName: string
	description: string
	logo: string
	darkLogo?: string
	seo?: {
		title?: string
		description?: string
		keywords?: string
		siteUrl?: string
		language?: string
	}
	currency: {
		symbol: string
		code: string
		position: 'before' | 'after'
	}
	managerContact: string
	telegramBotUrl?: string
	categories: Array<{
		id: string
		name: string
		icon?: string
	}>
	colorScheme: {
		background: string
		foreground: string
		card: string
		cardForeground: string
		primary: string
		primaryForeground: string
		secondary: string
		secondaryForeground: string
		muted: string
		mutedForeground: string
		accent: string
		accentForeground: string
		border: string
		input: string
		ring: string
	}
	colorSchemeDark?: {
		background: string
		foreground: string
		card: string
		cardForeground: string
		primary: string
		primaryForeground: string
		secondary: string
		secondaryForeground: string
		muted: string
		mutedForeground: string
		accent: string
		accentForeground: string
		border: string
		input: string
		ring: string
	}
	sortOptions: Array<{
		id: string
		label: string
		emoji?: string
	}>
	ui: {
		maxWidth: string
		productsPerPage: number
		showCategoryIcons: boolean
		showPriceFilter: boolean
		showShopName?: boolean
	}
	texts: {
		addToCart: string
		addedToCart: string
		checkout: string
		total: string
		emptyCart: string
		emptyFavorites: string
		loading: string
	}
	fonts?: {
		fontFamily: string
		fontFile: string | null
		shopNameFontFamily?: string | null
		shopNameFontFile?: string | null
		productName: {
			weight: number
		}
		price: {
			weight: number
		}
		description: {
			weight: number
		}
	}
	logoSize?: number
	logoSizeLarge?: number
	orderStatuses?: {
		[key: string]: string
	}
}

export function useConfig() {
	const {
		data: config,
		isLoading,
		error,
	} = useQuery<AppConfig>({
		queryKey: ['/api/config'],
		staleTime: 1000 * 60 * 5, // 5 minutes instead of Infinity
		refetchOnWindowFocus: true,
		// Use cached config from localStorage as initial data
		initialData: () => {
			try {
				const cached = localStorage.getItem('app-config')
				return cached ? JSON.parse(cached) : undefined
			} catch {
				return undefined
			}
		},
	})

	// Cache config to localStorage whenever it updates
	if (config && !isLoading) {
		try {
			localStorage.setItem('app-config', JSON.stringify(config))
		} catch (e) {
			console.warn('Failed to cache config:', e)
		}
	}

	const formatPrice = (price: number) => {
		if (!config) return `${price}`

		const formatted = price.toLocaleString()
		return config.currency.position === 'before' ?
				`${config.currency.symbol}${formatted}`
			:	`${formatted} ${config.currency.symbol}`
	}

	return {
		config,
		isLoading,
		error,
		formatPrice,
	}
}
