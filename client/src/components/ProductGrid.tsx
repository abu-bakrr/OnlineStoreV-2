import { useState } from 'react'
import ProductCard from './ProductCard'
import QuickAddModal from './QuickAddModal'

interface Product {
	id: string
	name: string
	price: number
	old_price?: number
	images: string[]
	isFavorite?: boolean
}

interface AvailabilityData {
	status: 'in_stock' | 'backorder' | 'not_tracked'
	in_stock: boolean
	total_quantity: number
	backorder_lead_time_days: number | null
}

interface ProductGridProps {
	products: Product[]
	onToggleFavorite?: (id: string) => void
	onAddToCart?: (
		id: string,
		selectedColor?: string,
		selectedAttributes?: Record<string, string>
	) => void
	onProductClick?: (id: string) => void
	favoriteIds?: string[]
	cartItemIds?: string[]
	onCartClick?: () => void
	availabilityData?: Record<string, AvailabilityData>
}

export default function ProductGrid({
	products,
	onToggleFavorite,
	onAddToCart,
	onProductClick,
	favoriteIds = [],
	cartItemIds = [],
	onCartClick,
	availabilityData = {},
}: ProductGridProps) {
	const [quickAddProductId, setQuickAddProductId] = useState<string | null>(
		null
	)

	const handleAddToCart = (productId: string) => {
		if (cartItemIds.includes(productId)) {
			onCartClick?.()
		} else {
			setQuickAddProductId(productId)
		}
	}

	const handleQuickAddToCart = (
		productId: string,
		selectedColor?: string,
		selectedAttributes?: Record<string, string>
	) => {
		onAddToCart?.(productId, selectedColor, selectedAttributes)
	}

	if (products.length === 0) {
		return (
			<div
				className='flex flex-col items-center justify-center p-8 text-center'
				data-testid='empty-products'
			>
				<h3 className='text-lg font-medium text-foreground mb-2'>
					Товаров нет
				</h3>
				<p className='text-sm text-muted-foreground'>
					В данный момент нет доступных товаров
				</p>
			</div>
		)
	}

	return (
		<>
			<div
				className='grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 px-3 py-4 md:p-6 max-w-7xl mx-auto'
				data-testid='grid-products'
			>
				{products.map((product, index) => (
					<ProductCard
						key={product.id}
						{...product}
						isFavorite={(favoriteIds ?? []).includes(product.id)}
						isInCart={(cartItemIds ?? []).includes(product.id)}
						availability={availabilityData[product.id]}
						priority={index < 4}
						onToggleFavorite={onToggleFavorite}
						onAddToCart={handleAddToCart}
						onClick={onProductClick}
						onCartClick={onCartClick}
					/>
				))}
			</div>

			<QuickAddModal
				isOpen={quickAddProductId !== null}
				productId={quickAddProductId}
				onClose={() => setQuickAddProductId(null)}
				onAddToCart={handleQuickAddToCart}
				isInCart={
					quickAddProductId
						? (cartItemIds ?? []).includes(quickAddProductId)
						: false
				}
				onCartClick={onCartClick}
			/>
		</>
	)
}
