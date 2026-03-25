import ImpersonationBanner from '@/components/ImpersonationBanner'
import FontLoader from '@/components/FontLoader'
import { OrganizationSchema } from '@/components/SEO'
import ThemeApplier from '@/components/ThemeApplier'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/hooks/useCart'
import { useConfig } from '@/hooks/useConfig'
import { useFavorites } from '@/hooks/useFavorites'
import Cart from '@/pages/Cart'
import Favorites from '@/pages/Favorites'
import ForgotPassword from '@/pages/ForgotPassword'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Orders from '@/pages/Orders'
import Product from '@/pages/Product'
import Register from '@/pages/Register'
import ResetPassword from '@/pages/ResetPassword'
import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Route, Router, Switch, useLocation } from 'wouter'
import { queryClient } from './lib/queryClient'

// Lazy-load админку для code splitting (загружается отдельно от основного бандла)
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'))
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'))

interface PendingAction {
	type: 'addToCart' | 'toggleFavorite' | 'navigate'
	productId?: string
	selectedColor?: string
	selectedAttributes?: Record<string, string>
	targetPath?: string
}

function AppContent() {
	const [location, setLocation] = useLocation()
	const [selectedProductId, setSelectedProductId] = useState<string>('')
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
	const [lastHomeUrl, setLastHomeUrl] = useState<string>('/')

	const { user, isLoading: isUserLoading } = useAuth()

	const {
		cartItems,
		isLoading: isCartLoading,
		addToCart,
		updateQuantity,
		removeFromCart,
		clearCart,
		clearCartAsync,
	} = useCart()

	const {
		favoriteItems,
		isLoading: isFavoritesLoading,
		toggleFavorite,
		favoriteIds,
	} = useFavorites()

	useEffect(() => {
		if (user && pendingAction && !isUserLoading) {
			const action = pendingAction
			setPendingAction(null)

			if (action.type === 'addToCart' && action.productId) {
				addToCart(
					action.productId,
					action.selectedColor,
					action.selectedAttributes
				)
			} else if (action.type === 'toggleFavorite' && action.productId) {
				toggleFavorite(action.productId)
			}

			setLocation(action.targetPath || '/')
		}
	}, [user, isUserLoading])

	const handleAddToCart = (
		id: string,
		selectedColor?: string,
		selectedAttributes?: Record<string, string>
	) => {
		if (!user) {
			setPendingAction({
				type: 'addToCart',
				productId: id,
				selectedColor,
				selectedAttributes,
				targetPath: location,
			})
			setLocation('/registration')
			return
		}
		addToCart(id, selectedColor, selectedAttributes)
	}

	const handleToggleFavorite = (id: string) => {
		if (!user) {
			setPendingAction({
				type: 'toggleFavorite',
				productId: id,
				targetPath: location,
			})
			setLocation('/registration')
			return
		}
		toggleFavorite(id)
	}

	const handleProductClick = (id: string) => {
		// Save current URL with filters before navigating to product
		if (location.startsWith('/') && !location.startsWith('/product')) {
			setLastHomeUrl(window.location.pathname + window.location.search)
		}
		setSelectedProductId(id)
		setLocation(`/product/${id}`)
	}

	const handleQuantityChange = (id: string, quantity: number) => {
		const cartItem = cartItems.find(
			item => item.cart_id === id || item.id === id
		)
		updateQuantity({ cartId: cartItem?.cart_id, productId: id, quantity })
	}

	const handleRemoveItem = (id: string) => {
		const cartItem = cartItems.find(
			item => item.cart_id === id || item.id === id
		)
		if (cartItem?.cart_id) {
			removeFromCart(cartItem.cart_id)
		}
	}

	const handleClearCart = async () => {
		if (user) {
			await clearCartAsync()
		}
	}

	const transformedCartItems = cartItems.map(item => ({
		id: item.cart_id || item.id,
		name: item.name,
		price: item.price,
		quantity: item.quantity,
		images: item.images,
		selected_color: item.selected_color,
		selected_attributes: item.selected_attributes,
	}))

	const transformedFavoriteItems = favoriteItems.map(item => ({
		id: item.id,
		name: item.name,
		price: item.price,
		images: item.images,
		isFavorite: true,
	}))

	const cartCount = transformedCartItems.reduce(
		(sum, item) => sum + item.quantity,
		0
	)
	const cartItemIds = (cartItems ?? []).map(item => item.product_id || item.id)

	if (isUserLoading) {
		return (
			<div className='flex items-center justify-center min-h-screen'>
				<div className='text-center'>
					<p className='text-muted-foreground'>Загрузка...</p>
				</div>
			</div>
		)
	}

	const handleCartClick = () => {
		if (!user) {
			setPendingAction({
				type: 'navigate',
				targetPath: '/cart',
			})
			setLocation('/registration')
			return
		}
		setLocation('/cart')
	}

	const handleFavoritesClick = () => {
		if (!user) {
			setPendingAction({
				type: 'navigate',
				targetPath: '/favorites',
			})
			setLocation('/registration')
			return
		}
		setLocation('/favorites')
	}

	const handleAccountClick = () => {
		if (!user) {
			setLocation('/login')
		}
	}

	return (
		<div className='w-full mx-auto bg-background min-h-screen'>
			<ImpersonationBanner />
			<div className='w-full'>
				<Switch>
					<Route path='/admin/login'>
						<Suspense
							fallback={
								<div className='min-h-screen flex items-center justify-center'>
									<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
								</div>
							}
						>
							<AdminLogin />
						</Suspense>
					</Route>

					<Route path='/admin'>
						<Suspense
							fallback={
								<div className='min-h-screen flex items-center justify-center'>
									<div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
								</div>
							}
						>
							<AdminLayout />
						</Suspense>
					</Route>

					<Route path='/login'>
						<Login
							onRegisterClick={() => setLocation('/registration')}
							onSuccess={() => {
								if (!pendingAction) {
									setLocation('/')
								}
							}}
						/>
					</Route>

					<Route path='/registration'>
						<Register
							onLoginClick={() => setLocation('/login')}
							onSuccess={() => {
								if (!pendingAction) {
									setLocation('/')
								}
							}}
						/>
					</Route>

					<Route path='/forgot-password'>
						<ForgotPassword />
					</Route>

					<Route path='/reset-password'>
						<ResetPassword />
					</Route>

					<Route path='/cart'>
						{user ? (
							<Cart
								items={transformedCartItems}
								onBack={() => setLocation('/')}
								onQuantityChange={handleQuantityChange}
								onRemoveItem={handleRemoveItem}
								onClearCart={handleClearCart}
							/>
						) : (
							<Register
								onLoginClick={() => setLocation('/login')}
								onSuccess={() => setLocation('/cart')}
							/>
						)}
					</Route>

					<Route path='/favorites'>
						{user ? (
							<Favorites
								items={transformedFavoriteItems}
								onBack={() => setLocation('/')}
								onClearAll={() => {
									favoriteIds.forEach(id => toggleFavorite(id))
								}}
								onToggleFavorite={handleToggleFavorite}
								onAddToCart={handleAddToCart}
								onProductClick={handleProductClick}
							/>
						) : (
							<Register
								onLoginClick={() => setLocation('/login')}
								onSuccess={() => setLocation('/favorites')}
							/>
						)}
					</Route>

					<Route path='/orders'>
						{user ? (
							<Orders />
						) : (
							<Register
								onLoginClick={() => setLocation('/login')}
								onSuccess={() => setLocation('/orders')}
							/>
						)}
					</Route>

					<Route path='/product/:id'>
						{params => {
							const productId = params.id || selectedProductId
							return (
								<Product
									productId={productId}
									onBack={() => setLocation(lastHomeUrl)}
									onAddToCart={handleAddToCart}
									onToggleFavorite={handleToggleFavorite}
									isFavorite={(favoriteIds ?? []).includes(productId)}
									isInCart={(cartItemIds ?? []).includes(productId)}
									onCartClick={() => setLocation('/cart')}
								/>
							)
						}}
					</Route>

					<Route path='/'>
						<Home
							onCartClick={handleCartClick}
							onFavoritesClick={handleFavoritesClick}
							onAccountClick={handleAccountClick}
							onProductClick={handleProductClick}
							cartCount={cartCount}
							favoritesCount={transformedFavoriteItems.length}
							onAddToCart={handleAddToCart}
							onToggleFavorite={handleToggleFavorite}
							favoriteIds={favoriteIds}
							cartItemIds={cartItemIds}
						/>
					</Route>
				</Switch>
			</div>
		</div>
	)
}

function TitleUpdater() {
	const { config } = useConfig()

	useEffect(() => {
		if (config?.description) {
			document.title = config.description
		}
	}, [config?.description])

	return null
}

import { ThemeProvider } from '@/components/ThemeProvider'

function App() {
	return (
		<ThemeProvider defaultTheme='system' storageKey='vite-ui-theme'>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<AuthProvider>
						<Router>
							<TitleUpdater />
							<ThemeApplier />
							<FontLoader />
							<OrganizationSchema />
							<AppContent />
							<Toaster />
						</Router>
					</AuthProvider>
				</TooltipProvider>
			</QueryClientProvider>
		</ThemeProvider>
	)
}

export default App
