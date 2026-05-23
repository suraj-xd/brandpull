import type { LogoCandidate } from "./types"

export interface LogoSelection {
	selectedIndex: number
	confidence: number
	source: "heuristic" | "fallback" | "none"
	reasoning: string
}

const confidence = {
	strongScore: 60,
	goodScore: 45,
	moderateScore: 30,
	strongSeparation: 20,
	goodSeparation: 15,
}

export function logoArea(position: LogoCandidate["position"]): number {
	return Math.max(0, position.width || 0) * Math.max(0, position.height || 0)
}

function filename(src: string): string {
	return src.split("?")[0]?.split("#")[0]?.split("/").pop() ?? src
}

function detectVariants(candidates: LogoCandidate[]) {
	const groups = new Map<number, number[]>()
	const processed = new Set<number>()

	for (const [index, candidate] of candidates.entries()) {
		if (processed.has(index)) continue
		const similar = [index]
		processed.add(index)

		for (const [otherIndex, other] of candidates.entries()) {
			if (index === otherIndex || processed.has(otherIndex)) continue
			const sameAlt =
				candidate.alt &&
				other.alt &&
				candidate.alt.toLowerCase().replace(/\s+/g, "") === other.alt.toLowerCase().replace(/\s+/g, "")
			const sameFile = filename(candidate.src) && filename(candidate.src) === filename(other.src)
			const samePosition =
				Math.abs(candidate.position.top - other.position.top) < 20 &&
				Math.abs(candidate.position.left - other.position.left) < 50 &&
				Math.abs(candidate.position.width - other.position.width) < 30

			if (candidate.src === other.src || sameAlt || sameFile || samePosition) {
				similar.push(otherIndex)
				processed.add(otherIndex)
			}
		}

		groups.set(index, similar)
	}

	return groups
}

function pickBestVariant(candidates: LogoCandidate[], indices: number[]): number {
	return indices.reduce((best, current) => {
		const b = candidates[best]!
		const c = candidates[current]!
		if (c.isVisible && !b.isVisible) return current
		if (!c.isVisible && b.isVisible) return best
		if (c.indicators.inHeader && !b.indicators.inHeader) return current
		if (!c.indicators.inHeader && b.indicators.inHeader) return best
		if (c.position.top < b.position.top) return current
		if (c.position.top > b.position.top) return best
		if (c.indicators.hrefMatch && !b.indicators.hrefMatch) return current
		return best
	})
}

function repeatedLogos(candidates: LogoCandidate[]) {
	const repeated = new Set<number>()
	const groups = new Map<string, number[]>()
	for (const [index, candidate] of candidates.entries()) {
		const key = filename(candidate.src).toLowerCase() || candidate.src
		groups.set(key, [...(groups.get(key) ?? []), index])
	}
	for (const indices of groups.values()) {
		const locations = new Set(indices.map((i) => candidates[i]!.location))
		if (indices.length > 1 && locations.size > 1) {
			for (const index of indices) repeated.add(index)
		}
	}
	return repeated
}

function hrefHeaderScore(candidate: LogoCandidate) {
	let score = 0
	const reasons: string[] = []
	if (candidate.indicators.hrefMatch && candidate.indicators.inHeader) {
		score += 50
		reasons.push("header logo linking to homepage")
	} else if (candidate.indicators.hrefMatch) {
		score += 35
		reasons.push("links to homepage")
	} else if (candidate.indicators.inHeader) {
		score += 25
		reasons.push("in header")
	}
	if (!candidate.href?.trim()) {
		score -= 15
		reasons.push("no homepage link")
	}
	return { score, reasons }
}

