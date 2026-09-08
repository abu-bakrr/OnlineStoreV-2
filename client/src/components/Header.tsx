import { useTheme } from '@/components/ThemeProvider'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useConfig } from '@/hooks/useConfig'
import { Heart, Moon, ShoppingCart, Sun } from 'lucide-react'
import { useCallback, useRef } from 'react'
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
	const { theme, setTheme } = useTheme()

	const isDark =
		theme === 'dark' ||
		(theme === 'system' &&
			window.matchMedia('(prefers-color-scheme: dark)').matches)

	const showShopName = config?.ui?.showShopName !== false
	const logoSize =
		showShopName ? config?.logoSize || 32 : config?.logoSizeLarge || 44
	const logoSrc = isDark && config?.darkLogo ? config.darkLogo : config?.logo

	// Easter Egg: triple click on logo
	const clickCountRef = useRef(0)
	const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const playGlitchSound = () => {
		try {
			const AudioContext = window.AudioContext || (window as any).webkitAudioContext
			const ctx = new AudioContext()
			
			// Master gain to fade out
			const master = ctx.createGain()
			master.gain.setValueAtTime(0.2, ctx.currentTime)
			master.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1)
			master.connect(ctx.destination)

			// 1. Digital Data Stream (fast jumping square wave)
			const osc1 = ctx.createOscillator()
			osc1.type = 'square'
			// Jump frequencies every 50ms to sound like broken data
			for (let i = 0; i < 20; i++) {
				const time = ctx.currentTime + (i * 0.05)
				// Alternate between very low growls and high shrieks
				const freq = Math.random() > 0.5 ? 40 + Math.random() * 100 : 1000 + Math.random() * 3000
				osc1.frequency.setValueAtTime(freq, time)
			}
			osc1.connect(master)
			osc1.start(ctx.currentTime)
			osc1.stop(ctx.currentTime + 1)

			// 2. Sub-bass drop (impact)
			const osc2 = ctx.createOscillator()
			osc2.type = 'sawtooth'
			osc2.frequency.setValueAtTime(60, ctx.currentTime)
			osc2.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.5)
			
			// Distortion for the bass
			const shaper = ctx.createWaveShaper()
			const curve = new Float32Array(400)
			for(let i = 0; i < 400; i++) {
				const x = i * 2 / 400 - 1
				curve[i] = (50 * x) / (Math.PI + 50 * Math.abs(x))
			}
			shaper.curve = curve
			
			const gain2 = ctx.createGain()
			gain2.gain.value = 0.5
			
			osc2.connect(shaper)
			shaper.connect(gain2)
			gain2.connect(master)
			
			osc2.start(ctx.currentTime)
			osc2.stop(ctx.currentTime + 1)

		} catch (e) {
			// ignore audio errors if not supported
		}
	}

	const handleLogoClick = useCallback(() => {
		clickCountRef.current += 1
		if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
		clickTimerRef.current = setTimeout(() => {
			clickCountRef.current = 0
		}, 600)

		if (clickCountRef.current >= 3) {
			clickCountRef.current = 0
			const root = document.documentElement
			const isActive = root.classList.contains('easter-egg-active')
			if (isActive) {
				root.classList.remove('easter-egg-active')
			} else {
				root.classList.add('easter-egg-active')
				playGlitchSound()
				// Auto-deactivate after 1s
				setTimeout(() => root.classList.remove('easter-egg-active'), 1000)
			}
		}
	}, [])

	return (
		<header
			className='sticky top-0 z-50 bg-background/70 backdrop-blur-xl border-b border-border/40 px-4 md:px-8 py-3 md:py-5 transition-all duration-300'
			data-testid='header-main'
		>
			<div className='max-w-[1600px] mx-auto flex items-center justify-between'>
				<div className='flex items-center gap-3'>
					{logoSrc && (
						<img
							src={logoSrc}
							alt='Logo'
							style={{ width: `${logoSize}px`, height: 'auto' }}
							className='object-contain transition-opacity duration-200 cursor-pointer select-none'
							onClick={handleLogoClick}
							draggable={false}
							title='DRIP UZ'
						/>
					)}
					{showShopName && config?.shopName && (
						<h1
							className='font-semibold transition-opacity duration-200 chrome-text tracking-tighter uppercase relative'
							data-testid='text-brand-name'
							style={{
								fontFamily:
									config?.fonts?.shopNameFontFamily ?
										'var(--font-family-shop-name)'
									:	undefined,
								fontSize: 
									config?.fonts?.shopNameFontSize ? 
										`${config.fonts.shopNameFontSize}px` 
									:	undefined,
							}}
						>
							<span className="absolute -left-4 top-0 text-foreground/50 text-xs">✦</span>
							{config.shopName}
							<span className="absolute -right-4 bottom-0 text-foreground/50 text-xs">✦</span>
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

					<Button
						size='icon'
						variant='ghost'
						onClick={() => setTheme(isDark ? 'light' : 'dark')}
						className='relative'
						data-testid='button-theme-toggle'
						title='Сменить тему'
					>
						{isDark ? <Sun className='w-5 h-5' /> : <Moon className='w-5 h-5' />}
					</Button>

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
