import { useEffect, useRef } from 'react'

export default function FilmGrain() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const rafRef = useRef<number>(0)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const resize = () => {
			canvas.width = window.innerWidth
			canvas.height = window.innerHeight
		}
		resize()
		window.addEventListener('resize', resize)

		const draw = () => {
			const imageData = ctx.createImageData(canvas.width, canvas.height)
			const data = imageData.data
			for (let i = 0; i < data.length; i += 4) {
				const noise = Math.random() * 255
				data[i] = noise
				data[i + 1] = noise
				data[i + 2] = noise
				data[i + 3] = Math.random() * 60 // visible opacity
			}
			ctx.putImageData(imageData, 0, 0)
			rafRef.current = requestAnimationFrame(draw)
		}
		rafRef.current = requestAnimationFrame(draw)

		return () => {
			cancelAnimationFrame(rafRef.current)
			window.removeEventListener('resize', resize)
		}
	}, [])

	return (
		<canvas
			ref={canvasRef}
			className='pointer-events-none fixed inset-0 z-[99990] opacity-[0.08]'
			style={{ mixBlendMode: 'screen' }}
			aria-hidden='true'
		/>
	)
}