export function selectLogoWithConfidence(candidates: LogoCandidate[], brandName?: string): LogoSelection {
	if (!candidates.length) {
		return { selectedIndex: -1, confidence: 0, source: "none", reasoning: "No logo candidates found" }
	}

	const variants = detectVariants(candidates)
	const repeated = repeatedLogos(candidates)
	const indicesToScore = new Set<number>()
	const variantBonus = new Map<number, number>()

	for (const group of variants.values()) {
		const best = pickBestVariant(candidates, group)
		indicesToScore.add(best)
		if (group.some((i) => repeated.has(i))) variantBonus.set(best, 15)
		if (group.length > 1) variantBonus.set(best, (variantBonus.get(best) ?? 0) + 8)
	}

	const scored = candidates
		.map((candidate, index) => {
			if (!indicesToScore.has(index)) return { index, score: -999, reasons: ["duplicate variant"] }
			let score = variantBonus.get(index) ?? 0
			const reasons: string[] = score > 0 ? [`variant bonus ${score}`] : []

			const href = hrefHeaderScore(candidate)
			score += href.score
			reasons.push(...href.reasons)

			if (candidate.location === "header") {
				score += 20
				reasons.push("header location")
			}
			if (candidate.isVisible) {
				score += 15
				reasons.push("visible")
			} else {
				score -= 25
				reasons.push("hidden")
			}
			if (candidate.position.top < 100 && candidate.position.left < 300) {
				score += 10
				reasons.push("top-left")
			}
			if (
				candidates.every((other, otherIndex) => otherIndex === index || candidate.position.top <= other.position.top)
			) {
				score += 12
				reasons.push("highest candidate")
			}
			if (candidate.indicators.altMatch) score += 8
			if (candidate.indicators.srcMatch) score += 5
			if (candidate.indicators.classMatch) score += 5

			if (brandName) {
				const alt = candidate.alt.toLowerCase().trim()
				const brand = brandName.toLowerCase().trim()
				if (alt === brand) {
					score += 20
					reasons.push("alt exactly matches brand")
				} else if (alt && (alt.includes(brand) || brand.includes(alt))) {
					score += 12
					reasons.push("alt matches brand")
				}
				if (candidate.src.toLowerCase().includes(brand.replace(/\s+/g, ""))) {
					score += 6
					reasons.push("src matches brand")
				}
			}

			const area = logoArea(candidate.position)
			const square = Math.abs(candidate.position.width - candidate.position.height) < 5
			if (area > 1000 && area < 50000) score += 5
			else if (area < 500) score -= 8
			else if (area >= 50000 && area <= 200000) score -= 10
			else if (area > 200000) score -= 20
			if (square && candidate.position.width < 40) score -= 12
			if (candidate.isSvg) score += 3
			if (candidate.location === "footer") score -= 15
			if (candidate.location === "body" && !candidate.indicators.inHeader) score -= 10

			return { index, score, reasons }
		})
		.filter((item) => item.score > -900)
		.sort((a, b) => b.score - a.score)

	if (!scored.length) {
		return { selectedIndex: -1, confidence: 0, source: "fallback", reasoning: "Only duplicate variants were found" }
	}

	const top = scored[0]!
	const second = scored[1]
	const separation = second ? top.score - second.score : top.score
	if (top.score >= confidence.strongScore && separation >= confidence.strongSeparation) {
		return {
			selectedIndex: top.index,
			confidence: 0.9,
			source: "heuristic",
			reasoning: `Strong logo indicators: ${top.reasons.join(", ")}. Score ${top.score}, clear by ${separation}.`,
		}
	}
	if (top.score >= confidence.goodScore && separation >= confidence.goodSeparation) {
		return {
			selectedIndex: top.index,
			confidence: 0.75,
			source: "heuristic",
			reasoning: `Good logo indicators: ${top.reasons.join(", ")}. Score ${top.score}, clear by ${separation}.`,
		}
	}
	if (top.score >= confidence.moderateScore) {
		return {
			selectedIndex: top.index,
			confidence: 0.6,
			source: "heuristic",
			reasoning: `Moderate logo indicators: ${top.reasons.join(", ")}. Score ${top.score}.`,
		}
	}
	return {
		selectedIndex: top.index,
		confidence: 0.4,
		source: "heuristic",
		reasoning: `Weak logo indicators: ${top.reasons.join(", ")}. Score ${top.score}.`,
	}
}

export function topLogoCandidates(candidates: LogoCandidate[], maxCandidates = 20) {
	if (candidates.length <= maxCandidates) return { candidates, indexMap: candidates.map((_, i) => i) }
	const scored = candidates.map((candidate, index) => {
		let score = 0
		score += hrefHeaderScore(candidate).score
		if (candidate.location === "header") score += 20
		if (candidate.isVisible) score += 15
		if (candidate.indicators.classMatch) score += 10
		if (candidate.indicators.srcMatch) score += 10
		if (candidate.indicators.altMatch) score += 5
		if (candidate.source === "document.images") score += 15
		return { candidate, index, score }
	})
	scored.sort((a, b) => b.score - a.score)
	const top = scored.slice(0, maxCandidates)
	return { candidates: top.map((x) => x.candidate), indexMap: top.map((x) => x.index) }
}
