import { parse, rgb } from "culori"

export function hexify(colorValue: string | null | undefined, background?: string | null): string | null {
	if (!colorValue || typeof colorValue !== "string") return null

	try {
		const color = parse(colorValue)
		if (!color) return null

		const rgbColor = rgb(color)
		if (!rgbColor || rgbColor.mode !== "rgb") return null

		let r = Math.round((rgbColor.r ?? 0) * 255)
		let g = Math.round((rgbColor.g ?? 0) * 255)
		let b = Math.round((rgbColor.b ?? 0) * 255)
		const alpha = rgbColor.alpha ?? 1

		if (alpha < 0.01) return null

		if (alpha < 1) {
			let bgR = 255
			let bgG = 255
			let bgB = 255

			if (background) {
				const bgColor = parse(background)
				const bgRgb = bgColor ? rgb(bgColor) : null
				if (bgRgb && bgRgb.mode === "rgb" && (bgRgb.alpha ?? 1) >= 0.01) {
					bgR = Math.round((bgRgb.r ?? 1) * 255)
					bgG = Math.round((bgRgb.g ?? 1) * 255)
					bgB = Math.round((bgRgb.b ?? 1) * 255)
				}
			}

			r = Math.round(alpha * r + (1 - alpha) * bgR)
			g = Math.round(alpha * g + (1 - alpha) * bgG)
			b = Math.round(alpha * b + (1 - alpha) * bgB)
		}

		r = Math.max(0, Math.min(255, r))
		g = Math.max(0, Math.min(255, g))
		b = Math.max(0, Math.min(255, b))

		return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
			.toString(16)
			.padStart(2, "0")}`.toUpperCase()
	} catch {
		return null
	}
}

export function contrastYiq(hex: string): number {
	const h = hex.replace("#", "")
	if (h.length < 6) return 0
	const r = Number.parseInt(h.slice(0, 2), 16)
	const g = Number.parseInt(h.slice(2, 4), 16)
	const b = Number.parseInt(h.slice(4, 6), 16)
	return (r * 299 + g * 587 + b * 114) / 1000
}

export function isGrayish(hex: string): boolean {
	const h = hex.replace("#", "")
	if (h.length < 6) return true
	const r = Number.parseInt(h.slice(0, 2), 16)
	const g = Number.parseInt(h.slice(2, 4), 16)
	const b = Number.parseInt(h.slice(4, 6), 16)
	return Math.max(r, g, b) - Math.min(r, g, b) < 15
}

export function isVibrant(hex: string | null | undefined): boolean {
	if (!hex) return false
	const h = hex.replace("#", "")
	if (h.length < 6) return false
	const r = Number.parseInt(h.slice(0, 2), 16)
	const g = Number.parseInt(h.slice(2, 4), 16)
	const b = Number.parseInt(h.slice(4, 6), 16)
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const saturation = max === 0 ? 0 : (max - min) / max
	const brightness = max / 255
	return saturation > 0.38 && max - min > 40 && brightness > 0.2
}
