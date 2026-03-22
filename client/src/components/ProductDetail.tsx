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
				{/* Back Button Header - Visible on Mobile, integrated on Desktop */}
				<div className='sticky top-0 z-40 bg-background/95 backdrop-blur-sm px-0 py-3 mb-4 flex items-center gap-3 md:pt-8 md:pb-6 md:static md:bg-transparent'>
					<Button
						size='icon'
						variant='ghost'
						onClick={onBack}
						className="rounded-full bg-muted/30 hover:bg-muted"
						data-testid='button-back'
					>
						<ArrowLeft className='w-5 h-5' />
					</Button>
					<h2 className='text-lg font-bold md:text-xl'>Детали товара</h2>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 items-start'>
					{/* Image Gallery Column */}
					<div className='space-y-4'>
						<div
							className='relative aspect-square bg-muted rounded-3xl overflow-hidden shadow-sm group'
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
													className={`absolute inset-0 w-full h-full rounded-2xl transition-opacity duration-300 ${
														isVisible ? 'opacity-100' : 'opacity-0'
													}`}
												>
													<div className='absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-muted rounded-2xl animate-pulse'>
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
													<ImageIcon className='w-20 h-20 text-muted-foreground/30' />
												</div>
											) : (
												<img
													src={optimizeProductDetail(img)}
													alt={name}
													className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 transform group-hover:scale-105 ${
														isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
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

							{/* Hover-зоны для ПК */}
							{images.length > 1 && (
								<div className='absolute inset-0 hidden md:flex z-[1]'>
									{images.map((_, idx) => (
										<div
											key={idx}
											className='flex-1 h-full cursor-pointer'
											onMouseEnter={() => setCurrentImage(idx)}
										/>
									))}
								</div>
							)}

							{/* Favorite Button */}
							<button
								onClick={handleFavorite}
								className='absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow-sm border flex items-center justify-center z-10 transition-transform active:scale-95 hover:bg-white'
								data-testid='button-toggle-favorite'
							>
								<Heart
									className={`w-5 h-5 transition-colors ${
										isFavorite ? 'fill-red-500 text-red-500' : 'text-foreground/40'
									}`}
								/>
							</button>

							{/* Discount Badge */}
							{old_price && old_price > price && (
								<div className='absolute top-4 left-4 z-10'>
									<div className='bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-2xl shadow-lg border border-red-400/20'>
										-{Math.round(((old_price - price) / old_price) * 100)}%
									</div>
								</div>
							)}

							{/* Image Indicators */}
							{images.length > 1 && (
								<div className='absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/10 backdrop-blur-sm px-2 py-1.5 rounded-full'>
									{images.map((_, idx) => (
										<div
											key={idx}
											className={`h-1.5 rounded-full transition-all duration-300 ${
												idx === currentImage
													? 'w-4 bg-white'
													: 'w-1.5 bg-white/40'
											}`}
										/>
									))}
								</div>
							)}
						</div>

						{/* Thumbnails (Desktop) */}
						{images.length > 1 && (
							<div className='hidden md:flex gap-3 overflow-x-auto pb-2 scrollbar-none'>
								{images.map((img, idx) => (
									<button
										key={idx}
										onClick={() => setCurrentImage(idx)}
										className={`relative w-20 aspect-square rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
											idx === currentImage ? 'border-primary ring-2 ring-primary/10' : 'border-transparent opacity-60 hover:opacity-100'
										}`}
									>
										<img src={img} alt="" className="w-full h-full object-cover" />
									</button>
								))}
							</div>
						)}
					</div>

					{/* Product Info Column */}
					<div className='md:sticky md:top-24 space-y-8'>
						<div className='space-y-4'>
							<h1
								className='text-3xl lg:text-4xl leading-tight'
								style={{
									fontFamily: 'var(--font-family-custom, Inter)',
									fontWeight: 'var(--font-weight-product-name, 700)',
								}}
								data-testid='text-product-detail-name'
							>
								{name}
							</h1>
							
							<div className='flex flex-wrap items-center gap-4'>
								<div className='flex items-baseline gap-3 bg-secondary/30 px-4 py-3 rounded-2xl border border-secondary'>
									<span
										className='text-3xl lg:text-4xl text-foreground'
										style={{
											fontFamily: 'var(--font-family-custom, Inter)',
											fontWeight: 'var(--font-weight-price, 700)',
										}}
										data-testid='text-product-detail-price'
									>
										{formatPrice(price)}
									</span>
									{old_price && old_price > price && (
										<span className='text-lg text-muted-foreground line-through opacity-50 font-medium'>
											{formatPrice(old_price)}
										</span>
									)}
								</div>
								
								{old_price && old_price > price && (
									<span className='bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-3 py-1.5 rounded-xl text-sm font-black'>
										ВЫГОДА {formatPrice(old_price - price)}
									</span>
								)}
							</div>
						</div>

						<div className='bg-card rounded-3xl p-6 border shadow-sm space-y-6'>
							{/* Attributes Selection */}
							{attributes && attributes.length > 0 && (
								<div className='space-y-6'>
									{attributes.map((attr, idx) => (
										<div key={idx} className='space-y-3'>
											<div className='flex items-center justify-between'>
												<h3 className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>{attr.name}</h3>
												{selectedAttributes[attr.name] && (
													<span className="text-xs font-semibold text-primary">{selectedAttributes[attr.name]}</span>
												)}
											</div>
											<div className='flex flex-wrap gap-2.5'>
												{attr.values.map((value, vIdx) => (
													<button
														key={vIdx}
														onClick={() => handleAttributeSelect(attr.name, value)}
														className={`px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
															selectedAttributes[attr.name] === value
																? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105'
																: 'border-muted bg-muted/20 hover:border-primary/30 hover:bg-muted/40'
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

							{/* Color Selection */}
							{colors && colors.length > 0 && (
								<div className='space-y-3'>
									<div className='flex items-center justify-between'>
										<h3 className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>Цвет</h3>
										{selectedColor && (
											<span className="text-xs font-semibold text-primary">{selectedColor}</span>
										)}
									</div>
									<div className='flex flex-wrap gap-4'>
										{colors.map((color, idx) => (
											<button
												key={idx}
												onClick={() => handleColorSelect(color)}
												className={`w-12 h-12 rounded-full border-4 transition-all relative ${
													selectedColor === color
														? 'border-primary ring-4 ring-primary/10 scale-110 shadow-lg'
														: 'border-white dark:border-zinc-800 shadow-sm hover:scale-105'
												}`}
												style={{ backgroundColor: color }}
												title={color}
												data-testid={`button-color-${idx}`}
											>
												{selectedColor === color && (
													<div className="absolute inset-0 flex items-center justify-center">
														<div className="w-1.5 h-1.5 rounded-full bg-white shadow-xl" />
													</div>
												)}
											</button>
										))}
									</div>
								</div>
							)}

							{/* Action Button Section Area */}
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
									<div className='space-y-4 pt-4 border-t'>
										<div className='flex items-center justify-between px-1'>
											{canAddToCart ? (
												currentInventory && currentInventory.quantity > 0 ? (
													<span className='inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-tight text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg dark:bg-emerald-900/30 dark:text-emerald-400'>
														<Package className='w-3.5 h-3.5' />
														<span>В наличии</span>
													</span>
												) : (
													<span className='inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-tight text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg dark:bg-amber-900/30 dark:text-amber-400'>
														<Clock className='w-3.5 h-3.5' />
														<span>Под заказ</span>
													</span>
												)
											) : (
												<span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest animate-pulse">
													Выберите опции ниже
												</span>
											)}
										</div>
										
										<div className="flex gap-4">
											<Button
												onClick={handleCartAction}
												className='flex-1 h-16 rounded-[20px] text-lg font-bold gap-3 shadow-xl transition-all active:scale-[0.98]'
												size='lg'
												variant={isInCart ? 'secondary' : 'default'}
												disabled={!isInCart && !canAddToCart}
												data-testid='button-add-to-cart-detail'
											>
												{isInCart ? (
													<>
														<Check className='w-6 h-6' />
														Перейти в корзину
													</>
												) : (
													<>
														<ShoppingCart className='w-6 h-6' />
														Добавить в корзину
													</>
												)}
											</Button>
										</div>

										{!isInCart && !canAddToCart && (
											<p className='text-xs text-center text-muted-foreground/60 font-medium'>
												Для покупки нужно выбрать: {getMissingSelections().join(', ')}
											</p>
										)}
									</div>
								)
							})()}
						</div>

						{/* Description Section */}
						<div className='bg-muted/30 rounded-3xl p-6 space-y-4'>
							<h3 className='text-sm font-bold uppercase tracking-widest text-muted-foreground'>Описание товара</h3>
							<p
								className='text-base text-foreground/80 leading-relaxed whitespace-pre-wrap'
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
				</div>
			</div>
		</div>
	)
}
