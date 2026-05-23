import { contrastYiq, hexify, isGrayish, isVibrant } from "./colors"
import { selectLogoWithConfidence } from "./logo"
import type { BrandingProfile, ButtonSnapshot, InputSnapshot, RawBrandingData, StyleSnapshot } from "./types"

function inferPalette(raw: RawBrandingData) {
	const freq = new Map<string, number>()
	const bump = (color: string | null, weight = 1) => {
		if (!color) return
		freq.set(color, (freq.get(color) ?? 0) + weight)
	}

	if (raw.pageBackground) bump(hexify(raw.pageBackground), 1000)
	for (const snapshot of raw.snapshots) {
		const area = Math.max(1, snapshot.rect.w * snapshot.rect.h)
		bump(hexify(snapshot.colors.background, raw.pageBackground), 0.5 + Math.log10(area + 10))
		bump(hexify(snapshot.colors.text, raw.pageBackground), 1)
		bump(hexify(snapshot.colors.border, raw.pageBackground), 0.3)
	}
	for (const color of raw.cssData.colors) bump(hexify(color, raw.pageBackground), 0.5)

	const ranked = Array.from(freq.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([color]) => color)

	let background = "#FFFFFF"
	const pageBackground = raw.pageBackground ? hexify(raw.pageBackground) : null
	if (pageBackground && isGrayish(pageBackground)) background = pageBackground

	if (background === "#FFFFFF" || (!raw.pageBackground && ranked.length > 0)) {
		if (raw.colorScheme === "dark") {
			background =
				ranked.find((h) => isGrayish(h) && contrastYiq(h) < 128 && contrastYiq(h) > 0) ||
				ranked.find((h) => isGrayish(h) && contrastYiq(h) < 180) ||
				"#1A1A1A"
		} else {
			background = ranked.find((h) => isGrayish(h) && contrastYiq(h) > 180) || "#FFFFFF"
		}
	}

	const textPrimary =
		raw.colorScheme === "dark"
			? ranked.find((h) => h !== background && contrastYiq(h) > 180) || "#FFFFFF"
			: ranked.find((h) => h.toUpperCase() !== "#FFFFFF" && contrastYiq(h) < 160) || "#111111"
	const chromatic = ranked.filter((h) => isVibrant(h) && h !== background && h !== textPrimary)
	const primary =
		chromatic[0] ||
		ranked.find((h) => !isGrayish(h) && h !== textPrimary && h !== background) ||
		(raw.colorScheme === "dark" ? "#FFFFFF" : "#000000")
	const accent = chromatic.find((h) => h !== primary) || primary
	const secondary = chromatic.find((h) => h !== primary && h !== accent)
	const textSecondary =
		raw.colorScheme === "dark"
			? ranked.find((h) => h !== textPrimary && contrastYiq(h) > 140 && isGrayish(h))
			: ranked.find((h) => h !== textPrimary && contrastYiq(h) < 180 && isGrayish(h))

	return {
		primary,
		secondary,
		accent,
		background,
		textPrimary,
		textSecondary,
		link: accent,
	}
}

function inferBaseUnit(values: number[]): number {
	const normalized = values.filter((v) => Number.isFinite(v) && v > 0 && v <= 128).map((v) => Math.round(v))
	if (!normalized.length) return 8
	for (const candidate of [4, 6, 8, 10, 12]) {
		const share =
			normalized.filter((v) => v % candidate === 0 || Math.abs((v % candidate) - candidate) <= 1 || v % candidate <= 1)
				.length / normalized.length
		if (share >= 0.6) return candidate
	}
	normalized.sort((a, b) => a - b)
	const median = normalized[Math.floor(normalized.length / 2)] ?? 8
	return Math.max(2, Math.min(12, Math.round(median / 2) * 2))
}

function pickBorderRadius(values: Array<number | null>): string {
	const radii = values.filter((v): v is number => Number.isFinite(v))
	if (!radii.length) return "8px"
	radii.sort((a, b) => a - b)
	return `${Math.round(radii[Math.floor(radii.length / 2)] ?? 8)}px`
}

