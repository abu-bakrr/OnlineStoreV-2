import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useConfig } from '@/hooks/useConfig'
import {
	Edit,
	ExternalLink,
	LogOut,
	Package,
	Save,
	User,
	X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'

interface Order {
	id: string
	total: number
	status: string
	created_at: string
	items: Array<{
		id: string
		name: string
		price: number
		quantity: number
		selected_color?: string
		selected_attributes?: any
	}>
}

export default function ProfileDropdown() {
	const [, navigate] = useLocation()
	const { user, logout, checkAuth } = useAuth()
	const { config } = useConfig()
	const { toast } = useToast()
	const [orders, setOrders] = useState<Order[]>([])
	const [loadingOrders, setLoadingOrders] = useState(false)
	const [isEditing, setIsEditing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [editFormData, setEditFormData] = useState({
		first_name: '',
		last_name: '',
		phone: '',
		telegram_username: '',
	})

	const formatPrice = (price: number) => {
		const formattedPrice = (price / 100).toFixed(2)
		const currencySymbol = config?.currency?.symbol || '₽'
		const currencyPosition = config?.currency?.position || 'after'

		return currencyPosition === 'before'
			? `${currencySymbol}${formattedPrice}`
			: `${formattedPrice} ${currencySymbol}`
	}

	const formatDate = (dateString: string) => {
		const date = new Date(dateString)
		return date.toLocaleDateString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	const loadOrders = async () => {
		if (!user?.id) return

		setLoadingOrders(true)
		try {
			const response = await fetch('/api/orders', {
				credentials: 'include',
			})
			if (response.ok) {
				const data = await response.json()
				setOrders(data)
			}
		} catch (error) {
			console.error('Error loading orders:', error)
		} finally {
			setLoadingOrders(false)
		}
	}

	useEffect(() => {
		if (user) {
			loadOrders()
			setEditFormData({
				first_name: user.first_name || '',
				last_name: user.last_name || '',
				phone: user.phone || '',
				telegram_username: user.telegram_username || '',
			})
		}
	}, [user])

	const handleLogout = async () => {
		await logout()
	}

	const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setEditFormData({
			...editFormData,
			[e.target.name]: e.target.value,
		})
	}

	const handleSaveProfile = async () => {
		setIsSaving(true)
		try {
			const response = await fetch('/api/auth/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(editFormData),
			})

			if (response.ok) {
				await checkAuth()
				setIsEditing(false)
				toast({
					title: 'Успешно',
					description: 'Профиль обновлен',
				})
			} else {
				const data = await response.json()
				toast({
					title: 'Ошибка',
					description: data.error || 'Не удалось обновить профиль',
					variant: 'destructive',
				})
			}
		} catch (error) {
			toast({
				title: 'Ошибка',
				description: 'Ошибка сети',
				variant: 'destructive',
			})
		} finally {
			setIsSaving(false)
		}
	}

	const handleCancelEdit = () => {
		setIsEditing(false)
		if (user) {
			setEditFormData({
				first_name: user.first_name || '',
				last_name: user.last_name || '',
				phone: user.phone || '',
				telegram_username: user.telegram_username || '',
			})
		}
	}

	const getStatusLabel = (status: string) => {
		const orderStatuses = config?.orderStatuses || {
			pending: 'В обработке',
			processing: 'Собирается',
			shipped: 'В пути',
			delivered: 'Доставлен',
		}
		return orderStatuses[status as keyof typeof orderStatuses] || status
	}

	if (!user) return null

	const fullName =
		[user.first_name, user.last_name].filter(Boolean).join(' ') ||
		'Пользователь'

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='ghost' size='icon' className='relative'>
					<User className='h-5 w-5' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align='end'
				className='w-[380px] max-w-[calc(100vw-2rem)]'
			>
				<DropdownMenuLabel className='pb-3'>
					<div className='flex items-center justify-between'>
						<div className='flex flex-col space-y-1'>
							<p className='text-sm font-medium leading-none'>{fullName}</p>
							<p className='text-xs leading-none text-muted-foreground'>
								{user.email}
							</p>
						</div>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />

				<Tabs defaultValue='info' className='w-full'>
					<TabsList className='grid w-full grid-cols-2 mx-2 my-2'>
						<TabsTrigger value='info'>Профиль</TabsTrigger>
						<TabsTrigger value='orders'>Мои заказы</TabsTrigger>
					</TabsList>

					<TabsContent value='info' className='px-2 pb-2'>
						{isEditing ? (
							<div className='space-y-3'>
								<div>
									<label className='text-xs text-muted-foreground mb-1 block'>
										Имя
									</label>
									<Input
										name='first_name'
										value={editFormData.first_name}
										onChange={handleEditChange}
										placeholder='Введите имя'
										className='h-8 text-sm'
									/>
								</div>

								<div>
									<label className='text-xs text-muted-foreground mb-1 block'>
										Фамилия
									</label>
									<Input
										name='last_name'
										value={editFormData.last_name}
										onChange={handleEditChange}
										placeholder='Введите фамилию'
										className='h-8 text-sm'
									/>
								</div>

								<div>
									<label className='text-xs text-muted-foreground mb-1 block'>
										Телефон
									</label>
									<Input
										name='phone'
										value={editFormData.phone}
										onChange={handleEditChange}
										placeholder='+7 (___) ___-__-__'
										className='h-8 text-sm'
									/>
								</div>

								<div>
									<label className='text-xs text-muted-foreground mb-1 block'>
										Telegram
									</label>
									<Input
										name='telegram_username'
										value={editFormData.telegram_username}
										onChange={handleEditChange}
										placeholder='@username'
										className='h-8 text-sm'
									/>
								</div>

								<div className='flex gap-2 pt-2'>
									<Button
										onClick={handleSaveProfile}
										disabled={isSaving}
										size='sm'
										className='flex-1'
									>
										<Save className='h-3 w-3 mr-1' />
										{isSaving ? 'Сохранение...' : 'Сохранить'}
									</Button>
									<Button
										onClick={handleCancelEdit}
										disabled={isSaving}
										variant='outline'
										size='sm'
										className='flex-1'
									>
										<X className='h-3 w-3 mr-1' />
										Отмена
									</Button>
								</div>
							</div>
						) : (
							<div className='space-y-3 text-sm'>
								<div>
									<p className='text-muted-foreground text-xs mb-1'>Email</p>
									<p className='font-medium'>{user.email}</p>
								</div>

								<div>
									<p className='text-muted-foreground text-xs mb-1'>Имя</p>
									<p className='font-medium'>
										{user.first_name || 'Не указано'}
									</p>
								</div>

								<div>
									<p className='text-muted-foreground text-xs mb-1'>Фамилия</p>
									<p className='font-medium'>
										{user.last_name || 'Не указано'}
									</p>
								</div>

								<div>
									<p className='text-muted-foreground text-xs mb-1'>Телефон</p>
									<p className='font-medium'>{user.phone || 'Не указано'}</p>
								</div>

								<div>
									<p className='text-muted-foreground text-xs mb-1'>Telegram</p>
									<p className='font-medium'>
										{user.telegram_username || 'Не указано'}
									</p>
								</div>

								<Button
									onClick={() => setIsEditing(true)}
									variant='outline'
									size='sm'
									className='w-full mt-2'
								>
									<Edit className='h-3 w-3 mr-1' />
									Редактировать
								</Button>
							</div>
						)}
					</TabsContent>

					<TabsContent value='orders' className='px-2 pb-2'>
						<ScrollArea className='h-[280px]'>
							{loadingOrders ? (
								<div className='flex items-center justify-center h-32'>
									<p className='text-sm text-muted-foreground'>Загрузка...</p>
								</div>
							) : orders.length === 0 ? (
								<div className='flex flex-col items-center justify-center h-32 text-center'>
									<Package className='h-8 w-8 text-muted-foreground mb-2' />
									<p className='text-sm text-muted-foreground'>
										Заказов пока нет
									</p>
								</div>
							) : (
								<div className='space-y-3'>
									{orders.slice(0, 3).map(order => (
										<div
											key={order.id}
											className='border border-border rounded-lg p-3'
										>
											<div className='flex justify-between items-start mb-2'>
												<div>
													<p className='text-xs font-mono text-muted-foreground'>
														#{order.id}
													</p>
													<p className='text-xs text-muted-foreground'>
														{formatDate(order.created_at)}
													</p>
													<p className='text-sm font-medium mt-0.5'>
														{formatPrice(order.total)}
													</p>
												</div>
												<span
													className={`text-xs px-2 py-1 rounded ${
														order.status === 'delivered'
															? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
															: order.status === 'cancelled'
															? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
															: order.status === 'shipped'
															? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
															: order.status === 'processing'
															? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
															: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
													}`}
												>
													{getStatusLabel(order.status)}
												</span>
											</div>

											<div className='space-y-1'>
												{order.items.slice(0, 2).map((item, index) => (
													<div
														key={index}
														className='text-xs text-muted-foreground'
													>
														<span className='font-medium text-foreground'>
															{item.name}
														</span>
														{item.selected_color && (
															<span className='ml-1'>
																• {item.selected_color}
															</span>
														)}
														<span className='ml-1'>× {item.quantity}</span>
													</div>
												))}
												{order.items.length > 2 && (
													<p className='text-xs text-muted-foreground'>
														+{order.items.length - 2} ещё
													</p>
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</ScrollArea>

						{orders.length > 0 && (
							<Button
								variant='outline'
								size='sm'
								className='w-full mt-3'
								onClick={() => navigate('/orders')}
							>
								<ExternalLink className='h-3 w-3 mr-2' />
								Все заказы ({orders.length})
							</Button>
						)}
					</TabsContent>
				</Tabs>

				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleLogout} className='cursor-pointer'>
					<LogOut className='mr-2 h-4 w-4' />
					<span>Выйти</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
