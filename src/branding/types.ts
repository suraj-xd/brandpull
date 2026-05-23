export type ColorScheme = "light" | "dark"

export interface CSSData {
	colors: string[]
	spacings: number[]
	radii: number[]
}

export interface StyleSnapshot {
	tag: string
	classes: string
	text: string
	rect: { w: number; h: number }
	colors: {
		text: string
		background: string
		border: string
		borderWidth: number | null
		borderTop?: string
		borderTopWidth?: number | null
		borderRight?: string
		borderRightWidth?: number | null
		borderBottom?: string
		borderBottomWidth?: number | null
		borderLeft?: string
		borderLeftWidth?: number | null
	}
	typography: {
		fontStack: string[]
		size: string | null
		weight: number | null
	}
	radius: number | null
	borderRadius: {
		topLeft: number | null
		topRight: number | null
		bottomRight: number | null
		bottomLeft: number | null
	}
	shadow: string | null
	isButton: boolean
	isNavigation: boolean
	hasCTAIndicator: boolean
	isInput: boolean
	inputMetadata: {
		type: string
		placeholder: string
		value: string
		required: boolean
		disabled: boolean
		name: string
		id: string
		label: string
	} | null
	isLink: boolean
}

export interface LogoCandidate {
	src: string
	alt: string
	ariaLabel?: string
	title?: string
	isSvg: boolean
	isVisible: boolean
	location: "header" | "body" | "footer"
	position: { top: number; left: number; width: number; height: number }
	indicators: {
		inHeader: boolean
		altMatch: boolean
		srcMatch: boolean
		classMatch: boolean
		hrefMatch: boolean
	}
	href?: string
	source: string
	logoSvgScore?: number
}

export interface RawImage {
	type: "favicon" | "og" | "twitter" | "logo" | "logo-svg" | string
	src: string
}

export interface BackgroundCandidate {
	color: string
	source: string
	priority: number
	area?: number
}

export interface TypographyData {
	stacks: {
		body: string[]
		heading: string[]
		paragraph: string[]
	}
	sizes: {
		h1: string
		h2: string
		body: string
	}
}

export interface ExtractionDiagnostic {
	context: string
	message: string
	timestamp: number
}

export interface RawBrandingData {
	cssData: CSSData
	snapshots: StyleSnapshot[]
	images: RawImage[]
	logoCandidates: LogoCandidate[]
	brandName: string
	pageTitle: string
	pageUrl: string
	typography: TypographyData
	frameworkHints: string[]
	colorScheme: ColorScheme
	pageBackground: string | null
	backgroundCandidates: BackgroundCandidate[]
	errors?: ExtractionDiagnostic[]
}

export interface ButtonSnapshot {
	index: number
	text: string
	classes: string
	background: string
	textColor: string
	borderColor?: string | null
	borderRadius?: string
	borderRadiusCorners?: {
		topLeft?: string
		topRight?: string
		bottomRight?: string
		bottomLeft?: string
	}
	shadow?: string | null
	score?: number
	originalBackgroundColor?: string
	originalTextColor?: string
	originalBorderColor?: string
}

export interface InputSnapshot {
	type: string
	placeholder: string
	label: string
	name: string
	required: boolean
	classes: string
	background: string
	textColor: string | null
	borderColor?: string | null
	borderRadius?: string
	borderRadiusCorners?: {
		topLeft?: string
		topRight?: string
		bottomRight?: string
		bottomLeft?: string
	}
	shadow?: string | null
}

export interface BrandingProfile {
	url?: string
	finalUrl?: string
	brandName?: string
	pageTitle?: string
	colorScheme?: ColorScheme
	logo?: string | null
	fonts?: Array<{ family: string; count?: number; role?: string }>
	colors?: {
		primary?: string
		secondary?: string
		accent?: string
		background?: string
		textPrimary?: string
		textSecondary?: string
		link?: string
		[key: string]: string | undefined
	}
	typography?: {
		fontFamilies?: {
			primary?: string
			heading?: string
			code?: string
		}
		fontStacks?: {
			body?: string[]
			heading?: string[]
			paragraph?: string[]
			primary?: string[]
		}
		fontSizes?: {
			h1?: string
			h2?: string
			body?: string
		}
	}
	spacing?: {
		baseUnit?: number
		borderRadius?: string
	}
	components?: {
		buttonPrimary?: ComponentStyle
		buttonSecondary?: ComponentStyle
		input?: ComponentStyle
	}
	images?: {
		logo?: string | null
		logoHref?: string | null
		logoAlt?: string | null
		favicon?: string | null
		ogImage?: string | null
	}
	personality?: {
		tone: "professional" | "playful" | "modern" | "traditional" | "minimalist" | "bold"
		energy: "low" | "medium" | "high"
		targetAudience: string
	}
	designSystem?: {
		framework: "tailwind" | "bootstrap" | "material" | "chakra" | "custom" | "unknown"
		componentLibrary: string
	}
	confidence?: {
		logo?: number
		colors?: number
		buttons?: number
		overall?: number
	}
	diagnostics?: {
		llm?: {
			enabled: boolean
			used: boolean
			error?: string
			model?: string
		}
		logo?: {
			source: "heuristic" | "llm" | "fallback" | "none"
			selectedIndex: number
			reasoning: string
			confidence: number
		}
		errors?: ExtractionDiagnostic[]
	}
	debug?: {
		buttons?: ButtonSnapshot[]
		inputs?: InputSnapshot[]
		logoCandidates?: LogoCandidate[]
		frameworkHints?: string[]
		backgroundCandidates?: BackgroundCandidate[]
	}
}

export interface ComponentStyle {
	background?: string
	textColor?: string | null
	borderColor?: string | null
	borderRadius?: string
	borderRadiusCorners?: {
		topLeft?: string
		topRight?: string
		bottomRight?: string
		bottomLeft?: string
	}
	shadow?: string | null
}

export interface BrandingExtractionOptions {
	debug?: boolean
	includeRaw?: boolean
	llm?: boolean
	waitMs?: number
	timeoutMs?: number
	model?: string
}
