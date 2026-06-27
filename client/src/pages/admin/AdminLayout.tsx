import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	BarChart3,
	FolderOpen,
	Globe,
	LogOut,
	Package,
	Settings,
	ShoppingCart,
	Users,
	Warehouse,
	Ticket,
	Crown,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useConfig } from '@/hooks/useConfig'
import { PaywallModal } from '@/components/PaywallModal'
import AdminCategories from './AdminCategories'
import AdminInventory from './AdminInventory'
import AdminManagers from './AdminManagers'
import AdminOrders from './AdminOrders'
import AdminProducts from './AdminProducts'
import AdminSettings from './AdminSettings'
import AdminStatistics from './AdminStatistics'
import AdminUsers from './AdminUsers'
import AdminPromoCodes from './AdminPromoCodes'
import { type AdminLang, getAdminLang, setAdminLang, t } from '@/i18n/admin'

const LANGS: { code: AdminLang; label: string; flag: string }[] = [
	{ code: 'ru', label: 'Русский', flag: '🇷🇺' },
	{ code: 'en', label: 'English', flag: '🇬🇧' },
	{ code: 'uz', label: "O'zbek", flag: '🇺🇿' },
]

export default function AdminLayout() {
	const [activeTab, setActiveTab] = useState('products')
	const [admin, setAdmin] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [, setLocation] = useLocation()
	const { config } = useConfig()
	const [paywallOpen, setPaywallOpen] = useState(false)
	const tier = config?.subscriptionTier || 'starter'
	const [lang, setLang] = useState<AdminLang>(getAdminLang)
	const [langOpen, setLangOpen] = useState(false)
	const langRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		checkAuth()
	}, [])

	useEffect(() => {
		const close = (e: MouseEvent) => {
			if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
		}
		document.addEventListener('mousedown', close)
		return () => document.removeEventListener('mousedown', close)
	}, [])

	const checkAuth = async () => {
		try {
			const response = await fetch('/api/admin/me')
			if (!response.ok) {
				setLocation('/admin/login')
				return
			}
			const data = await response.json()
			setAdmin(data.user)
		} catch (error) {
			setLocation('/admin/login')
		} finally {
			setLoading(false)
		}
	}

	const handleLogout = async () => {
		await fetch('/api/auth/logout', { method: 'POST' })
		setLocation('/admin/login')
	}

	const handleLangChange = (code: AdminLang) => {
		setLang(code)
		setAdminLang(code)
		setLangOpen(false)
	}

	const currentLang = LANGS.find(l => l.code === lang)

	if (loading) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-background'>
			<PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} requiredTier="business" featureName="улучшения вашего магазина" />
			<header className='border-b bg-card sticky top-0 z-50'>
				<div className='max-w-7xl mx-auto px-4 py-3 flex items-center justify-between'>
					<div className='flex items-center gap-3'>
						<h1 className='text-xl font-bold hidden sm:block'>{t(lang, 'admin_panel')}</h1>
						<div className='flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20'>
							<span className='text-[10px] sm:text-xs font-bold text-primary uppercase tracking-wider'>{tier}</span>
							{tier !== 'pro' && (
								<Button size='sm' variant='ghost' className='h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-primary/20 text-primary' onClick={() => setPaywallOpen(true)}>
									<Crown className='w-3 h-3 mr-1' /> Улучшить
								</Button>
							)}
						</div>
					</div>
					<div className='flex items-center gap-2'>
						{/* Language Switcher */}
						<div ref={langRef} className='relative'>
							<Button
								variant='ghost'
								size='sm'
								onClick={() => setLangOpen(!langOpen)}
								className='flex items-center gap-1.5 px-2 py-1 h-8 text-xs'
							>
								<Globe className='h-3.5 w-3.5' />
								<span className='hidden sm:inline'>{currentLang?.flag} {currentLang?.label}</span>
								<span className='sm:hidden'>{currentLang?.flag}</span>
							</Button>
							{langOpen && (
								<div className='absolute right-0 top-9 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]'>
									{LANGS.map(l => (
										<button
											key={l.code}
											onClick={() => handleLangChange(l.code)}
											className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-muted transition-colors ${lang === l.code ? 'bg-primary/10 text-primary font-medium' : ''}`}
										>
											<span>{l.flag}</span>
											<span>{l.label}</span>
										</button>
									))}
								</div>
							)}
						</div>
						<ThemeToggle />
						<span className='text-sm text-muted-foreground hidden sm:inline'>
							{admin?.email === 'superadmin' ? '' : admin?.email}
						</span>
						<Button variant='outline' size='sm' onClick={handleLogout}>
							<LogOut className='h-4 w-4 mr-2' />
							<span className='hidden sm:inline'>{t(lang, 'logout')}</span>
						</Button>
					</div>
				</div>
			</header>

			<div className='max-w-7xl mx-auto px-3 sm:px-4 py-4'>
				<Tabs
					value={activeTab}
					onValueChange={setActiveTab}
					className='w-full'
				>
					<div className='overflow-x-auto -mx-2 px-2 mb-6'>
						<TabsList className='flex w-max min-w-full h-auto p-1 items-stretch justify-start gap-1 [&>*]:flex-1'>
							<TabsTrigger
								value='products'
								className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
							>
								<Package className='h-4 w-4 flex-shrink-0' />
								<span>{t(lang, 'tab_products')}</span>
							</TabsTrigger>
							<TabsTrigger
								value='categories'
								className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
							>
								<FolderOpen className='h-4 w-4 flex-shrink-0' />
								<span>{t(lang, 'tab_categories')}</span>
							</TabsTrigger>
							<TabsTrigger
								value='inventory'
								className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
							>
								<Warehouse className='h-4 w-4 flex-shrink-0' />
								<span>{t(lang, 'tab_inventory')}</span>
							</TabsTrigger>
							<TabsTrigger
								value='orders'
								className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
							>
								<ShoppingCart className='h-4 w-4 flex-shrink-0' />
								<span>{t(lang, 'tab_orders')}</span>
							</TabsTrigger>
							<TabsTrigger
								value='promo'
								className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
							>
								<Ticket className='h-4 w-4 flex-shrink-0' />
								<span>{t(lang, 'tab_promo')}</span>
							</TabsTrigger>
							<TabsTrigger
								value='statistics'
								className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
							>
								<BarChart3 className='h-4 w-4 flex-shrink-0' />
								<span>{t(lang, 'tab_statistics')}</span>
							</TabsTrigger>
							{admin?.is_superadmin && (
								<TabsTrigger
									value='managers'
									className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
								>
									<Users className='h-4 w-4 flex-shrink-0' />
									<span>{t(lang, 'tab_managers')}</span>
								</TabsTrigger>
							)}
							<TabsTrigger
								value='users'
								className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
							>
								<Users className='h-4 w-4 flex-shrink-0' />
								<span>{t(lang, 'tab_users')}</span>
							</TabsTrigger>
							<TabsTrigger
								value='settings'
								className='flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap'
							>
								<Settings className='h-4 w-4 flex-shrink-0' />
								<span>{t(lang, 'tab_settings')}</span>
							</TabsTrigger>
						</TabsList>
					</div>

					{activeTab === 'products' && <AdminProducts />}
					{activeTab === 'categories' && <AdminCategories />}
					{activeTab === 'inventory' && <AdminInventory />}
					{activeTab === 'orders' && <AdminOrders />}
					{activeTab === 'promo' && <AdminPromoCodes />}
					{activeTab === 'statistics' && <AdminStatistics />}
					{activeTab === 'users' && <AdminUsers onTabChange={setActiveTab} />}
					{activeTab === 'managers' && admin?.is_superadmin && (
						<AdminManagers />
					)}
					{activeTab === 'settings' && <AdminSettings />}
				</Tabs>
			</div>
		</div>
	)
}

