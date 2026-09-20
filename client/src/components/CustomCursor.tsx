import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
	const dotRef = useRef<HTMLDivElement>(null)
	const ringRef = useRef<HTMLDivElement>(null)
	const [visible, setVisible] = useState(false)
	const [isHovering, setIsHovering] = useState(false)
	const posRef = useRef({ x: -100, y: -100 })
	const ringPosRef = useRef({ x: -100, y: -100 })
	const rafRef = useRef<number>(0)

	useEffect(() => {
		// Only on non-touch devices
		if (window.matchMedia('(pointer: coarse)').matches) return

		const onMove = (e: MouseEvent) => {
			posRef.current = { x: e.clientX, y: e.clientY }
			if (!visible) setVisible(true)
		}
		const onLeave = () => setVisible(false)
		const onEnter = () => setVisible(true)

		const onHoverStart = (e: MouseEvent) => {
			const target = e.target as HTMLElement
			if (target.closest('button, a, [role="button"], input, select')) {
				setIsHovering(true)
			}
		}
		const onHoverEnd = () => setIsHovering(false)

		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseleave', onLeave)
		document.addEventListener('mouseenter', onEnter)
		document.addEventListener('mouseover', onHoverStart)
		document.addEventListener('mouseout', onHoverEnd)

		const lerp = (a: number, b: number, t: number) => a + (b - a) * t

		const animate = () => {
			if (dotRef.current) {
				dotRef.current.style.transform = `translate(${posRef.current.x - 4}px, ${posRef.current.y - 4}px)`
			}
			if (ringRef.current) {
				ringPosRef.current.x = lerp(ringPosRef.current.x, posRef.current.x, 0.12)
				ringPosRef.current.y = lerp(ringPosRef.current.y, posRef.current.y, 0.12)
				ringRef.current.style.transform = `translate(${ringPosRef.current.x - 20}px, ${ringPosRef.current.y - 20}px) scale(${isHovering ? 1.8 : 1})`
			}
			rafRef.current = requestAnimationFrame(animate)
		}
		rafRef.current = requestAnimationFrame(animate)

		return () => {
			document.removeEventListener('mousemove', onMove)
			document.removeEventListener('mouseleave', onLeave)
			document.removeEventListener('mouseenter', onEnter)
			document.removeEventListener('mouseover', onHoverStart)
			document.removeEventListener('mouseout', onHoverEnd)
			cancelAnimationFrame(rafRef.current)
		}
	}, [isHovering])

	// Don't render on touch devices
	if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return null

	return (
		<>
			{/* Dot */}
			<div
				ref={dotRef}
				className='pointer-events-none fixed left-0 top-0 z-[99999] w-2 h-2 rounded-full bg-foreground transition-opacity duration-300'
				style={{ opacity: visible ? 1 : 0, willChange: 'transform' }}
			/>
			{/* Ring */}
			<div
				ref={ringRef}
				className='pointer-events-none fixed left-0 top-0 z-[99998] w-10 h-10 rounded-full border border-foreground/50 transition-opacity duration-300'
				style={{
					opacity: visible ? 1 : 0,
					willChange: 'transform',
					transition: 'opacity 0.3s, transform 0.08s',
				}}
			/>
		</>
	)
}