function fontsFromStacks(stacks: string[][]) {
	const ignored =
		/^(system-ui|sans-serif|serif|monospace|ui-sans-serif|ui-serif|arial|helvetica|times new roman|inherit|initial|unset)$/i
	const freq = new Map<string, number>()
	for (const stack of stacks) {
		for (const font of stack) {
			const cleaned = cleanFontName(font)
			if (!cleaned || ignored.test(cleaned) || /^var\(/i.test(cleaned)) continue
			freq.set(cleaned, (freq.get(cleaned) ?? 0) + 1)
		}
	}
	return Array.from(freq.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([family, count]) => ({ family, count }))
}

export function cleanFontName(font: string): string {
	const noQuotes = font.replace(/["']/g, "").trim()
	const next = noQuotes.match(/^__(.+?)(?:_Fallback)?_[a-f0-9]+$/i)
	if (next?.[1]) return next[1].replace(/_/g, " ").trim()
	return noQuotes
		.replace(/_Fallback_[a-f0-9]+$/i, "")
		.replace(/_/g, " ")
		.trim()
}

function representativeBorderRadius(radius?: StyleSnapshot["borderRadius"]): string {
	const max = Math.max(radius?.topLeft || 0, radius?.topRight || 0, radius?.bottomRight || 0, radius?.bottomLeft || 0)
	return max > 0 ? `${max}px` : "0px"
}

function corners(radius?: StyleSnapshot["borderRadius"]) {
	return {
		topLeft: `${radius?.topLeft ?? 0}px`,
		topRight: `${radius?.topRight ?? 0}px`,
		bottomRight: `${radius?.bottomRight ?? 0}px`,
		bottomLeft: `${radius?.bottomLeft ?? 0}px`,
	}
}

function snapshotToButton(snapshot: StyleSnapshot, index: number, raw: RawBrandingData, score: number): ButtonSnapshot {
	const borderHex =
		snapshot.colors.borderWidth && snapshot.colors.borderWidth > 0
			? hexify(snapshot.colors.border, raw.pageBackground)
			: null
	return {
		index,
		text: snapshot.text || "",
		classes: snapshot.classes || "",
		background: hexify(snapshot.colors.background, raw.pageBackground) || "transparent",
		textColor: hexify(snapshot.colors.text, raw.pageBackground) || "#000000",
		borderColor: borderHex,
		borderRadius: representativeBorderRadius(snapshot.borderRadius),
		borderRadiusCorners: corners(snapshot.borderRadius),
		shadow: snapshot.shadow,
		score,
		originalBackgroundColor: snapshot.colors.background || undefined,
		originalTextColor: snapshot.colors.text || undefined,
		originalBorderColor: snapshot.colors.border || undefined,
	}
}

function extractButtons(raw: RawBrandingData): ButtonSnapshot[] {
	const candidates = raw.snapshots
		.filter((snapshot) => {
			if (!snapshot.isButton) return false
			if (snapshot.rect.w < 30 || snapshot.rect.h < 25) return false
			if (!snapshot.text?.trim()) return false
			const bg = hexify(snapshot.colors.background, raw.pageBackground)
			const hasBorder = !!snapshot.colors.borderWidth && snapshot.colors.borderWidth > 0
			return !!bg || hasBorder
		})
		.map((snapshot) => {
			let score = 0
			if (snapshot.hasCTAIndicator) score += 1000
			const text = snapshot.text.toLowerCase()
			if (
				[
					"sign up",
					"get started",
					"start",
					"try",
					"demo",
					"contact",
					"buy",
					"subscribe",
					"join",
					"register",
					"download",
					"book",
				].some((kw) => text.includes(kw))
			) {
				score += 500
			}
			const bg = hexify(snapshot.colors.background, raw.pageBackground)
			const border =
				snapshot.colors.borderWidth && snapshot.colors.borderWidth > 0
					? hexify(snapshot.colors.border, raw.pageBackground)
					: null
			if (bg && bg !== "#FFFFFF" && bg !== "#FAFAFA" && bg !== "#F5F5F5") score += 300
			if (border && !bg) score += 200
			if (text.length > 0 && text.length < 50) score += 100
			score += Math.log10(snapshot.rect.w * snapshot.rect.h + 1) * 10
			return { snapshot, score }
		})
		.sort((a, b) => b.score - a.score)

	const seen = new Set<string>()
	const unique: ButtonSnapshot[] = []
	for (const item of candidates) {
		const bg = hexify(item.snapshot.colors.background, raw.pageBackground) || "transparent"
		const border =
			item.snapshot.colors.borderWidth && item.snapshot.colors.borderWidth > 0
				? hexify(item.snapshot.colors.border, raw.pageBackground) || "transparent-border"
				: "no-border"
		const key = `${item.snapshot.text.trim().toLowerCase().slice(0, 50)}|${bg}|${border}|${item.snapshot.classes.split(/\s+/).slice(0, 5).join(" ")}`
		if (seen.has(key)) continue
		seen.add(key)
		unique.push(snapshotToButton(item.snapshot, unique.length, raw, item.score))
	}

	return unique.slice(0, 80)
}

function classifyButtons(buttons: ButtonSnapshot[]) {
	if (!buttons.length) return { primary: undefined, secondary: undefined, confidence: 0 }
	const scored = buttons
		.map((button) => {
			let score = button.score ?? 0
			if (isVibrant(button.background)) score += 400
			if (/primary|brand|cta|accent|bg-brand|bg-primary/i.test(button.classes)) score += 250
			if (/get started|sign up|start|try|buy|book|demo|download|join/i.test(button.text)) score += 200
			if (button.background === "transparent" || button.background === "#FFFFFF") score -= 80
			return { button, score }
		})
		.sort((a, b) => b.score - a.score)
	const primary = scored[0]?.button
	const secondary = scored.find(
		(item) => item.button.index !== primary?.index && item.button.background !== primary?.background,
	)?.button
	return { primary, secondary, confidence: primary ? 0.65 : 0 }
}

function extractInputs(raw: RawBrandingData): InputSnapshot[] {
	const candidates = raw.snapshots
		.filter((snapshot) => snapshot.isInput && snapshot.inputMetadata && snapshot.rect.w >= 50 && snapshot.rect.h >= 20)
		.map((snapshot) => {
			const meta = snapshot.inputMetadata!
			let score = 0
			if (meta.type === "email") score += 100
			else if (meta.type === "text") score += 80
			else if (meta.type === "password") score += 70
			else if (meta.type === "search") score += 60
			if (meta.required) score += 50
			if (meta.placeholder) score += 30
			if (meta.label) score += 40
			const words = `${meta.placeholder} ${meta.label} ${meta.name}`.toLowerCase()
			if (words.includes("email")) score += 80
			if (words.includes("search")) score += 60
			return { snapshot, score }
		})
		.sort((a, b) => b.score - a.score)

	return candidates.slice(0, 20).map(({ snapshot }) => {
		const meta = snapshot.inputMetadata!
		const border =
			snapshot.colors.borderWidth && snapshot.colors.borderWidth > 0
				? hexify(snapshot.colors.border, raw.pageBackground)
				: null
		return {
			type: meta.type,
			placeholder: meta.placeholder,
			label: meta.label,
			name: meta.name,
			required: meta.required,
			classes: snapshot.classes,
			background: hexify(snapshot.colors.background, raw.pageBackground) || "transparent",
			textColor: hexify(snapshot.colors.text, raw.pageBackground),
			borderColor: border,
			borderRadius: representativeBorderRadius(snapshot.borderRadius),
			borderRadiusCorners: corners(snapshot.borderRadius),
			shadow: snapshot.shadow,
		}
	})
}

function pickLogo(raw: RawBrandingData, profile: BrandingProfile) {
	const heuristic = selectLogoWithConfidence(raw.logoCandidates, raw.brandName)
	if (heuristic.selectedIndex >= 0) {
		const selected = raw.logoCandidates[heuristic.selectedIndex]
		if (selected) {
			profile.logo = selected.src
			profile.images = {
				...profile.images,
				logo: selected.src,
				logoHref: selected.href ?? null,
				logoAlt: selected.alt || null,
			}
		}
	}
	profile.diagnostics = {
		...profile.diagnostics,
		logo: {
			source: heuristic.source,
			selectedIndex: heuristic.selectedIndex,
			reasoning: heuristic.reasoning,
			confidence: heuristic.confidence,
		},
	}
	profile.confidence = { ...profile.confidence, logo: heuristic.confidence }
}

export function processRawBranding(
	raw: RawBrandingData,
	options: { debug?: boolean; url?: string } = {},
): BrandingProfile {
	const palette = inferPalette(raw)
	const allFontStacks = [
		raw.typography.stacks.body,
		raw.typography.stacks.heading,
		raw.typography.stacks.paragraph,
		...raw.snapshots.map((snapshot) => snapshot.typography.fontStack),
	]
	const fonts = fontsFromStacks(allFontStacks)
	const buttons = extractButtons(raw)
	const inputs = extractInputs(raw)
	const classified = classifyButtons(buttons)
	const profile: BrandingProfile = {
		url: options.url,
		finalUrl: raw.pageUrl,
		brandName: raw.brandName,
		pageTitle: raw.pageTitle,
		colorScheme: raw.colorScheme,
		fonts,
		colors: palette,
		typography: {
			fontFamilies: {
				primary: cleanFontName(raw.typography.stacks.body[0] || fonts[0]?.family || "system-ui"),
				heading: cleanFontName(
					raw.typography.stacks.heading[0] || raw.typography.stacks.body[0] || fonts[0]?.family || "system-ui",
				),
			},
			fontStacks: raw.typography.stacks,
			fontSizes: raw.typography.sizes,
		},
		spacing: {
			baseUnit: inferBaseUnit(raw.cssData.spacings),
			borderRadius: pickBorderRadius([...raw.snapshots.map((snapshot) => snapshot.radius), ...raw.cssData.radii]),
		},
		components: {},
		images: {
			logo:
				raw.images.find((image) => image.type === "logo")?.src ||
				raw.images.find((image) => image.type === "logo-svg")?.src ||
				null,
			favicon: raw.images.find((image) => image.type === "favicon")?.src || null,
			ogImage:
				raw.images.find((image) => image.type === "og")?.src ||
				raw.images.find((image) => image.type === "twitter")?.src ||
				null,
		},
		confidence: {
			colors: 0.65,
			buttons: classified.confidence,
		},
		diagnostics: {
			errors: raw.errors,
		},
	}

	if (inputs[0]) profile.components!.input = inputs[0]
	if (classified.primary) profile.components!.buttonPrimary = classified.primary
	if (classified.secondary) profile.components!.buttonSecondary = classified.secondary

	pickLogo(raw, profile)

	profile.confidence = {
		...profile.confidence,
		overall:
			((profile.confidence?.logo ?? 0) + (profile.confidence?.colors ?? 0) + (profile.confidence?.buttons ?? 0)) / 3,
	}

	if (options.debug) {
		profile.debug = {
			buttons,
			inputs,
			logoCandidates: raw.logoCandidates,
			frameworkHints: raw.frameworkHints,
			backgroundCandidates: raw.backgroundCandidates,
		}
	}

	return profile
}
