import { useTheme } from '@/components/ThemeProvider'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useConfig } from '@/hooks/useConfig'
import { Heart, MessageCircle, ShoppingCart } from 'lucide-react'
import ProfileDropdown from './ProfileDropdown'

interface HeaderProps {
	onFavoritesClick?: () => void
	onCartClick?: () => void
	onAccountClick?: () => void
	favoritesCount?: number
	cartCount?: number
}

export default function Header({
	onFavoritesClick,
	onCartClick,
	onAccountClick,
	favoritesCount = 0,
	cartCount = 0,
}: HeaderProps) {
	const { config } = useConfig()
	const { user } = useAuth()
	const { theme } = useTheme()

	const isDark =
		theme === 'dark' ||
		(theme === 'system' &&
			window.matchMedia('(prefers-color-scheme: dark)').matches)

	const logoSize = config?.logoSize || 32
	const logoSrc = isDark && config?.darkLogo ? config.darkLogo : config?.logo

	return (
		<header
			className='sticky top-0 z-50 bg-background border-b border-border px-4 md:px-6 py-3 md:py-4'
			data-testid='header-main'
		>
			<div className='max-w-7xl mx-auto flex items-center justify-between'>
				<div className='flex items-center gap-2'>
					{logoSrc && (
						<img
							src={logoSrc}
							alt='Logo'
							style={{ width: `${logoSize}px`, height: 'auto' }}
							className='object-contain transition-opacity duration-200'
						/>
					)}
					{config?.shopName && (
						<h1
							className='text-lg font-semibold text-foreground transition-opacity duration-200'
							data-testid='text-brand-name'
						>
							{config.shopName}
						</h1>
					)}
				</div>

				<div className='flex items-center gap-2'>
					{user ?
						<ProfileDropdown />
					:	<Button
							variant='outline'
							size='sm'
							onClick={onAccountClick}
							className='px-4 font-medium'
							data-testid='button-account'
						>
							Войти
						</Button>
					}

					{config?.telegramBotUrl && (
						<Button
							size='icon'
							variant='ghost'
							onClick={() => window.open(config.telegramBotUrl, '_blank')}
							className='relative'
							data-testid='button-telegram-bot'
							title='Открыть Telegram бота'
						>
							<MessageCircle className='w-5 h-5' />
						</Button>
					)}

					<Button
						size='icon'
						variant='ghost'
						onClick={onFavoritesClick}
						className='relative'
						data-testid='button-favorites'
					>
						<Heart className='w-5 h-5' />
						{favoritesCount > 0 && (
							<span
								className='absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center'
								data-testid='text-favorites-count'
							>
								{favoritesCount}
							</span>
						)}
					</Button>

					<Button
						size='icon'
						variant='ghost'
						onClick={onCartClick}
						className='relative'
						data-testid='button-cart'
					>
						<ShoppingCart className='w-5 h-5' />
						{cartCount > 0 && (
							<span
								className='absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center'
								data-testid='text-cart-count'
							>
								{cartCount}
							</span>
						)}
					</Button>
				</div>
			</div>
		</header>
	)
}
