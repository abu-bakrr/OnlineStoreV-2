import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfig } from '@/hooks/useConfig'
import {
	CheckCircle,
	Clock,
	Copy,
	CreditCard,
	Image,
	Loader2,
	MapPin,
	Upload,
	X,
	Ticket,
	Percent,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface OrderItem {
	id: string
	name: string
	quantity: number
	price: number
	selected_color?: string
	selected_attributes?: Record<string, string>
}

interface DeliveryInfo {
	address: string
	lat: number | null
	lng: number | null
	customerName: string
	customerPhone: string
}

interface DeliveryEstimate {
	has_backorder: boolean
	max_backorder_days: number
	default_delivery_days: number
}

interface CheckoutModalProps {
	isOpen: boolean
	items: OrderItem[]
	total: number
	userId?: string
	onClose: () => void
	onPaymentSelect: (
		paymentMethod: string,
		deliveryInfo: DeliveryInfo,
		receiptUrl?: string,
		promoCode?: string
	) => Promise<string | null>
}

declare global {
	interface Window {
		ymaps3: any
	}
}

export default function CheckoutModal({
	isOpen,
	items,
	total,
	userId,
	onClose,
	onPaymentSelect,
}: CheckoutModalProps) {
	const { config, formatPrice } = useConfig()
	const [step, setStep] = useState<'delivery' | 'payment' | 'card_transfer'>(
		'delivery'
	)
	const [isLoading, setIsLoading] = useState(false)
	const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
	const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
	const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
	const [orderSuccess, setOrderSuccess] = useState(false)
	const [copiedField, setCopiedField] = useState<string | null>(null)
	const [promoCodeInput, setPromoCodeInput] = useState('')
	const [appliedPromo, setAppliedPromo] = useState<any>(null)
	const [isValidatingPromo, setIsValidatingPromo] = useState(false)
	const [promoError, setPromoError] = useState<string | null>(null)
	const [deliveryEstimate, setDeliveryEstimate] =
		useState<DeliveryEstimate | null>(null)

	const fileInputRef = useRef<HTMLInputElement>(null)

	const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
		address: '',
		lat: null,
		lng: null,
		customerName: '',
		customerPhone: '',
	})

	const mapContainerRef = useRef<HTMLDivElement>(null)
	const mapInstanceRef = useRef<any>(null)
	const placemarkerRef = useRef<any>(null)
	const [mapLoaded, setMapLoaded] = useState(false)
	const [mapError, setMapError] = useState<string | null>(null)

	// Fetch delivery estimate when modal opens
	useEffect(() => {
		if (isOpen && userId) {
			fetch(`/api/cart/${userId}/delivery-info`)
				.then(res => res.json())
				.then(data => setDeliveryEstimate(data))
				.catch(err => console.error('Failed to fetch delivery info:', err))
		}
	}, [isOpen, userId])

	useEffect(() => {
		if (!isOpen) {
			setStep('delivery')
			setSelectedPayment(null)
			setReceiptUrl(null)
			setOrderSuccess(false)
			setMapError(null)
			setMapLoaded(false)
			setDeliveryEstimate(null)
			setPromoCodeInput('')
			setAppliedPromo(null)
			setPromoError(null)
			setDeliveryInfo({
				address: '',
				lat: null,
				lng: null,
				customerName: '',
				customerPhone: '',
			})
		}

		const yandexApiKey = config?.yandexMaps?.apiKey
		if (yandexApiKey) {
			const maskedKey = `${yandexApiKey.substring(0, 4)}...${yandexApiKey.substring(yandexApiKey.length - 4)}`
			console.log('CheckoutModal: useEffect triggered. API Key found:', maskedKey)
		} else {
			console.log('CheckoutModal: useEffect triggered. API Key NOT FOUND in config.')
		}
		if (!yandexApiKey) {
			setMapError('Карта недоступна. Введите адрес вручную.')
			return
		}

		if (window.ymaps3) {
			try {
				window.ymaps3.ready.then(async () => {
					await initMap()
				})
			} catch (error) {
				console.error('Yandex Maps ready error:', error)
				setMapError('Карта недоступна. Введите адрес вручную.')
			}
			return
		}

		const script = document.createElement('script')
		script.src = `https://api-maps.yandex.ru/v3/?apikey=${yandexApiKey}&lang=ru_RU`
		script.async = true

		let isTimedOut = false
		const loadTimeout = setTimeout(() => {
			isTimedOut = true
			setMapError('Превышено время загрузки карты. Введите адрес вручную.')
		}, 10000)

		script.onload = () => {
				window.ymaps3.ready.then(async () => {
					if (!isTimedOut) {
						setMapError(null)
					}
					setMapLoaded(true)
					await initMap()
				})
		}
		script.onerror = (e) => {
			console.error('CheckoutModal: Yandex Maps v3 script object LOAD ERROR:', e)
			clearTimeout(loadTimeout)
			setMapError('Не удалось загрузить карту. Введите адрес вручную.')
		}
		document.head.appendChild(script)

		return () => {
			clearTimeout(loadTimeout)
			if (mapInstanceRef.current) {
				try {
					mapInstanceRef.current.destroy()
				} catch (e) {}
				mapInstanceRef.current = null
			}
		}
	}, [isOpen, config?.yandexMaps?.apiKey])

	const initMap = async () => {
		if (!mapContainerRef.current || !window.ymaps3) return

		try {
			// Import markers and controls
			const [markersModule, controlsModule] = await Promise.all([
				window.ymaps3.import('@yandex/ymaps3-markers@0.0.1'),
				window.ymaps3.import('@yandex/ymaps3-controls@0.0.1')
			])

			const {
				YMap,
				YMapDefaultSchemeLayer,
				YMapDefaultFeaturesLayer,
				YMapListener,
				YMapControls,
			} = window.ymaps3

			const { YMapDefaultMarker } = markersModule
			const YMapDefaultGeolocationControl = 
				controlsModule.YMapDefaultGeolocationControl || 
				controlsModule.YMapGeolocationControl;

			const rawCenter = config?.yandexMaps?.defaultCenter
			const defaultCenter = rawCenter
				? [rawCenter[1], rawCenter[0]] // [lat, lng] -> [lng, lat]
				: [69.240562, 41.311081]
			const defaultZoom = config?.yandexMaps?.defaultZoom || 12

			console.log('Initializing Yandex Maps v3 with center:', defaultCenter)

			if (mapInstanceRef.current) {
				mapInstanceRef.current.destroy()
			}

			if (typeof YMap !== 'function') {
				throw new Error('YMap is not a constructor/function. Check API version.')
			}

			const map = new YMap(mapContainerRef.current, {
				location: {
					center: defaultCenter,
					zoom: defaultZoom,
				},
				behaviors: ['drag', 'scrollZoom', 'dblClick', 'pinchZoom'],
			})

			if (YMapDefaultSchemeLayer) {
				map.addChild(new YMapDefaultSchemeLayer({}))
			}
			if (YMapDefaultFeaturesLayer) {
				map.addChild(new YMapDefaultFeaturesLayer({}))
			}

			if (YMapControls && YMapDefaultGeolocationControl) {
				console.log('Adding GeolocationControl to map')
				const controls = new YMapControls({ position: 'top right' })
				try {
					controls.addChild(new YMapDefaultGeolocationControl({}))
					map.addChild(controls)
				} catch (e) {
					console.error('Error adding geolocation control:', e)
				}
			} else {
				console.warn('YMapControls or YMapDefaultGeolocationControl not available for standard UI')
			}

			if (YMapDefaultMarker) {
				const marker = new YMapDefaultMarker({
					coordinates: defaultCenter,
					draggable: true,
					mapFollowsOnDrag: true,
					onDragMove: (coords: [number, number]) => {
						// We might want to throttle this or only do on drag end
					},
					onDragEnd: async (coords: [number, number]) => {
						await geocodeCoords(coords)
					},
				})

				map.addChild(marker)
				placemarkerRef.current = marker
			}

			mapInstanceRef.current = map

			if (YMapListener) {
				const listener = new YMapListener({
					onClick: async (object: any, event: any) => {
						const coords = event.coords
						if (placemarkerRef.current) {
							placemarkerRef.current.update({ coordinates: coords })
						}
						await geocodeCoords(coords)
					},
				})
				map.addChild(listener)
			}

			// Add suggest view (requires address input to be in DOM)
			setTimeout(async () => {
				try {
					// Try both package names for suggest
					let suggestModule;
					try {
						suggestModule = await window.ymaps3.import('@yandex/ymaps3-suggest-view@0.0.1')
					} catch (e) {
						suggestModule = await window.ymaps3.import('@yandex/ymaps3-suggest@0.0.1')
					}
					
					const { YMapSuggestView } = suggestModule
					const suggest = new YMapSuggestView({
						parentElement: document.getElementById('address') as HTMLDivElement,
						onSelect: async (item: any) => {
							setDeliveryInfo((prev: DeliveryInfo) => ({ ...prev, address: item.title }))
							await handleAddressSearch(item.title)
						},
					})
				} catch (e) {
					console.error('Suggest view error:', e)
				}
			}, 1000)

			setMapError(null)
			setMapLoaded(true)
		} catch (error) {
			console.error('Map initialization error:', error)
			setMapError('Ошибка инициализации карты. Введите адрес вручную.')
		}
	}

	const geocodeCoords = async (coords: [number, number]) => {
		if (!coords || !Array.isArray(coords) || coords.length < 2) return;
		
		try {
			console.log('Geocoding coords:', coords)
			
			// Always update coordinates even if geocoding fails
			setDeliveryInfo((prev: DeliveryInfo) => ({
				...prev,
				lat: coords[1],
				lng: coords[0],
			}))

			const response = await fetch(
				`https://geocode-maps.yandex.ru/1.x/?apikey=${config?.yandexMaps?.apiKey}&geocode=${coords[0]},${coords[1]}&format=json&lang=ru_RU`
			)
			const data = await response.json()
			
			const featureMember = data?.response?.GeoObjectCollection?.featureMember
			if (featureMember && featureMember.length > 0) {
				const address = featureMember[0].GeoObject.metaDataProperty.GeocoderMetaData.text
				console.log('Geocoding success:', address)
				if (address) {
					setDeliveryInfo((prev: DeliveryInfo) => ({
						...prev,
						address,
					}))
				}
			} else {
				console.warn('Geocoding: no address found', data)
			}
		} catch (error) {
			console.error('Geocoding error:', error)
		}
	}

	const handleAddressSearch = async (query?: string) => {
		const addressToSearch = query || deliveryInfo.address
		if (!addressToSearch || !window.ymaps3) return

		try {
			const response = await fetch(
				`https://geocode-maps.yandex.ru/1.x/?apikey=${config?.yandexMaps?.apiKey}&geocode=${encodeURIComponent(
					addressToSearch
				)}&format=json&lang=ru_RU`
			)
			const data = await response.json()
			const geoObject =
				data.response.GeoObjectCollection.featureMember[0].GeoObject
			const coordsStr = geoObject.Point.pos.split(' ')
			const coords: [number, number] = [Number(coordsStr[0]), Number(coordsStr[1])]
			const fullAddress =
				geoObject.metaDataProperty.GeocoderMetaData.text

			if (placemarkerRef.current) {
				placemarkerRef.current.update({ coordinates: coords })
			}

			if (mapInstanceRef.current) {
				mapInstanceRef.current.update({
					location: { center: coords, zoom: 16, duration: 800 },
				})
			}

			setDeliveryInfo((prev: DeliveryInfo) => ({
				...prev,
				address: fullAddress,
				lat: coords[1],
				lng: coords[0],
			}))
		} catch (error) {
			console.error('Address search error:', error)
		}
	}

	const handleContinueToPayment = () => {
		if (
			!deliveryInfo.address ||
			!deliveryInfo.customerName ||
			!deliveryInfo.customerPhone
		) {
			return
		}
		setStep('payment')
	}

	const handlePayment = async (method: string) => {
		setIsLoading(true)
		setSelectedPayment(method)

		try {
			const paymentUrl = await onPaymentSelect(
				method,
				deliveryInfo,
				undefined,
				appliedPromo?.code
			)

			if (paymentUrl) {
				window.location.href = paymentUrl
			}
		} catch (error) {
			console.error('Payment error:', error)
			setIsLoading(false)
			setSelectedPayment(null)
		}
	}

	const handleLocateMe = () => {
		if (!navigator.geolocation) {
			alert('Геолокация не поддерживается вашим браузером')
			return
		}

		navigator.geolocation.getCurrentPosition(
			async position => {
				const coords: [number, number] = [
					position.coords.longitude,
					position.coords.latitude,
				]

				if (placemarkerRef.current) {
					placemarkerRef.current.update({ coordinates: coords })
				}

				if (mapInstanceRef.current) {
					mapInstanceRef.current.update({
						location: { center: coords, zoom: 16, duration: 800 },
					})
				}

				await geocodeCoords(coords)
			},
			error => {
				console.error('Geolocation error:', error)
				alert('Не удалось определить ваше местоположение')
			}
		)
	}

	const handleValidatePromo = async () => {
		if (!promoCodeInput) return
		setIsValidatingPromo(true)
		setPromoError(null)
		try {
			const response = await fetch('/api/promo/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code: promoCodeInput,
					order_total: total,
				}),
			})
			const data = await response.json()
			if (response.ok) {
				setAppliedPromo(data)
			} else {
				setPromoError(data.error || 'Ошибка проверки промокода')
			}
		} catch (error) {
			setPromoError('Ошибка сети')
		} finally {
			setIsValidatingPromo(false)
		}
	}

	const handleFileUpload = async (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0]
		if (!file) return

		setIsUploadingReceipt(true)

		try {
			const formData = new FormData()
			formData.append('file', file)

			const response = await fetch('/api/upload/receipt', {
				method: 'POST',
				body: formData,
			})

			const data = await response.json()

			if (!response.ok) {
				throw new Error(data.error || 'Upload failed')
			}

			setReceiptUrl(data.secure_url)
		} catch (error: any) {
			console.error('Error uploading receipt:', error)
			alert(error.message || 'Ошибка загрузки чека. Попробуйте еще раз.')
		} finally {
			setIsUploadingReceipt(false)
		}
	}

	const handleCardTransferSubmit = async () => {
		if (!receiptUrl) {
			alert('Пожалуйста, загрузите фото чека оплаты')
			return
		}

		setIsLoading(true)
		setSelectedPayment('card_transfer')

		try {
			await onPaymentSelect(
				'card_transfer',
				deliveryInfo,
				receiptUrl,
				appliedPromo?.code
			)
			setOrderSuccess(true)
		} catch (error) {
			console.error('Order error:', error)
			alert('Ошибка при создании заказа')
		} finally {
			setIsLoading(false)
		}
	}

	const copyToClipboard = (text: string, field: string) => {
		navigator.clipboard.writeText(text)
		setCopiedField(field)
		setTimeout(() => setCopiedField(null), 2000)
	}

	if (!isOpen) return null

	const isDeliveryValid =
		deliveryInfo.address &&
		deliveryInfo.customerName &&
		deliveryInfo.customerPhone

	const clickConfig = config?.payment?.click
	const paymeConfig = config?.payment?.payme
	const uzumConfig = config?.payment?.uzum
	const cardTransferConfig = config?.payment?.cardTransfer

	const isClickAvailable =
		clickConfig?.enabled !== false &&
		clickConfig?.merchantId &&
		clickConfig?.serviceId
	const isPaymeAvailable =
		paymeConfig?.enabled !== false && paymeConfig?.merchantId
	const isUzumAvailable =
		uzumConfig?.enabled !== false && uzumConfig?.merchantId
	const isCardTransferAvailable =
		cardTransferConfig?.enabled !== false && cardTransferConfig?.cardNumber

	const hasAnyPaymentMethod =
		isClickAvailable ||
		isPaymeAvailable ||
		isUzumAvailable ||
		isCardTransferAvailable

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
			<div className='bg-background rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl'>
				<div className='sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between'>
					<h2 className='text-lg font-semibold'>
						{step === 'delivery'
							? 'Адрес доставки'
							: step === 'payment'
							? 'Способ оплаты'
							: 'Оплата переводом'}
					</h2>
					<Button variant='ghost' size='icon' onClick={onClose}>
						<X className='w-5 h-5' />
					</Button>
				</div>

				<div className='p-4'>
					{step === 'delivery' ? (
						<div className='space-y-4'>
							<div className='bg-muted rounded-lg p-3 mb-4'>
								<div className='text-sm text-muted-foreground mb-1'>
									Сумма заказа:
								</div>
								<div className='text-xl font-bold text-primary'>
									{appliedPromo ? (
										<div className='flex flex-col'>
											<span className='line-through text-sm text-muted-foreground opacity-50'>
												{formatPrice(total)}
											</span>
											<span>{formatPrice(appliedPromo.new_total)}</span>
										</div>
									) : (
										formatPrice(total)
									)}
								</div>
								{appliedPromo && (
									<div className='text-xs text-green-600 font-medium mt-1 flex items-center gap-1'>
										<Percent className='h-3 w-3' /> Экономия:{' '}
										{formatPrice(appliedPromo.discount_amount)}
									</div>
								)}
								<div className='text-xs text-muted-foreground mt-1'>
									{config?.delivery?.freeDeliveryNote ||
										'Доставка оплачивается при получении'}
								</div>

								{deliveryEstimate && (
									<div className='mt-3 pt-3 border-t border-border'>
										<div className='flex items-center gap-2'>
											<Clock className='w-4 h-4 text-muted-foreground' />
											<span className='text-sm'>
												{deliveryEstimate.has_backorder ? (
													<span className='text-amber-600'>
														<strong>Под заказ:</strong> ~
														{deliveryEstimate.max_backorder_days} дн.
													</span>
												) : (
													<span className='text-green-600'>
														<strong>В наличии:</strong> ~
														{deliveryEstimate.default_delivery_days} дн.
													</span>
												)}
											</span>
										</div>
									</div>
								)}
							</div>

							<div className='space-y-3'>
								<div>
									<Label htmlFor='customerName'>Ваше имя *</Label>
									<Input
										id='customerName'
										placeholder='Введите ваше имя'
										value={deliveryInfo.customerName}
										onChange={e =>
											setDeliveryInfo(prev => ({
												...prev,
												customerName: e.target.value,
											}))
										}
									/>
								</div>

								<div>
									<Label htmlFor='customerPhone'>Телефон *</Label>
									<Input
										id='customerPhone'
										placeholder='+998 90 123 45 67'
										value={deliveryInfo.customerPhone}
										onChange={e =>
											setDeliveryInfo(prev => ({
												...prev,
												customerPhone: e.target.value,
											}))
										}
									/>
								</div>

								<div className='pt-2'>
									<Label htmlFor='promoCode'>У вас есть промокод?</Label>
									<div className='flex gap-2 mt-1'>
										<Input
											id='promoCode'
											placeholder='Введите код'
											value={promoCodeInput}
											onChange={e =>
												setPromoCodeInput(e.target.value.toUpperCase())
											}
											disabled={!!appliedPromo || isValidatingPromo}
										/>
										{appliedPromo ? (
											<Button
												variant='outline'
												onClick={() => {
													setAppliedPromo(null)
													setPromoCodeInput('')
												}}
											>
												Отмена
											</Button>
										) : (
											<Button
												variant='outline'
												onClick={handleValidatePromo}
												disabled={!promoCodeInput || isValidatingPromo}
											>
												{isValidatingPromo ? (
													<Loader2 className='h-4 w-4 animate-spin' />
												) : (
													'Применить'
												)}
											</Button>
										)}
									</div>
									{promoError && (
										<p className='text-xs text-destructive mt-1'>
											{promoError}
										</p>
									)}
									{appliedPromo && (
										<p className='text-xs text-green-600 mt-1 font-medium'>
											Промокод {appliedPromo.code} применен!
										</p>
									)}
								</div>

								<div>
									<Label htmlFor='address'>Адрес доставки *</Label>
									<div className='flex gap-2'>
										<Input
											id='address'
											placeholder='Введите адрес'
											value={deliveryInfo.address}
											onChange={e =>
												setDeliveryInfo(prev => ({
													...prev,
													address: e.target.value,
												}))
											}
											onKeyDown={e =>
												e.key === 'Enter' && handleAddressSearch()
											}
										/>
										<Button variant='outline' onClick={handleAddressSearch}>
											<MapPin className='w-4 h-4' />
										</Button>
									</div>
								</div>

								<div className='relative rounded-xl overflow-hidden border-2 border-primary/20 shadow-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-slate-900/50 dark:to-slate-800/50'>
									<div className='absolute top-3 left-3 z-10 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-border'>
										<div className='flex items-center gap-2 text-sm font-medium'>
											<MapPin className='w-4 h-4 text-primary' />
											<span>Укажите точку доставки</span>
										</div>
									</div>

									{mapError ? (
										<div className='h-[200px] flex flex-col items-center justify-center bg-muted/50 text-muted-foreground px-4'>
											<MapPin className='w-10 h-10 mb-3 opacity-40' />
											<p className='text-sm font-medium text-center'>
												{mapError}
											</p>
											<p className='text-xs mt-2 text-center opacity-70'>
												Вы можете указать адрес в поле выше
											</p>
										</div>
									) : (
										<div className='relative'>
											<div
												ref={mapContainerRef}
												className='h-[300px] w-full'
												style={{ minHeight: '300px' }}
											/>
											{!mapLoaded && (
												<div className='absolute inset-0 h-[300px] flex flex-col items-center justify-center bg-muted/80 z-20'>
													<Loader2 className='w-8 h-8 animate-spin text-primary mb-3' />
													<p className='text-sm text-muted-foreground'>
														Загрузка карты...
													</p>
												</div>
											)}
											{mapLoaded && (
												<Button
													variant='secondary'
													size='icon'
													className='absolute bottom-16 right-3 z-10 shadow-md bg-background/90 hover:bg-background'
													onClick={handleLocateMe}
													type='button'
												>
													<MapPin className='w-5 h-5 text-primary' />
												</Button>
											)}
										</div>
									)}

									<div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-3 pointer-events-none'>
										<p className='text-xs text-muted-foreground text-center'>
											Нажмите на карту или перетащите маркер для выбора адреса
										</p>
									</div>
								</div>

								{deliveryInfo.lat && deliveryInfo.lng && (
									<div className='flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800'>
										<div className='flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center'>
											<MapPin className='w-4 h-4 text-white' />
										</div>
										<div className='flex-1 min-w-0'>
											<p className='text-sm font-medium text-green-800 dark:text-green-200 truncate'>
												Адрес выбран
											</p>
											<p className='text-xs text-green-600 dark:text-green-400'>
												{deliveryInfo.lat.toFixed(6)},{' '}
												{deliveryInfo.lng.toFixed(6)}
											</p>
										</div>
									</div>
								)}
							</div>

							<Button
								onClick={handleContinueToPayment}
								className='w-full mt-4'
								disabled={!isDeliveryValid}
							>
								Перейти к оплате
							</Button>
						</div>
					) : step === 'payment' ? (
						<div className='space-y-4'>
							<div className='bg-muted rounded-lg p-3 mb-4'>
								<div className='flex justify-between items-center mb-2'>
									<span className='text-sm text-muted-foreground'>
										К оплате:
									</span>
									<span className='text-xl font-bold text-primary'>
										{formatPrice(appliedPromo ? appliedPromo.new_total : total)}
									</span>
								</div>
								<div className='text-xs text-muted-foreground'>
									Доставка: {deliveryInfo.address}
								</div>
							</div>

							<div className='space-y-2 mb-4'>
								<div className='text-sm font-medium mb-2'>Ваш заказ:</div>
								{items.map((item, index) => (
									<div
										key={index}
										className='text-sm text-muted-foreground flex justify-between'
									>
										<span>
											{item.name} × {item.quantity}
										</span>
										<span>{formatPrice(item.price * item.quantity)}</span>
									</div>
								))}
							</div>

							{!hasAnyPaymentMethod ? (
								<div className='text-center py-8 text-muted-foreground'>
									<CreditCard className='w-12 h-12 mx-auto mb-3 opacity-50' />
									<p>Способы оплаты не настроены</p>
									<p className='text-sm'>Свяжитесь с администратором</p>
								</div>
							) : (
								<div className='space-y-3'>
									<div className='text-sm font-medium'>
										Выберите способ оплаты:
									</div>

									{isClickAvailable && (
										<Button
											variant='outline'
											className='w-full h-14 justify-start gap-3 hover:border-primary'
											onClick={() => handlePayment('click')}
											disabled={isLoading}
										>
											{isLoading && selectedPayment === 'click' ? (
												<Loader2 className='w-5 h-5 animate-spin' />
											) : (
												<div className='w-10 h-10 rounded-lg bg-[#00AEEF] flex items-center justify-center'>
													<span className='text-white font-bold text-xs'>
														CLICK
													</span>
												</div>
											)}
											<div className='text-left'>
												<div className='font-medium'>Click</div>
												<div className='text-xs text-muted-foreground'>
													Оплата через Click
												</div>
											</div>
										</Button>
									)}

									{isPaymeAvailable && (
										<Button
											variant='outline'
											className='w-full h-14 justify-start gap-3 hover:border-primary'
											onClick={() => handlePayment('payme')}
											disabled={isLoading}
										>
											{isLoading && selectedPayment === 'payme' ? (
												<Loader2 className='w-5 h-5 animate-spin' />
											) : (
												<div className='w-10 h-10 rounded-lg bg-[#00CDBE] flex items-center justify-center'>
													<span className='text-white font-bold text-xs'>
														Payme
													</span>
												</div>
											)}
											<div className='text-left'>
												<div className='font-medium'>Payme</div>
												<div className='text-xs text-muted-foreground'>
													Оплата через Payme
												</div>
											</div>
										</Button>
									)}

									{isUzumAvailable && (
										<Button
											variant='outline'
											className='w-full h-14 justify-start gap-3 hover:border-primary'
											onClick={() => handlePayment('uzum')}
											disabled={isLoading}
										>
											{isLoading && selectedPayment === 'uzum' ? (
												<Loader2 className='w-5 h-5 animate-spin' />
											) : (
												<div className='w-10 h-10 rounded-lg bg-[#7B68EE] flex items-center justify-center'>
													<span className='text-white font-bold text-xs'>
														Uzum
													</span>
												</div>
											)}
											<div className='text-left'>
												<div className='font-medium'>Uzum Bank</div>
												<div className='text-xs text-muted-foreground'>
													Оплата через Uzum
												</div>
											</div>
										</Button>
									)}

									{isCardTransferAvailable && (
										<Button
											variant='outline'
											className='w-full h-14 justify-start gap-3 hover:border-primary'
											onClick={() => handlePayment('card_transfer')}
											disabled={isLoading}
										>
											<div className='w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center'>
												<CreditCard className='w-5 h-5 text-white' />
											</div>
											<div className='text-left'>
												<div className='font-medium'>Перевод на карту</div>
												<div className='text-xs text-muted-foreground'>
													Оплата переводом
												</div>
											</div>
										</Button>
									)}
								</div>
							)}

							<Button
								variant='ghost'
								onClick={() => setStep('delivery')}
								className='w-full mt-2'
							>
								← Вернуться к адресу
							</Button>
						</div>
					) : (
						<div className='space-y-4'>
							{orderSuccess ? (
								<div className='text-center py-8'>
									<div className='relative inline-block mb-4'>
										<div className='absolute inset-0 bg-green-500/20 rounded-full animate-ping'></div>
										<CheckCircle className='w-16 h-16 text-green-500 relative' />
									</div>
									<h3 className='text-xl font-bold mb-2'>Заказ принят!</h3>
									<p className='text-muted-foreground mb-2'>
										Ваш заказ успешно оформлен и находится на рассмотрении.
									</p>
									<p className='text-sm text-muted-foreground mb-4'>
										Вы можете отслеживать статус заказа в разделе "Мои заказы" в
										профиле.
									</p>
									<Button onClick={onClose} className='w-full'>
										Закрыть
									</Button>
								</div>
							) : (
								<>
									<div className='bg-muted rounded-lg p-4'>
										<div className='text-center mb-3'>
											<div className='text-sm text-muted-foreground'>
												К оплате:
											</div>
											<div className='text-2xl font-bold text-primary'>
												{formatPrice(
													appliedPromo ? appliedPromo.new_total : total
												)}
											</div>
										</div>
									</div>

									<div className='bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg p-4 border border-green-200 dark:border-green-800'>
										<h3 className='font-semibold mb-3 flex items-center gap-2'>
											<CreditCard className='w-5 h-5 text-green-600' />
											Реквизиты для перевода
										</h3>

										<div className='space-y-3'>
											<div className='flex items-center justify-between bg-white dark:bg-background rounded-lg p-3'>
												<div>
													<div className='text-xs text-muted-foreground'>
														Номер карты
													</div>
													<div className='font-mono font-bold text-lg'>
														{cardTransferConfig?.cardNumber
															?.replace(/(\d{4})/g, '$1 ')
															.trim()}
													</div>
												</div>
												<Button
													variant='ghost'
													size='sm'
													onClick={() =>
														copyToClipboard(
															cardTransferConfig?.cardNumber || '',
															'card'
														)
													}
												>
													{copiedField === 'card' ? (
														<CheckCircle className='w-4 h-4 text-green-500' />
													) : (
														<Copy className='w-4 h-4' />
													)}
												</Button>
											</div>

											{cardTransferConfig?.cardHolder && (
												<div className='bg-white dark:bg-background rounded-lg p-3'>
													<div className='text-xs text-muted-foreground'>
														Получатель
													</div>
													<div className='font-medium'>
														{cardTransferConfig.cardHolder}
													</div>
												</div>
											)}

											{cardTransferConfig?.bankName && (
												<div className='bg-white dark:bg-background rounded-lg p-3'>
													<div className='text-xs text-muted-foreground'>
														Банк
													</div>
													<div className='font-medium'>
														{cardTransferConfig.bankName}
													</div>
												</div>
											)}
										</div>
									</div>

									<div className='space-y-3'>
										<Label className='flex items-center gap-2'>
											<Image className='w-4 h-4' />
											Загрузите фото чека оплаты *
										</Label>

										<input
											ref={fileInputRef}
											type='file'
											accept='image/*'
											onChange={handleFileUpload}
											className='hidden'
										/>

										{receiptUrl ? (
											<div className='relative'>
												<img
													src={receiptUrl}
													alt='Чек оплаты'
													className='w-full h-48 object-cover rounded-lg border'
												/>
												<div className='absolute top-2 right-2 left-2 flex items-center justify-between'>
													<div className='bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1 shadow-md'>
														<CheckCircle className='w-3 h-3' />
														Загружено
													</div>
													<Button
														variant='secondary'
														size='sm'
														className='shadow-md'
														onClick={() => {
															setReceiptUrl(null)
															if (fileInputRef.current) {
																fileInputRef.current.value = ''
															}
														}}
													>
														<X className='w-4 h-4 mr-1' />
														Убрать
													</Button>
												</div>
											</div>
										) : (
											<Button
												variant='outline'
												className='w-full h-32 border-dashed flex flex-col gap-2'
												onClick={() => fileInputRef.current?.click()}
												disabled={isUploadingReceipt}
											>
												{isUploadingReceipt ? (
													<>
														<Loader2 className='w-8 h-8 animate-spin' />
														<span>Загрузка...</span>
													</>
												) : (
													<>
														<Upload className='w-8 h-8' />
														<span>Нажмите чтобы загрузить фото чека</span>
													</>
												)}
											</Button>
										)}
									</div>

									<Button
										onClick={handleCardTransferSubmit}
										className='w-full'
										disabled={!receiptUrl || isLoading}
									>
										{isLoading ? (
											<>
												<Loader2 className='w-4 h-4 mr-2 animate-spin' />
												Оформление...
											</>
										) : (
											'Подтвердить оплату'
										)}
									</Button>

									<Button
										variant='ghost'
										onClick={() => setStep('payment')}
										className='w-full'
										disabled={isLoading}
									>
										← Выбрать другой способ оплаты
									</Button>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
