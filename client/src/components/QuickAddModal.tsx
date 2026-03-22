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

			<div className='relative w-full max-w-md bg-background rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom duration-300'>
				<div className='sticky top-0 bg-background z-10 flex items-center justify-between p-4 border-b'>
					<h3 className='font-semibold text-lg'>Добавить в корзину</h3>
					<button
						onClick={onClose}
						className='w-8 h-8 rounded-full bg-muted flex items-center justify-center'
					>
						<X className='w-4 h-4' />
					</button>
				</div>

				<div className='overflow-y-auto p-4 space-y-4'>
					{loading ? (
						<div className='flex items-center justify-center py-8'>
							<Loader2 className='w-6 h-6 animate-spin text-primary' />
						</div>
					) : product ? (
						<>
							<div className='flex gap-4'>
								<div className='w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0'>
									{product.images && product.images[0] ? (
										<img
											src={optimizeProductThumbnail(product.images[0])}
											alt={product.name}
											className='w-full h-full object-cover'
											loading='lazy'
											decoding='async'
										/>
									) : (
										<div className='w-full h-full flex items-center justify-center text-muted-foreground'>
											Нет фото
										</div>
									)}
								</div>
								<div className='flex-1 min-w-0'>
									<h4 className='font-medium line-clamp-2'>{product.name}</h4>
									<div className='flex items-baseline gap-2 mt-1'>
										<p className='text-lg font-bold'>
											{formatPrice(product.price)}
										</p>
										{product.old_price && product.old_price > product.price && (
											<div className="flex flex-col">
												<p className='text-sm text-muted-foreground line-through opacity-60'>
													{formatPrice(product.old_price)}
												</p>
												<span className="text-[10px] text-red-500 font-bold">
													Скидка {Math.round(((product.old_price - product.price) / product.old_price) * 100)}%
												</span>
											</div>
										)}
									</div>
								</div>
							</div>

							{product.colors && product.colors.length > 0 && (
								<div className='space-y-2'>
									<label className='text-sm font-medium text-muted-foreground'>
										Цвет
									</label>
									<div className='flex flex-wrap gap-2'>
										{product.colors.map(color => (
											<button
												key={color}
												onClick={() => setSelectedColor(color)}
												className={`w-8 h-8 rounded-full border-2 transition-all ${
													selectedColor === color
														? 'border-primary ring-2 ring-primary ring-offset-2'
														: 'border-border hover:border-primary/50'
												}`}
												style={{ backgroundColor: color }}
												title={color}
											/>
										))}
									</div>
								</div>
							)}

							{product.attributes &&
								product.attributes.map(attr => (
									<div key={attr.name} className='space-y-2'>
										<label className='text-sm font-medium text-muted-foreground'>
											{attr.name}
										</label>
										<div className='flex flex-wrap gap-2'>
											{attr.values.map(value => (
												<button
													key={value}
													onClick={() =>
														handleAttributeSelect(attr.name, value)
													}
													className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
														selectedAttributes[attr.name] === value
															? 'bg-primary text-primary-foreground border-primary'
															: 'bg-background border-border hover:border-primary/50'
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

				<div className='sticky bottom-0 bg-background border-t p-4 space-y-3'>
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
											<span className='inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full'>
												<Package className='w-4 h-4' />
												<span>В наличии</span>
											</span>
										)
									} else {
										return (
											<span className='inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded-full'>
												<Clock className='w-4 h-4' />
												<span>
													Под заказ
													{currentInventory?.backorder_lead_time_days && (
														<span className='ml-1'>
															({currentInventory.backorder_lead_time_days} дн.)
														</span>
													)}
												</span>
											</span>
										)
									}
								}
								return null
							})()}
						</div>
					)}
					<Button
						className='w-full'
						size='lg'
						onClick={handleAddToCart}
						disabled={loading || !product}
					>
						{isInCart ? (
							<>
								<Check className='w-4 h-4 mr-2' />
								Перейти в корзину
							</>
						) : (
							<>
								<ShoppingCart className='w-4 h-4 mr-2' />В корзину
							</>
						)}
					</Button>
				</div>
			</div>
		</div>
	)
}
