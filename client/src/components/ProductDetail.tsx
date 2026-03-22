import { Button } from '@/components/ui/button'
import { useConfig } from '@/hooks/useConfig'
import { optimizeProductDetail } from '@/lib/imageOptimizer'
import {
	ArrowLeft,
	Check,
	Clock,
	Heart,
	Image as ImageIcon,
	Package,
	ShoppingCart,
} from 'lucide-react'
import { useRef, useState } from 'react'

interface Attribute {
	name: string
	values: string[]
}

interface InventoryItem {
	color: string | null
	attribute1_value: string | null
	attribute2_value: string | null
	quantity: number
	backorder_lead_time_days: number | null
}

interface ProductDetailProps {
	id: string
	name: string
	description: string
	price: number
	old_price?: number
	images: string[]
	colors?: string[]
	attributes?: Attribute[]
	inventory?: InventoryItem[]
	isFavorite?: boolean
	isInCart?: boolean
	onToggleFavorite?: (id: string) => void
	onAddToCart?: (
		id: string,
		selectedColor?: string,
		selectedAttributes?: Record<string, string>
	) => void
	onBack?: () => void
	onCartClick?: () => void
}

export default function ProductDetail({
	id,
	name,
	description,
	price,
	old_price,
	images,
	colors,
	attributes,
	inventory = [],
	isFavorite = false,
	isInCart: isInCartProp = false,
	onToggleFavorite,
	onAddToCart,
	onBack,
	onCartClick,
}: ProductDetailProps) {
	const { formatPrice } = useConfig()

	const [currentImage, setCurrentImage] = useState(0)
	const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
	const [imageLoading, setImageLoading] = useState<Set<number>>(
		new Set(images.map((_, idx) => idx))
	)
	const [selectedColor, setSelectedColor] = useState<string | undefined>()
	const [selectedAttributes, setSelectedAttributes] = useState<
		Record<string, string>
	>({})
	const [wasAddedToCart, setWasAddedToCart] = useState(false)
	const touchStartX = useRef(0)
	const touchEndX = useRef(0)
	const touchStartY = useRef(0)
	const isSwiping = useRef(false)

	// Local state controls button - shows "Go to cart" after adding until characteristics change
	const isInCart = wasAddedToCart

	// Get inventory info for current combination
	const getCurrentInventory = (): InventoryItem | undefined => {
		if (inventory.length === 0) return undefined

		const attrValues = Object.values(selectedAttributes)
		const attr1 = attrValues[0] || null
		const attr2 = attrValues[1] || null

		return inventory.find(
			inv =>
				(inv.color === selectedColor ||
					(inv.color === null && !selectedColor)) &&
				(inv.attribute1_value === attr1 ||
					(inv.attribute1_value === null && !attr1)) &&
				(inv.attribute2_value === attr2 ||
					(inv.attribute2_value === null && !attr2))
		)
	}

	const currentInventory = getCurrentInventory()
	const hasInventoryTracking = inventory.length > 0

	const nextImage = () => {
		setCurrentImage(prev => (prev + 1) % images.length)
	}

	const prevImage = () => {
		setCurrentImage(prev => (prev - 1 + images.length) % images.length)
	}

	const handleFavorite = () => {
		onToggleFavorite?.(id)
	}

	const handleCartAction = () => {
		if (isInCart) {
			onCartClick?.()
		} else {
			onAddToCart?.(
				id,
				selectedColor,
				Object.keys(selectedAttributes).length > 0
					? selectedAttributes
					: undefined
			)
			setWasAddedToCart(true)
		}
	}

	const handleAttributeSelect = (attrName: string, value: string) => {
		setSelectedAttributes(prev => ({
			...prev,
			[attrName]: value,
		}))
		setWasAddedToCart(false)
	}

	const handleColorSelect = (color: string) => {
		setSelectedColor(color)
		setWasAddedToCart(false)
	}

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX
		touchStartY.current = e.touches[0].clientY
		isSwiping.current = false
	}

	const handleTouchMove = (e: React.TouchEvent) => {
		touchEndX.current = e.touches[0].clientX

		const swipeDistance = Math.abs(touchStartX.current - touchEndX.current)
		const verticalDistance = Math.abs(
			touchStartY.current - e.touches[0].clientY
		)

		if (swipeDistance > 10 && swipeDistance > verticalDistance) {
			isSwiping.current = true
		}
	}

	const handleTouchEnd = () => {
		const swipeDistance = touchStartX.current - touchEndX.current
		const minSwipeDistance = 50

		if (isSwiping.current && Math.abs(swipeDistance) > minSwipeDistance) {
			if (swipeDistance > 0) {
				nextImage()
			} else {
				prevImage()
			}
		}

		isSwiping.current = false
		touchStartX.current = 0
		touchEndX.current = 0
	}

	return (
		<div
			className='min-h-screen bg-background pb-12'
			data-testid='product-detail'
		>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				{/* Navigation Header */}
				<div className='sticky top-0 z-40 bg-background/95 backdrop-blur-sm px-0 py-4 flex items-center gap-4 md:static md:bg-transparent md:backdrop-filter-none md:border-none'>
					<Button
						size='icon'
						variant='outline'
						onClick={onBack}
						className='rounded-full h-10 w-10 border-border/40 hover:bg-muted transition-colors'
						data-testid='button-back'
					>
						<ArrowLeft className='w-5 h-5' />
					</Button>
					<h2 className='text-lg font-bold md:hidden'>Детали товара</h2>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mt-4'>
					{/* Left Column: Image Gallery */}
					<div className='space-y-6 lg:sticky lg:top-8'>
						<div
							className='relative aspect-square bg-muted/30 rounded-[32px] overflow-hidden group shadow-sm'
							onTouchStart={handleTouchStart}
							onTouchMove={handleTouchMove}
							onTouchEnd={handleTouchEnd}
						>
						<div className='relative w-full h-full'>
							{images.map((img, idx) => {
								const isLoading = imageLoading.has(idx) && !imageErrors.has(idx)
								const isVisible = idx === currentImage

								return (
									<div key={idx} className='absolute inset-0 w-full h-full'>
										{/* Skeleton заставка */}
										{isLoading && (
											<div
												className={`absolute inset-0 w-full h-full rounded-[32px] transition-opacity duration-300 ${
													isVisible ? 'opacity-100' : 'opacity-0'
												}`}
											>
												<div className='absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-muted rounded-[32px] animate-pulse'>
													<div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer' />
												</div>
											</div>
										)}

										{/* Изображение или ошибка */}
										{imageErrors.has(idx) ? (
											<div
												className={`absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-300 ${
													isVisible ? 'opacity-100' : 'opacity-0'
												}`}
											>
												<ImageIcon className='w-20 h-20 text-muted-foreground/40' />
											</div>
										) : (
											<img
												src={optimizeProductDetail(img)}
												alt={name}
												className={`absolute inset-0 w-full h-full object-cover rounded-[32px] transition-opacity duration-300 ${
													isVisible ? 'opacity-100' : 'opacity-0'
												}`}
												loading={idx === 0 ? 'eager' : 'lazy'}
												fetchPriority={idx === 0 ? 'high' : 'low'}
												decoding='async'
												onLoad={() => {
													setImageLoading(prev => {
														const next = new Set(prev)
														next.delete(idx)
														return next
													})
												}}
												onError={() => {
													setImageErrors(prev => new Set(prev).add(idx))
													setImageLoading(prev => {
														const next = new Set(prev)
														next.delete(idx)
														return next
													})
												}}
											/>
										)}
									</div>
								)
							})}
						</div>

						{/* Click zones for desktop */}
						{images.length > 1 && (
							<div className='absolute inset-0 hidden lg:flex z-[5]'>
								<div className='w-1/4 h-full cursor-pointer' onClick={prevImage} />
								<div className='flex-1 h-full' />
								<div className='w-1/4 h-full cursor-pointer' onClick={nextImage} />
							</div>
						)}

						{/* Favorite Button */}
						<button
							onClick={handleFavorite}
							className='absolute top-6 right-6 w-12 h-12 rounded-full bg-background/80 backdrop-blur-md border border-white/20 flex items-center justify-center z-10 shadow-lg hover:scale-110 active:scale-90 transition-all'
							data-testid='button-toggle-favorite'
						>
							<Heart
								className={`w-6 h-6 transition-colors ${
									isFavorite ? 'fill-red-500 text-red-500' : 'text-foreground/60'
								}`}
							/>
						</button>

						{/* Sale Badge */}
						{old_price && old_price > price && (
							<div className='absolute top-6 left-6 z-10'>
								<div className='bg-red-500 text-white text-sm font-black px-4 py-1.5 rounded-full shadow-xl flex items-center gap-1.5 backdrop-blur-md bg-red-500/90 border border-white/20'>
									<span>-{Math.round(((old_price - price) / old_price) * 100)}%</span>
								</div>
							</div>
						)}

						{/* Image Indicators */}
						{images.length > 1 && (
							<div className='absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10'>
								{images.map((_, idx) => (
									<button
										key={idx}
										onClick={() => setCurrentImage(idx)}
										className={`h-2 rounded-full transition-all duration-300 ${
											idx === currentImage
												? 'w-8 bg-foreground shadow-sm'
												: 'w-2 bg-foreground/20 hover:bg-foreground/40'
										}`}
									/>
								))}
							</div>
						)}
					</div>

					{/* Thumbnail List for Desktop */}
					{images.length > 1 && (
						<div className='hidden lg:flex gap-4 overflow-x-auto pb-2 scrollbar-none'>
							{images.map((img, idx) => (
								<button
									key={idx}
									onClick={() => setCurrentImage(idx)}
									className={`relative w-24 aspect-square rounded-2xl overflow-hidden shrink-0 border-2 transition-all ${
										currentImage === idx 
											? 'border-primary shadow-md scale-105' 
											: 'border-transparent opacity-60 hover:opacity-100'
									}`}
								>
									<img 
										src={optimizeProductDetail(img)} 
										alt={`${name} thumbnail ${idx}`}
										className='w-full h-full object-cover'
									/>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Right Column: Product Info */}
				<div className='space-y-8 lg:py-4'>
					<div className='space-y-4'>
						<div className='space-y-2'>
							<h1
								className='text-3xl md:text-4xl tracking-tight'
								style={{
									fontFamily: 'var(--font-family-custom, Inter)',
									fontWeight: 'var(--font-weight-product-name, 700)',
								}}
								data-testid='text-product-detail-name'
							>
								{name}
							</h1>
							<div className='h-1.5 w-20 bg-primary/20 rounded-full' />
						</div>

						<div className='flex items-baseline gap-4 flex-wrap'>
							<p
								className='text-4xl md:text-5xl tracking-tighter text-primary'
								style={{
									fontFamily: 'var(--font-family-custom, Inter)',
									fontWeight: 'var(--font-weight-price, 800)',
								}}
								data-testid='text-product-detail-price'
							>
								{formatPrice(price)}
							</p>
							{old_price && old_price > price && (
								<div className='flex items-center gap-3 bg-muted/50 px-3 py-1.5 rounded-2xl'>
									<p className='text-xl text-muted-foreground line-through opacity-40 font-medium'>
										{formatPrice(old_price)}
									</p>
									<span className='bg-red-500/10 text-red-500 text-xs font-black px-2 py-0.5 rounded-lg border border-red-500/20'>
										-{Math.round(((old_price - price) / old_price) * 100)}%
									</span>
								</div>
							)}
						</div>
					</div>

					<div className='space-y-3'>
						<div className='flex items-center gap-2 text-sm font-bold text-foreground/40 uppercase tracking-widest'>
							<Package className='w-4 h-4' />
							<span>Описание</span>
						</div>
						<div className='bg-muted/30 p-6 rounded-[24px] border border-border/10'>
							<p
								className='text-base text-muted-foreground leading-relaxed whitespace-pre-wrap'
								style={{
									fontFamily: 'var(--font-family-custom, Inter)',
									fontWeight: 'var(--font-weight-description, 400)',
								}}
								data-testid='text-product-description'
							>
								{description}
							</p>
						</div>
					</div>

					{/* Attributes Selection */}
					{attributes && attributes.length > 0 && (
						<div className='space-y-6'>
							{attributes.map((attr, idx) => (
								<div key={idx} className='space-y-3'>
									<h3 className='text-sm font-bold uppercase tracking-wider text-foreground/40'>{attr.name}</h3>
									<div className='flex flex-wrap gap-2'>
										{attr.values.map((value, vIdx) => (
											<button
												key={vIdx}
												onClick={() => handleAttributeSelect(attr.name, value)}
												className={`px-6 py-3 rounded-2xl border-2 text-sm font-bold transition-all duration-300 shadow-sm ${
													selectedAttributes[attr.name] === value
														? 'border-primary bg-primary text-primary-foreground scale-105 shadow-primary/20 shadow-lg'
														: 'border-border bg-card hover:border-primary/50 hover:bg-muted'
												}`}
												data-testid={`button-attribute-${attr.name}-${value}`}
											>
												{value}
											</button>
										))}
									</div>
								</div>
							))}
						</div>
					)}

					{/* Action Section */}
					{(() => {
						const hasColors = colors && colors.length > 0
						const hasAttributes = attributes && attributes.length > 0
						const colorSelected = !hasColors || selectedColor
						const allAttributesSelected =
							!hasAttributes ||
							attributes.every(attr => selectedAttributes[attr.name])
						const canAddToCart = colorSelected && allAttributesSelected

						const getMissingSelections = () => {
							const missing = []
							if (hasColors && !selectedColor) missing.push('цвет')
							if (hasAttributes) {
								attributes.forEach(attr => {
									if (!selectedAttributes[attr.name])
										missing.push(attr.name.toLowerCase())
								})
							}
							return missing
						}

						return (
							<div className='space-y-6 pt-4'>
								{colors && colors.length > 0 && (
									<div className='space-y-3'>
										<h3 className='text-sm font-bold uppercase tracking-wider text-foreground/40'>Цвет</h3>
										<div className='flex flex-wrap gap-4'>
											{colors.map((color, idx) => (
												<button
													key={idx}
													onClick={() => handleColorSelect(color)}
													className={`w-12 h-12 rounded-full border-4 transition-all duration-300 shadow-sm ${
														selectedColor === color
															? 'border-primary scale-110 shadow-lg'
															: 'border-card hover:scale-105 hover:border-primary/20'
													}`}
													style={{ backgroundColor: color }}
													title={color}
													data-testid={`button-color-${idx}`}
												>
													{selectedColor === color && (
														<Check className='w-6 h-6 mx-auto text-white drop-shadow-lg' />
													)}
												</button>
											))}
										</div>
									</div>
								)}

								<div className='space-y-3'>
									<div className='h-8 flex items-center'>
										{canAddToCart &&
											(currentInventory && currentInventory.quantity > 0 ? (
												<div className='flex items-center gap-2 text-green-500 font-bold bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/20'>
													<Package className='w-4 h-4' />
													<span className='text-xs uppercase tracking-widest'>В наличии</span>
												</div>
											) : (
												<div className='flex items-center gap-2 text-amber-500 font-bold bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20'>
													<Clock className='w-4 h-4' />
													<span className='text-xs uppercase tracking-widest'>Под заказ</span>
												</div>
											))}
									</div>
									<Button
										onClick={handleCartAction}
										className='w-full gap-3 h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all'
										size='lg'
										variant={isInCart ? 'default' : 'default'}
										disabled={!isInCart && !canAddToCart}
										data-testid='button-add-to-cart-detail'
									>
										{isInCart ? (
											<>
												<Check className='w-6 h-6' />
												ПЕРЕЙТИ В КОРЗИНУ
											</>
										) : (
											<>
												<ShoppingCart className='w-6 h-6' />
												ДОБАВИТЬ В КОРЗИНУ
											</>
										)}
									</Button>
									{!isInCart && !canAddToCart && (
										<div className='bg-muted/50 py-3 rounded-xl border border-dashed border-border/60 text-center animate-pulse'>
											<p className='text-xs font-medium text-muted-foreground'>
												Выберите: <span className='text-foreground font-bold'>{getMissingSelections().join(', ')}</span>
											</p>
										</div>
									)}
								</div>
							</div>
						)
					})()}
				</div>
			</div>
		</div>
	</div>
)
}
