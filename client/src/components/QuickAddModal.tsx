import { Button } from '@/components/ui/button'
import { useConfig } from '@/hooks/useConfig'
import { optimizeProductThumbnail } from '@/lib/imageOptimizer'
import { Check, Clock, Loader2, Package, ShoppingCart, X } from 'lucide-react'
import { useEffect, useState } from 'react'

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

interface Product {
	id: string
	name: string
	price: number
	old_price?: number
	images: string[]
	colors?: string[]
	attributes?: Attribute[]
	inventory?: InventoryItem[]
}

interface QuickAddModalProps {
	isOpen: boolean
	productId: string | null
	onClose: () => void
	onAddToCart: (
		productId: string,
		selectedColor?: string,
		selectedAttributes?: Record<string, string>
	) => void
	isInCart?: boolean
	onCartClick?: () => void
}

export default function QuickAddModal({
	isOpen,
	productId,
	onClose,
	onAddToCart,
	isInCart = false,
	onCartClick,
}: QuickAddModalProps) {
	const { formatPrice } = useConfig()
	const [product, setProduct] = useState<Product | null>(null)
	const [loading, setLoading] = useState(false)
	const [selectedColor, setSelectedColor] = useState<string | undefined>()
	const [selectedAttributes, setSelectedAttributes] = useState<
		Record<string, string>
	>({})

	useEffect(() => {
		if (isOpen && productId) {
			fetchProduct()
		} else {
			setProduct(null)
			setSelectedColor(undefined)
			setSelectedAttributes({})
		}
	}, [isOpen, productId])

	const fetchProduct = async () => {
		if (!productId) return

		setLoading(true)
		try {
			const response = await fetch(`/api/products/${productId}`)
			if (response.ok) {
				const data = await response.json()
				setProduct(data)
				if (data.colors && data.colors.length > 0) {
					setSelectedColor(data.colors[0])
				}
				if (data.attributes && data.attributes.length > 0) {
					const defaultAttrs: Record<string, string> = {}
					data.attributes.forEach((attr: Attribute) => {
						if (attr.values.length > 0) {
							defaultAttrs[attr.name] = attr.values[0]
						}
					})
					setSelectedAttributes(defaultAttrs)
				}
			}
		} catch (error) {
			console.error('Error fetching product:', error)
		} finally {
			setLoading(false)
		}
	}

	const handleAddToCart = () => {
		if (!productId) return

		if (isInCart) {
			onCartClick?.()
		} else {
			onAddToCart(
				productId,
				selectedColor,
				Object.keys(selectedAttributes).length > 0
					? selectedAttributes
					: undefined
			)
			onClose()
		}
	}

	const handleAttributeSelect = (attrName: string, value: string) => {
		setSelectedAttributes(prev => ({
			...prev,
			[attrName]: value,
		}))
	}

	const hasOptions =
		(product?.colors && product.colors.length > 0) ||
		(product?.attributes && product.attributes.length > 0)

	const getCurrentInventory = (): InventoryItem | undefined => {
		if (!product?.inventory || product.inventory.length === 0) return undefined

		const attrValues = Object.values(selectedAttributes)
		const attr1 = attrValues[0] || null
		const attr2 = attrValues[1] || null

		return product.inventory.find(
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
	const hasInventoryTracking =
		product?.inventory && product.inventory.length > 0

	if (!isOpen) return null

	return (
		<div
			className='fixed inset-0 z-50 flex items-end sm:items-center justify-center'
			onClick={e => {
				if (e.target === e.currentTarget) onClose()
			}}
		>
			<div className='absolute inset-0 bg-black/50' onClick={onClose} />

			<div className='relative w-full max-w-md bg-card rounded-t-[32px] sm:rounded-[32px] max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-500 shadow-2xl border border-white/10'>
				<div className='sticky top-0 bg-card/80 backdrop-blur-md z-10 flex items-center justify-between p-6 border-b border-border/10'>
					<h3 className='font-bold text-xl tracking-tight'>Добавить в корзину</h3>
					<button
						onClick={onClose}
						className='w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors'
					>
						<X className='w-5 h-5' />
					</button>
				</div>

				<div className='overflow-y-auto p-4 space-y-4'>
					{loading ? (
						<div className='flex items-center justify-center py-8'>
							<Loader2 className='w-6 h-6 animate-spin text-primary' />
						</div>
					) : product ? (
						<>
							<div className='flex gap-6 items-start'>
								<div className='w-24 h-24 rounded-2xl overflow-hidden bg-muted flex-shrink-0 shadow-inner'>
									{product.images && product.images[0] ? (
										<img
											src={optimizeProductThumbnail(product.images[0])}
											alt={product.name}
											className='w-full h-full object-cover transition-transform duration-500 hover:scale-110'
											loading='lazy'
											decoding='async'
										/>
									) : (
										<div className='w-full h-full flex items-center justify-center text-muted-foreground bg-muted'>
											<Package className='w-8 h-8 opacity-20' />
										</div>
									)}
								</div>
								<div className='flex-1 min-w-0 py-1'>
									<h4 className='font-bold text-lg leading-tight line-clamp-2 tracking-tight'>{product.name}</h4>
									<div className='flex items-baseline gap-3 mt-2 flex-wrap'>
										<p className='text-2xl font-black text-primary tracking-tighter'>
											{formatPrice(product.price)}
										</p>
										{product.old_price && product.old_price > product.price && (
											<div className="flex items-center gap-2 bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/20">
												<p className='text-sm text-muted-foreground line-through opacity-40 font-medium'>
													{formatPrice(product.old_price)}
												</p>
												<span className="text-red-500 text-[10px] font-black">
													-{Math.round(((product.old_price - product.price) / product.old_price) * 100)}%
												</span>
											</div>
										)}
									</div>
								</div>
							</div>

							{product.colors && product.colors.length > 0 && (
								<div className='space-y-3'>
									<label className='text-xs font-black uppercase tracking-widest text-foreground/40'>
										Цвет
									</label>
									<div className='flex flex-wrap gap-3'>
										{product.colors.map(color => (
											<button
												key={color}
												onClick={() => setSelectedColor(color)}
												className={`w-10 h-10 rounded-full border-4 transition-all duration-300 shadow-sm ${
													selectedColor === color
														? 'border-primary scale-110 shadow-primary/20 shadow-md'
														: 'border-card hover:scale-105 hover:border-primary/20'
												}`}
												style={{ backgroundColor: color }}
												title={color}
											>
												{selectedColor === color && (
													<Check className='w-5 h-5 mx-auto text-white drop-shadow-md' />
												)}
											</button>
										))}
									</div>
								</div>
							)}

							{product.attributes &&
								product.attributes.map(attr => (
									<div key={attr.name} className='space-y-3'>
										<label className='text-xs font-black uppercase tracking-widest text-foreground/40'>
											{attr.name}
										</label>
										<div className='flex flex-wrap gap-2'>
											{attr.values.map(value => (
												<button
													key={value}
													onClick={() =>
														handleAttributeSelect(attr.name, value)
													}
													className={`px-5 py-2.5 rounded-2xl border-2 text-sm font-bold transition-all duration-300 shadow-sm ${
														selectedAttributes[attr.name] === value
															? 'bg-primary text-primary-foreground border-primary scale-105 shadow-primary/20 shadow-lg'
															: 'bg-card border-border hover:border-primary/50 hover:bg-muted'
													}`}
												>
													{value}
												</button>
											))}
										</div>
									</div>
								))}

							{!hasOptions && (
								<p className='text-sm text-muted-foreground text-center py-2'>
									Дополнительные опции не требуются
								</p>
							)}
						</>
					) : (
						<div className='text-center py-8 text-muted-foreground'>
							Не удалось загрузить товар
						</div>
					)}
				</div>

				<div className='sticky bottom-0 bg-card/80 backdrop-blur-md border-t border-border/10 p-6 space-y-4'>
					{product && (
						<div className='flex justify-center'>
							{(() => {
								const hasColors = product.colors && product.colors.length > 0
								const hasAttributes =
									product.attributes && product.attributes.length > 0
								const colorSelected = !hasColors || selectedColor
								const allAttributesSelected =
									!hasAttributes ||
									(product.attributes &&
										product.attributes.every(
											attr => selectedAttributes[attr.name]
										))
								const canAddToCart = colorSelected && allAttributesSelected

								if (!canAddToCart) return null

								if (hasInventoryTracking) {
									if (currentInventory && currentInventory.quantity > 0) {
										return (
											<div className='flex items-center gap-2 text-green-500 font-bold bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/20'>
												<Package className='w-4 h-4' />
												<span className='text-xs uppercase tracking-widest'>В наличии</span>
											</div>
										)
									} else {
										return (
											<div className='flex items-center gap-2 text-amber-500 font-bold bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20'>
												<Clock className='w-4 h-4' />
												<span className='text-xs uppercase tracking-widest'>
													Под заказ
													{currentInventory?.backorder_lead_time_days && (
														<span className='ml-1'>
															({currentInventory.backorder_lead_time_days} дн.)
														</span>
													)}
												</span>
											</div>
										)
									}
								}
								return null
							})()}
						</div>
					)}
					<Button
						className='w-full h-16 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all'
						size='lg'
						onClick={handleAddToCart}
						disabled={loading || !product}
					>
						{isInCart ? (
							<>
								<Check className='w-5 h-5 mr-3' />
								ПЕРЕЙТИ В КОРЗИНУ
							</>
						) : (
							<>
								<ShoppingCart className='w-5 h-5 mr-3' />В КОРЗИНУ
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	)
}
