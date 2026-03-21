import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { AnimatePresence, motion } from 'framer-motion'
import {
	Calendar,
	CreditCard,
	ExternalLink,
	Mail,
	MessageSquare,
	Phone,
	Search,
	ShoppingCart,
	User as UserIcon,
	Users as UsersIcon,
	TrendingUp,
	ArrowUpDown
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface User {
	id: string
	username: string | null
	first_name: string | null
	last_name: string | null
	email: string | null
	telegram_id: number | null
	telegram_username: string | null
	phone: string | null
	created_at: string
	order_ids: string[]
	total_orders: number
	total_spent: number
	last_order_at: string | null
	is_admin: boolean
	is_superadmin: boolean
}

interface AdminUsersProps {
	onTabChange?: (tab: string) => void
}

type SortOption = 'newest' | 'orders' | 'spent'

export default function AdminUsers({ onTabChange }: AdminUsersProps) {
	const [users, setUsers] = useState<User[]>([])
	const [loading, setLoading] = useState(true)
	const [searchQuery, setSearchQuery] = useState('')
	const [sortBy, setSortBy] = useState<SortOption>('newest')
	const { toast } = useToast()

	useEffect(() => {
		fetchUsers()
	}, [])

	const fetchUsers = async () => {
		try {
			const response = await fetch('/api/admin/users')
			if (!response.ok) throw new Error('Failed to fetch users')
			const data = await response.json()
			setUsers(data)
		} catch (error) {
			toast({
				title: 'Ошибка',
				description: 'Не удалось загрузить пользователей',
				variant: 'destructive',
			})
		} finally {
			setLoading(false)
		}
	}

	const stats = useMemo(() => {
		const totalUsers = users.length
		const usersWithOrders = users.filter((u: User) => u.total_orders > 0).length
		const totalRevenue = users.reduce((sum: number, u: User) => sum + (Number(u.total_spent) || 0), 0)
		return { totalUsers, usersWithOrders, totalRevenue }
	}, [users])

	const sortedAndFilteredUsers = useMemo(() => {
		let filtered = users
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			filtered = users.filter(
				(user: User) =>
					(user.first_name?.toLowerCase() ?? '').includes(query) ||
					(user.last_name?.toLowerCase() ?? '').includes(query) ||
					(user.email?.toLowerCase() ?? '').includes(query) ||
					(user.phone?.toLowerCase() ?? '').includes(query) ||
					(user.username?.toLowerCase() ?? '').includes(query) ||
					(user.telegram_username?.toLowerCase() ?? '').includes(query) ||
					(user.id?.toLowerCase() ?? '').includes(query)
			)
		}

		return [...filtered].sort((a, b) => {
			if (sortBy === 'newest') {
				return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			}
			if (sortBy === 'orders') {
				return b.total_orders - a.total_orders
			}
			if (sortBy === 'spent') {
				return (Number(b.total_spent) || 0) - (Number(a.total_spent) || 0)
			}
			return 0
		})
	}, [users, searchQuery, sortBy])

	const formatDate = (dateString: string | null) => {
		if (!dateString) return 'Нет'
		return new Date(dateString).toLocaleDateString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		})
	}

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(price) + ' сум'
	}

	const handleGoToOrder = (orderId: string) => {
		if (onTabChange) {
			onTabChange('orders')
			localStorage.setItem('admin_order_search', orderId)
		}
	}

	if (loading) {
		return (
			<div className='flex justify-center p-12'>
				<div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary'></div>
			</div>
		)
	}

	return (
		<div className='space-y-6 pb-10'>
			{/* Stats Overview */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
				<Card className='bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-sm'>
					<CardContent className='pt-6'>
						<div className='flex items-center gap-3'>
							<div className='p-2 bg-primary/10 rounded-lg'>
								<UsersIcon className='h-5 w-5 text-primary' />
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>Всего пользователей</p>
								<h3 className='text-2xl font-bold'>{stats.totalUsers}</h3>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className='bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-none shadow-sm'>
					<CardContent className='pt-6'>
						<div className='flex items-center gap-3'>
							<div className='p-2 bg-blue-500/10 rounded-lg'>
								<ShoppingCart className='h-5 w-5 text-blue-500' />
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>С заказами</p>
								<h3 className='text-2xl font-bold'>{stats.usersWithOrders}</h3>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className='bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-none shadow-sm'>
					<CardContent className='pt-6'>
						<div className='flex items-center gap-3'>
							<div className='p-2 bg-emerald-500/10 rounded-lg'>
								<TrendingUp className='h-5 w-5 text-emerald-500' />
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>Общий доход</p>
								<h3 className='text-2xl font-bold'>{formatPrice(stats.totalRevenue)}</h3>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Filters & Actions */}
			<div className='flex flex-col md:flex-row gap-4'>
				<div className='relative flex-1'>
					<Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
					<Input
						placeholder='Поиск по имени, email, телефону или ID...'
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						className='pl-10 h-11 bg-card'
					/>
				</div>
				<div className='flex gap-2 shrink-0'>
					<Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
						<SelectTrigger className='w-[180px] h-11 bg-card'>
							<div className='flex items-center gap-2'>
								<ArrowUpDown className='h-4 w-4 text-muted-foreground' />
								<SelectValue placeholder='Сортировка' />
							</div>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='newest'>Сначала новые</SelectItem>
							<SelectItem value='orders'>Больше заказов</SelectItem>
							<SelectItem value='spent'>Больше трат</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* User Cards Grid */}
			<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
				<AnimatePresence mode='popLayout'>
					{sortedAndFilteredUsers.map((user: User, index: number) => (
						<motion.div
							key={user.id}
							layout
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95 }}
							transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.5) }}
						>
							<Card className='h-full overflow-hidden hover:shadow-lg transition-all border-border/50 group bg-card'>
								<CardContent className='p-0'>
									<div className='p-5'>
										<div className='flex items-start justify-between gap-2 mb-4'>
											<div className='flex items-center gap-3 overflow-hidden'>
												<div className='w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 rotate-3 group-hover:rotate-0 transition-transform'>
													<UserIcon className='h-6 w-6 text-primary' />
												</div>
												<div className='min-w-0'>
													<h3 className='font-bold text-base truncate leading-tight'>
														{user.first_name || user.username || 'Без имени'} {user.last_name}
													</h3>
													<p className='text-[10px] text-muted-foreground font-mono mt-0.5 opacity-60'>
														ID: {user.id.slice(0, 8)}...
													</p>
												</div>
											</div>
											<div className='flex flex-col gap-1 items-end'>
												{user.telegram_id && (
													<Badge variant='outline' className='bg-blue-50/50 text-blue-600 dark:bg-blue-900/10 dark:text-blue-400 border-blue-200/50 gap-1 px-1.5 py-0 text-[10px]'>
														<MessageSquare className='h-3 w-3' />
														TG
													</Badge>
												)}
												{(user.is_admin || user.is_superadmin) && (
													<Badge variant='outline' className='bg-purple-50/50 text-purple-600 border-purple-200/50 px-1.5 py-0 text-[10px]'>
														Админ
													</Badge>
												)}
											</div>
										</div>

										<div className='space-y-2.5 text-sm'>
											{user.telegram_username && (
												<div className='flex items-center gap-2.5 text-muted-foreground/80'>
													<MessageSquare className='h-3.5 w-3.5 shrink-0 text-blue-500' />
													<span className='truncate font-medium'>@{user.telegram_username}</span>
												</div>
											)}
											{user.email ? (
												<div className='flex items-center gap-2.5 text-muted-foreground/80'>
													<Mail className='h-3.5 w-3.5 shrink-0' />
													<span className='truncate'>{user.email}</span>
												</div>
											) : null}
											{user.phone ? (
												<div className='flex items-center gap-2.5 text-muted-foreground/80'>
													<Phone className='h-3.5 w-3.5 shrink-0' />
													<span>{user.phone}</span>
												</div>
											) : null}
											<div className='flex items-center gap-2.5 text-muted-foreground/80'>
												<Calendar className='h-3.5 w-3.5 shrink-0' />
												<span>Рег: {formatDate(user.created_at)}</span>
											</div>
										</div>
									</div>

									<div className='bg-muted/30 px-5 py-4 border-t border-border/50'>
										<div className='flex items-center justify-between mb-3'>
											<div className='flex flex-col'>
												<span className='text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60'>Траты</span>
												<span className='text-sm font-bold text-emerald-600 dark:text-emerald-400'>
													{formatPrice(user.total_spent)}
												</span>
											</div>
											<div className='flex flex-col items-end'>
												<span className='text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60'>Заказов</span>
												<span className='text-sm font-bold'>{user.total_orders}</span>
											</div>
										</div>
										
										{user.order_ids.length > 0 ? (
											<div className='space-y-2'>
												<div className='flex flex-wrap gap-1.5'>
													{user.order_ids.slice(0, 5).map(orderId => (
														<button
															key={orderId}
															onClick={() => handleGoToOrder(orderId)}
															className='inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-background border border-border hover:border-primary/50 hover:bg-primary/5 text-[10px] font-mono transition-all group/order'
														>
															<span className='text-muted-foreground group-hover/order:text-primary'>#</span>
															{orderId.slice(0, 6)}
															<ExternalLink className='h-2.5 w-2.5 opacity-40 group-hover/order:opacity-100 group-hover/order:text-primary' />
														</button>
													))}
													{user.order_ids.length > 5 && (
														<span className='text-[10px] text-muted-foreground py-1 px-1'>
															+{user.order_ids.length - 5} еще
														</span>
													)}
												</div>
												{user.last_order_at && (
													<p className='text-[10px] text-muted-foreground/60 flex items-center gap-1 pt-1'>
														<CreditCard className='h-2.5 w-2.5' />
														Посл. заказ: {formatDate(user.last_order_at)}
													</p>
												)}
											</div>
										) : (
											<div className='flex items-center justify-center py-2 border border-dashed border-muted-foreground/20 rounded-lg'>
												<p className='text-[10px] text-muted-foreground italic font-medium'>Заказов пока нет</p>
											</div>
										)}
									</div>
								</CardContent>
							</Card>
						</motion.div>
					))}
				</AnimatePresence>
			</div>

			{sortedAndFilteredUsers.length === 0 && (
				<motion.div 
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					className='text-center py-20 bg-card rounded-3xl border-2 border-dashed border-border/50'
				>
					<div className='w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4'>
						<UsersIcon className='h-8 w-8 text-muted-foreground opacity-30' />
					</div>
					<h3 className='text-lg font-semibold'>Ничего не найдено</h3>
					<p className='text-muted-foreground text-sm max-w-xs mx-auto mt-1'>
						{users.length === 0 
							? 'В базе данных пока нет зарегистрированных пользователей' 
							: 'Попробуйте изменить параметры поиска или фильтры'}
					</p>
					{searchQuery && (
						<Button 
							variant='link' 
							onClick={() => setSearchQuery('')}
							className='mt-2'
						>
							Сбросить поиск
						</Button>
					)}
				</motion.div>
			)}
		</div>
	)
}
