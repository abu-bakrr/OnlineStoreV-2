export default function Marquee() {
	const text = '✦ DRIP UZ ✦ NEW COLLECTION ✦ ONLY IN STOCK ✦ STREETWEAR ✦ TASHKENT ✦ DRIP UZ ✦ НОВАЯ КОЛЛЕКЦИЯ ✦ ТОЛЬКО В НАЛИЧИИ ✦'

	return (
		<div className='marquee-wrapper w-full overflow-hidden bg-foreground text-background py-1.5 select-none'>
			<div className='marquee-track flex gap-0 whitespace-nowrap'>
				{[...Array(3)].map((_, i) => (
					<span
						key={i}
						className='marquee-item inline-block text-[10px] md:text-xs font-bold tracking-[0.25em] uppercase px-4'
					>
						{text}
					</span>
				))}
			</div>
		</div>
	)
}
