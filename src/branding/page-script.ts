import type { RawBrandingData } from "./types"

export function extractBrandingFromPage(): RawBrandingData {
	const constants = {
		buttonMinWidth: 50,
		buttonMinHeight: 25,
		buttonMinPaddingVertical: 3,
		buttonMinPaddingHorizontal: 6,
		maxParentTraversal: 5,
		maxBackgroundSamples: 100,
		minSignificantArea: 1000,
		minLargeContainerArea: 10000,
		minLogoSize: 25,
		minAlphaThreshold: 0.1,
		maxTransparentAlpha: 0.01,
		topPageThreshold: 500,
	}

	const errors: Array<{ context: string; message: string; timestamp: number }> = []
	const recordError = (context: string, error: unknown) => {
		errors.push({
			context,
			message: error && (error as Error).message ? (error as Error).message : String(error),
			timestamp: Date.now(),
		})
	}

	let nativeGetComputedStyle: (el: Element) => CSSStyleDeclaration
	try {
		const native = Window.prototype.getComputedStyle
		nativeGetComputedStyle = native ? native.bind(window) : window.getComputedStyle.bind(window)
	} catch {
		nativeGetComputedStyle = () => ({}) as CSSStyleDeclaration
	}

	const styleCache = new WeakMap<Element, CSSStyleDeclaration>()
	const getStyle = (el: Element): CSSStyleDeclaration => {
		try {
			if (!el || !(el instanceof Element)) return nativeGetComputedStyle(document.documentElement)
			const cached = styleCache.get(el)
			if (cached) return cached
			const style = nativeGetComputedStyle(el)
			styleCache.set(el, style)
			return style
		} catch (error) {
			recordError("getComputedStyle", error)
			return nativeGetComputedStyle(document.documentElement)
		}
	}

	const classString = (el: Element | null): string => {
		if (!el) return ""
		try {
			const cn = el.className as unknown
			if (typeof cn === "string") return cn
			if (cn && typeof cn === "object" && "baseVal" in cn) return String((cn as { baseVal: string }).baseVal || "")
			return el.getAttribute("class") || String(cn || "")
		} catch {
			return ""
		}
	}

	const toPx = (value: string | null | undefined): number | null => {
		if (!value || value === "auto") return null
		if (value.endsWith("px")) return Number.parseFloat(value)
		if (value.endsWith("rem"))
			return Number.parseFloat(value) * Number.parseFloat(getStyle(document.documentElement).fontSize || "16")
		if (value.endsWith("em"))
			return (
				Number.parseFloat(value) *
				Number.parseFloat(getStyle(document.body ?? document.documentElement).fontSize || "16")
			)
		if (value.endsWith("%")) return null
		const parsed = Number.parseFloat(value)
		return Number.isFinite(parsed) ? parsed : null
	}

	const textOf = (el: Element | null, limit = 100) =>
		(el?.textContent || "").trim().replace(/\s+/g, " ").slice(0, limit)

	const resolveUrl = (raw: string | null | undefined): string => {
		if (!raw) return ""
		if (raw.startsWith("data:")) return raw
		try {
			return new URL(raw, window.location.href).href
		} catch {
			return raw
		}
	}

	const isSameBrandHost = (a: string, b: string): boolean => {
		if (a === b) return true
		const al = a.replace(/^www\./, "").split(".")[0] || ""
		const bl = b.replace(/^www\./, "").split(".")[0] || ""
		return al.length > 1 && al === bl
	}

	const isHomeHref = (href: string | null | undefined): boolean => {
		if (!href) return false
		const trimmed = href.trim()
		if (["", "/", "./", "/home", "/index", "/index.html", "#"].includes(trimmed)) return true
		if (trimmed.startsWith("#") || trimmed.startsWith("?")) return true
		try {
			const url = new URL(trimmed, window.location.origin)
			if (!isSameBrandHost(window.location.hostname.toLowerCase(), url.hostname.toLowerCase())) return false
			const path = url.pathname.replace(/\/$/, "") || "/"
			return (
				path === "/" ||
				path === "/home" ||
				path === "/index" ||
				path === "/index.html" ||
				path.split("/").filter(Boolean).length === 1
			)
		} catch {
			const parts = trimmed.split("/").filter(Boolean)
			return parts.length === 1 && !trimmed.includes(".")
		}
	}

	const isExternalServiceHref = (href: string): boolean => {
		const lower = href.toLowerCase()
		if (!(lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("//"))) return false
		const services = [
			"github.com",
			"twitter.com",
			"x.com",
			"facebook.com",
			"linkedin.com",
			"instagram.com",
			"youtube.com",
			"discord.com",
			"slack.com",
			"npmjs.com",
			"pypi.org",
			"shields.io",
			"vercel.com",
			"netlify.com",
		]
		try {
			const url = new URL(href, window.location.origin)
			if (isSameBrandHost(window.location.hostname.toLowerCase(), url.hostname.toLowerCase())) return false
			return services.some((service) => lower.includes(service))
		} catch {
			return true
		}
	}

	const queryAllDeep = (selector: string): Element[] => {
		const results: Element[] = []
		const seen = new Set<Document | ShadowRoot>()
		const walk = (root: Document | ShadowRoot) => {
			if (!root || seen.has(root)) return
			seen.add(root)
			try {
				root.querySelectorAll(selector).forEach((el) => {
					results.push(el)
				})
				root.querySelectorAll("*").forEach((el) => {
					const shadowRoot = (el as Element & { shadowRoot?: ShadowRoot }).shadowRoot
					if (shadowRoot) walk(shadowRoot)
				})
			} catch (error) {
				recordError(`queryAllDeep:${selector}`, error)
			}
		}
		walk(document)
		return results
	}

	const isValidBackgroundColor = (color: string | null | undefined): boolean => {
		if (!color) return false
		const normalized = color.toLowerCase().trim()
		if (normalized === "transparent" || normalized === "rgba(0, 0, 0, 0)") return false
		const rgba = normalized.match(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/)
		if (rgba) return Number.parseFloat(rgba[1]!) >= constants.maxTransparentAlpha
		return normalized.length > 0
	}

	const normalizeColor = (color: string | null | undefined): string | null => {
		if (!color) return null
		const normalized = color.toLowerCase().trim()
		if (!isValidBackgroundColor(normalized)) return null
		return normalized.replace(/\s+/g, "")
	}

	const collectCSSData = () => {
		const data = { colors: [] as string[], spacings: [] as number[], radii: [] as number[] }
		for (const sheet of Array.from(document.styleSheets)) {
			let rules: CSSRuleList | null = null
			try {
				rules = sheet.cssRules
			} catch {
				continue
			}
			for (const rule of Array.from(rules || [])) {
				try {
					if (rule.type !== CSSRule.STYLE_RULE) continue
					const style = (rule as CSSStyleRule).style
					for (const prop of ["color", "background-color", "border-color", "fill", "stroke"]) {
						const value = style.getPropertyValue(prop)
						if (value) data.colors.push(value)
					}
					for (const prop of [
						"border-radius",
						"border-top-left-radius",
						"border-top-right-radius",
						"border-bottom-left-radius",
						"border-bottom-right-radius",
					]) {
						const value = toPx(style.getPropertyValue(prop))
						if (value) data.radii.push(value)
					}
					for (const prop of [
						"margin",
						"margin-top",
						"margin-right",
						"margin-bottom",
						"margin-left",
						"padding",
						"padding-top",
						"padding-right",
						"padding-bottom",
						"padding-left",
						"gap",
						"row-gap",
						"column-gap",
					]) {
						const value = toPx(style.getPropertyValue(prop))
						if (value) data.spacings.push(value)
					}
				} catch (error) {
					recordError("collectCSSData:rule", error)
				}
			}
		}
		return data
	}

	const isButtonElement = (el: Element | null): boolean => {
		if (!el || typeof el.matches !== "function") return false
		const selector =
			'button,input[type="submit"],input[type="button"],[role=button],[data-primary-button],[data-secondary-button],[data-cta],a.button,a.btn,[class*="btn"],[class*="button"],a[class*="bg-brand"],a[class*="bg-primary"],a[class*="bg-accent"]'
		if (el.matches(selector)) return true
		if (el.tagName.toLowerCase() !== "a") return false
		const style = getStyle(el)
		const rect = el.getBoundingClientRect()
		const classes = classString(el).toLowerCase()
		const hasButtonClasses =
			/rounded(-md|-lg|-xl|-full)?|p[xy]?-\d+|border.*rounded|inline-flex.*items-center.*justify-center/.test(classes)
		const hasPadding =
			(Number.parseFloat(style.paddingTop) || 0) > constants.buttonMinPaddingVertical ||
			(Number.parseFloat(style.paddingBottom) || 0) > constants.buttonMinPaddingVertical ||
			(Number.parseFloat(style.paddingLeft) || 0) > constants.buttonMinPaddingHorizontal ||
			(Number.parseFloat(style.paddingRight) || 0) > constants.buttonMinPaddingHorizontal
		const hasSize = rect.width > constants.buttonMinWidth && rect.height > constants.buttonMinHeight
		const hasShape =
			(Number.parseFloat(style.borderRadius) || 0) > 0 || (Number.parseFloat(style.borderTopWidth) || 0) > 0
		return (hasButtonClasses && hasSize) || (hasPadding && hasSize && hasShape)
	}

	const sampleElements = (): Element[] => {
		const set = new Set<Element>()
		const push = (selector: string, limit: number) => {
			let count = 0
			for (const el of Array.from(document.querySelectorAll(selector))) {
				if (count >= limit) break
				set.add(el)
				count++
			}
		}
		push('header img, header svg, nav img, nav svg, .site-logo img, img[alt*="logo" i], img[src*="logo" i]', 20)
		push(
			'button, input[type="submit"], input[type="button"], [role=button], [data-primary-button], [data-secondary-button], [data-cta], a.button, a.btn, [class*="btn"], [class*="button"], a[class*="bg-brand"], a[class*="bg-primary"], a[class*="bg-accent"]',
			120,
		)
		for (const link of Array.from(document.querySelectorAll("a")).slice(0, 150)) {
			if (!set.has(link) && isButtonElement(link)) set.add(link)
		}
		push('input, select, textarea, [class*="form-control"]', 35)
		push("h1, h2, h3, p, a", 80)
		return Array.from(set).filter(Boolean)
	}

	const getStyleSnapshot = (el: Element) => {
		const style = getStyle(el)
		const rect = el.getBoundingClientRect()
		const tag = el.tagName.toLowerCase()
		const classes = classString(el).toLowerCase()
		const fontStack = (style.fontFamily || "")
			.split(",")
			.map((font) => font.replace(/["']/g, "").trim())
			.filter(Boolean)

		let background = style.getPropertyValue("background-color")
		const transparent = background === "transparent" || background === "rgba(0, 0, 0, 0)"
		const isInputElement = tag === "input" || tag === "select" || tag === "textarea"
		if (transparent && !isInputElement) {
			let parent = el.parentElement
			let depth = 0
			while (parent && depth < constants.maxParentTraversal) {
				const parentBg = getStyle(parent).getPropertyValue("background-color")
				if (isValidBackgroundColor(parentBg)) {
					background = parentBg
					break
				}
				parent = parent.parentElement
				depth++
			}
		}

		const hasCTAIndicator =
			el.matches('[data-primary-button],[data-secondary-button],[data-cta],[class*="cta"],[class*="hero"]') ||
			el.getAttribute("data-primary-button") === "true" ||
			el.getAttribute("data-secondary-button") === "true"
		const isNavigation =
			!hasCTAIndicator &&
			(/nav-|nav-|nav-link|sidebar|menu|toggle|trigger/.test(classes) ||
				el.matches('[role="tab"],[role="menuitem"],[aria-haspopup],[aria-expanded]') ||
				!!el.closest(
					'nav, [role="navigation"], [role="menu"], [role="menubar"], [class*="navigation"], [class*="dropdown"], [class*="sidebar"], aside',
				))
		const isButton = isButtonElement(el) && !isNavigation
		const isInput = el.matches(
			'input:not([type="submit"]):not([type="button"]),select,textarea,[class*="form-control"]',
		)
		const input = el as HTMLInputElement
		const text =
			tag === "input" && (input.type === "submit" || input.type === "button")
				? (input.value || "").trim().slice(0, 100)
				: textOf(el, 100)

		const inputMetadata = isInput
			? {
					type: tag === "input" ? input.type || "text" : tag,
					placeholder: input.placeholder || "",
					value: tag === "input" ? input.value || "" : "",
					required: input.required || false,
					disabled: input.disabled || false,
					name: input.name || "",
					id: el.id || "",
					label: (() => {
						if (el.id) {
							const label = document.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`)
							if (label) return textOf(label, 100)
						}
						const parentLabel = el.closest("label")
						if (!parentLabel) return ""
						const clone = parentLabel.cloneNode(true) as HTMLElement
						clone.querySelector("input,select,textarea")?.remove()
						return textOf(clone, 100)
					})(),
				}
			: null

		const borderTop = style.getPropertyValue("border-top-color")
		const borderRight = style.getPropertyValue("border-right-color")
		const borderBottom = style.getPropertyValue("border-bottom-color")
		const borderLeft = style.getPropertyValue("border-left-color")
		const borderTopWidth = toPx(style.getPropertyValue("border-top-width"))
		const borderRightWidth = toPx(style.getPropertyValue("border-right-width"))
		const borderBottomWidth = toPx(style.getPropertyValue("border-bottom-width"))
		const borderLeftWidth = toPx(style.getPropertyValue("border-left-width"))

		return {
			tag,
			classes,
			text,
			rect: { w: rect.width, h: rect.height },
			colors: {
				text: style.getPropertyValue("color"),
				background,
				border:
					borderTop === borderRight && borderTop === borderBottom && borderTop === borderLeft ? borderTop : borderTop,
				borderWidth:
					borderTopWidth === borderRightWidth &&
					borderTopWidth === borderBottomWidth &&
					borderTopWidth === borderLeftWidth
						? borderTopWidth
						: borderTopWidth,
				borderTop,
				borderTopWidth,
				borderRight,
				borderRightWidth,
				borderBottom,
				borderBottomWidth,
				borderLeft,
				borderLeftWidth,
			},
			typography: {
				fontStack,
				size: style.getPropertyValue("font-size") || null,
				weight: Number.parseInt(style.getPropertyValue("font-weight"), 10) || null,
			},
			radius: toPx(style.getPropertyValue("border-radius")),
			borderRadius: {
				topLeft: toPx(style.getPropertyValue("border-top-left-radius")),
				topRight: toPx(style.getPropertyValue("border-top-right-radius")),
				bottomRight: toPx(style.getPropertyValue("border-bottom-right-radius")),
				bottomLeft: toPx(style.getPropertyValue("border-bottom-left-radius")),
			},
			shadow: style.getPropertyValue("box-shadow") || null,
			isButton,
			isNavigation,
			hasCTAIndicator,
			isInput,
			inputMetadata,
			isLink: el.matches("a"),
		}
	}

	const backgroundImageUrl = (value: string | null): string | null => {
		if (!value || value === "none") return null
		const quoted = value.match(/url\((["'])(.*?)\1\)/)
		const simple = quoted?.[2] ?? value.match(/url\(([^)]+?)\)/)?.[1]
		if (!simple) return null
		return simple
			.trim()
			.replace(/^["']|["']$/g, "")
			.replace(/&quot;/g, '"')
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
	}

	const serializeSvg = (svg: SVGSVGElement): string => {
		const clone = svg.cloneNode(true) as SVGSVGElement
		const originals = [svg, ...Array.from(svg.querySelectorAll("*"))]
		const clones = [clone, ...Array.from(clone.querySelectorAll("*"))]
		const props = ["fill", "stroke", "color", "stop-color", "stroke-width", "opacity", "fill-opacity", "stroke-opacity"]
		for (let i = 0; i < clones.length; i++) {
			const original = originals[i]
			const cloned = clones[i]
			if (!original || !cloned) continue
			const style = getStyle(original)
			for (const prop of props) {
				const value = style.getPropertyValue(prop)
				if (value?.trim() && value !== "none") (cloned as HTMLElement).style.setProperty(prop, value)
			}
		}
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
	}

	const findImages = () => {
		const images: Array<{ type: string; src: string }> = []
		const logoCandidates: RawBrandingData["logoCandidates"] = []
		const pushImage = (src: string | null | undefined, type: string) => {
			const resolved = resolveUrl(src)
			if (resolved) images.push({ type, src: resolved })
		}

		pushImage((document.querySelector('link[rel*="icon" i]') as HTMLLinkElement | null)?.href, "favicon")
		pushImage((document.querySelector('meta[property="og:image" i]') as HTMLMetaElement | null)?.content, "og")
		pushImage((document.querySelector('meta[name="twitter:image" i]') as HTMLMetaElement | null)?.content, "twitter")

		const collect = (el: Element, source: string) => {
			try {
				const rect = el.getBoundingClientRect()
				const style = getStyle(el)
				const parentLink = el.closest("a")
				const href = parentLink?.getAttribute("href") || ""
				if (href && isExternalServiceHref(href)) return

				const inHeader = !!el.closest(
					'header, nav, [role="banner"], #navbar, [id*="navbar" i], [class*="navbar" i], [class*="globalnav" i], [role="menubar"]',
				)
				const inFooter = !!el.closest('footer, [class*="footer" i], [role="contentinfo"]')
				const parentAria = parentLink?.getAttribute("aria-label") || ""
				const ownAria = el.getAttribute("aria-label") || ""
				const ownTitle = el.getAttribute("title") || el.querySelector("title")?.textContent || ""
				const classes = classString(el).toLowerCase()
				const id = (el.id || "").toLowerCase()
				const tag = el.tagName.toLowerCase()
				const bgUrl = backgroundImageUrl(style.getPropertyValue("background-image"))
				const imgSrc = tag === "img" ? (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src : ""
				const isSvg = tag === "svg"
				const alt =
					tag === "img"
						? ((el as HTMLImageElement).alt || parentAria || "").trim()
						: (ownAria || ownTitle || textOf(el, 80) || id || "").trim()
				const hasLogoData = /logo|brand|site-name|site-title/i.test(
					`${classes} ${id} ${ownAria} ${ownTitle} ${parentAria}`,
				)
				const hasHome = isHomeHref(href)
				const strongContext = inHeader || hasHome || hasLogoData
				const isVisible =
					rect.width > 0 &&
					rect.height > 0 &&
					style.display !== "none" &&
					style.visibility !== "hidden" &&
					style.opacity !== "0"

				if (/flag|language|locale/i.test(`${classes} ${id} ${alt}`) && rect.width <= 32 && rect.height <= 32) return
				if (
					/search|magnif|hamburger|menu|cart|user|bell|chevron|arrow|caret|dropdown|close|settings/i.test(
						`${classes} ${id} ${alt}`,
					) &&
					!hasLogoData
				)
					return
				if (!strongContext && !/logo|brand/i.test(`${imgSrc} ${bgUrl || ""} ${alt}`)) return

				let src = ""
				let finalSvg = false
				let svgScore = 0
				if (isSvg) {
					finalSvg = true
					const image = el.querySelector("image")
					const imageHref = image?.getAttribute("href") || image?.getAttribute("xlink:href") || ""
					src = imageHref ? resolveUrl(imageHref) : serializeSvg(el as SVGSVGElement)
					const pathCount = el.querySelectorAll("path").length
					const groupCount = el.querySelectorAll("g").length
					svgScore += Math.min(pathCount * 2, 40) + Math.min(groupCount, 20)
					if (el.querySelector("text")) svgScore -= 50
					if (el.querySelector("animate, animateTransform, animateMotion")) svgScore += 30
					const area = rect.width * rect.height
					if (area > 10000) svgScore += 20
					else if (area > 5000) svgScore += 10
					else if (area < 1000) svgScore -= 20
				} else if (imgSrc) {
					src = resolveUrl(imgSrc)
				} else if (bgUrl && strongContext) {
					src = resolveUrl(bgUrl)
					finalSvg = src.startsWith("data:image/svg+xml") || /\.svg(\?|#|$)/i.test(src)
				}
				if (!src) return

				const srcMatch = /logo|brand/i.test(src) || /logo/i.test(id)
				const altMatch = /logo|brand/i.test(alt)
				const classMatch = hasLogoData || !!el.closest('[class*="logo" i], [id*="logo" i]')
				if (!isVisible && !strongContext) return

				const position = {
					top: isVisible ? rect.top : 0,
					left: isVisible ? rect.left : 0,
					width: rect.width || Number.parseFloat(el.getAttribute("width") || "0") || 0,
					height: rect.height || Number.parseFloat(el.getAttribute("height") || "0") || 0,
				}
				logoCandidates.push({
					src,
					alt,
					ariaLabel: ownAria || parentAria || undefined,
					title: ownTitle || undefined,
					isSvg: finalSvg,
					isVisible,
					location: inHeader ? "header" : inFooter ? "footer" : "body",
					position,
					indicators: {
						inHeader,
						altMatch,
						srcMatch,
						classMatch,
						hrefMatch: hasHome,
					},
					href: href || undefined,
					source,
					logoSvgScore: finalSvg ? (src.startsWith("data:image/svg+xml") ? Math.max(80, svgScore) : svgScore) : 100,
				})
			} catch (error) {
				recordError("collectLogoCandidate", error)
			}
		}

		const selectors = [
			"header a img, header a svg, header img, header svg",
			"nav a img, nav a svg, nav img, nav svg",
			'[role="banner"] a img, [role="banner"] a svg, [role="banner"] img, [role="banner"] svg',
			'[class*="header" i] a img, [class*="header" i] a svg, [class*="header" i] img, [class*="header" i] svg',
			'[id*="header" i] a img, [id*="header" i] a svg, [id*="header" i] img, [id*="header" i] svg',
			'[class*="navbar" i] a img, [class*="navbar" i] a svg, [class*="navbar" i] img, [class*="navbar" i] svg',
			'a[aria-label*="logo" i] img, a[aria-label*="logo" i] svg',
			'a[aria-label*="home" i] img, a[aria-label*="home" i] svg',
			'a[class*="logo" i] img, a[class*="logo" i] svg',
			'[class*="logo" i] img, [class*="logo" i] svg',
			'[id*="logo" i] img, [id*="logo" i] svg',
			'img[class*="logo" i], svg[class*="logo" i]',
			'img[src*="logo" i], img[alt*="logo" i]',
			'a[href="/"] img, a[href="/"] svg, a[href="./"] img, a[href="./"] svg',
		]
		for (const selector of selectors) {
			queryAllDeep(selector).forEach((el) => {
				collect(el, selector)
			})
		}

		const backgroundSelectors = [
			'[class*="logo" i]',
			'[id*="logo" i]',
			"header a > div, header a > span, nav a > div, nav a > span",
			'a[aria-label*="logo" i] > div, a[aria-label*="home" i] > div',
			'div[data-framer-name*="logo" i], span[data-framer-name*="logo" i], div[data-name*="logo" i], span[data-name*="logo" i]',
		]
		for (const selector of backgroundSelectors) {
			queryAllDeep(selector).forEach((el) => {
				if (backgroundImageUrl(getStyle(el).getPropertyValue("background-image"))) collect(el, `background:${selector}`)
			})
		}

		queryAllDeep("img").forEach((img) => {
			const alt = (img as HTMLImageElement).alt || ""
			const src = (img as HTMLImageElement).src || ""
			if (
				/logo|brand/i.test(`${alt} ${src} ${classString(img)}`) &&
				!img.closest('[class*="testimonial" i], [class*="client" i], [class*="partner" i], footer')
			)
				collect(img, "document.images")
		})

		queryAllDeep("svg").forEach((svg) => {
			const rect = svg.getBoundingClientRect()
			const existing = logoCandidates.some(
				(c) =>
					c.isSvg &&
					Math.abs(c.position.top - rect.top) < 1 &&
					Math.abs(c.position.left - rect.left) < 1 &&
					Math.abs(c.position.width - rect.width) < 1,
			)
			if (!existing) {
				const data = `${svg.id} ${classString(svg)} ${svg.getAttribute("aria-label") || ""} ${svg.querySelector("title")?.textContent || ""}`
				if (
					/logo|brand/i.test(data) ||
					svg.closest('header, nav, [role="banner"], [class*="logo" i], [id*="logo" i]')
				) {
					collect(svg, "document.querySelectorAll(svg)")
				}
			}
		})

		queryAllDeep("a[href]")
			.filter((a) => isHomeHref(a.getAttribute("href")))
			.flatMap((a) => Array.from(a.querySelectorAll("img, svg")))
			.filter((el) => {
				const rect = el.getBoundingClientRect()
				return rect.top >= 0 && rect.top < constants.topPageThreshold && rect.width > 0 && rect.height > 0
			})
			.forEach((el) => {
				collect(el, "fallback-top-home-link")
			})

		const bySrc = new Map<string, RawBrandingData["logoCandidates"][number]>()
		for (const candidate of logoCandidates) {
			const existing = bySrc.get(candidate.src)
			if (!existing) {
				bySrc.set(candidate.src, candidate)
				continue
			}
			const area = candidate.position.width * candidate.position.height
			const existingArea = existing.position.width * existing.position.height
			if (
				(candidate.isVisible && !existing.isVisible) ||
				(candidate.indicators.hrefMatch && !existing.indicators.hrefMatch) ||
				area > existingArea
			) {
				bySrc.set(candidate.src, candidate)
			}
		}
		const unique = Array.from(bySrc.values())
		const pickable = unique.filter((c) => c.isVisible)
		const best = (pickable.length ? pickable : unique).reduce<RawBrandingData["logoCandidates"][number] | null>(
			(bestCandidate, candidate) => {
				if (!bestCandidate) return candidate
				if (
					candidate.indicators.hrefMatch &&
					candidate.indicators.inHeader &&
					!(bestCandidate.indicators.hrefMatch && bestCandidate.indicators.inHeader)
				)
					return candidate
				if (!candidate.isSvg && bestCandidate.isSvg) return candidate
				if (candidate.indicators.inHeader && !bestCandidate.indicators.inHeader) return candidate
				if (candidate.indicators.hrefMatch && !bestCandidate.indicators.hrefMatch) return candidate
				const area = candidate.position.width * candidate.position.height
				const bestArea = bestCandidate.position.width * bestCandidate.position.height
				if (area >= constants.minSignificantArea && bestArea < constants.minSignificantArea) return candidate
				return candidate.position.top < bestCandidate.position.top ? candidate : bestCandidate
			},
			null,
		)

		if (best) pushImage(best.src, best.isSvg ? "logo-svg" : "logo")
		return { images, logoCandidates: unique }
	}

	const pickFontStack = (el: Element | null): string[] =>
		(getStyle(el ?? document.documentElement).fontFamily || "")
			.split(",")
			.map((font) => font.replace(/["']/g, "").trim())
			.filter(Boolean)

	const getTypography = () => {
		const body = document.body ?? document.documentElement
		const h1 = document.querySelector("h1") ?? body
		const h2 = document.querySelector("h2") ?? h1
		const p = document.querySelector("p") ?? body
		return {
			stacks: {
				body: pickFontStack(body),
				heading: pickFontStack(h1),
				paragraph: pickFontStack(p),
			},
			sizes: {
				h1: getStyle(h1).fontSize || "32px",
				h2: getStyle(h2).fontSize || "24px",
				body: getStyle(p).fontSize || "16px",
			},
		}
	}

	const detectFrameworkHints = () => {
		const hints = new Set<string>()
		const generator = document.querySelector('meta[name="generator"]')?.getAttribute("content")
		if (generator) hints.add(generator)
		const scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => s.getAttribute("src") || "")
		if (scripts.some((s) => /tailwind|cdn\.tailwindcss/.test(s))) hints.add("tailwind")
		if (scripts.some((s) => /bootstrap/.test(s))) hints.add("bootstrap")
		if (scripts.some((s) => /mui|material-ui/.test(s))) hints.add("material-ui")
		const classSample = Array.from(document.querySelectorAll("[class]")).slice(0, 250).map(classString).join(" ")
		if (/\b(px|py|mx|my|bg|text|rounded|flex|grid|items-center|justify-)/.test(classSample)) hints.add("tailwind-like")
		if (/\bbtn\b|\bcontainer\b|\brow\b|\bcol-/.test(classSample)) hints.add("bootstrap-like")
		if (/Mui[A-Z]|chakra-|radix-|headlessui|react-aria/.test(classSample)) hints.add("component-library")
		return Array.from(hints).filter(Boolean)
	}

	const detectColorScheme = (): "dark" | "light" => {
		const html = document.documentElement
		const body = document.body
		const dark =
			html.classList.contains("dark") ||
			body?.classList.contains("dark") ||
			html.getAttribute("data-theme") === "dark" ||
			body?.getAttribute("data-theme") === "dark" ||
			html.getAttribute("data-bs-theme") === "dark"
		const light =
			html.classList.contains("light") ||
			body?.classList.contains("light") ||
			html.getAttribute("data-theme") === "light" ||
			body?.getAttribute("data-theme") === "light" ||
			html.getAttribute("data-bs-theme") === "light"
		if (dark) return "dark"
		if (light) return "light"
		const bg = getStyle(body ?? html).backgroundColor || getStyle(html).backgroundColor
		const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
		if (match) {
			const r = Number.parseInt(match[1]!, 10)
			const g = Number.parseInt(match[2]!, 10)
			const b = Number.parseInt(match[3]!, 10)
			const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
			if (luminance < 0.4) return "dark"
			if (luminance > 0.6) return "light"
		}
		return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light"
	}

	const extractBrandName = () => {
		const site = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim()
		const app = document.querySelector('meta[name="application-name"]')?.getAttribute("content")?.trim()
		const title = document.title || ""
		const h1 = textOf(document.querySelector("h1"), 80)
		let domain = ""
		try {
			domain = window.location.hostname.replace(/^www\./, "").split(".")[0] || ""
			domain = domain.charAt(0).toUpperCase() + domain.slice(1)
		} catch {}
		const titleParts = title
			.split(/\s(?:[|–—-]|::)\s/)
			.map((part) => part.trim())
			.filter(Boolean)
		const titleBrand =
			titleParts.length > 1 ? titleParts[titleParts.length - 1] : title.replace(/\s*[-|–—:].*$/, "").trim()
		return site || app || titleBrand || h1 || domain || ""
	}

	const getBackgroundCandidates = () => {
		const candidates: Array<{ color: string; source: string; priority: number; area?: number }> = []
		const freq = new Map<string, number>()
		for (const el of Array.from(
			document.querySelectorAll("body, html, main, article, [role='main'], div, section"),
		).slice(0, constants.maxBackgroundSamples)) {
			try {
				const bg = getStyle(el).backgroundColor
				if (!isValidBackgroundColor(bg)) continue
				const rect = el.getBoundingClientRect()
				const area = rect.width * rect.height
				if (area <= constants.minSignificantArea) continue
				const key = normalizeColor(bg)
				if (key) freq.set(key, (freq.get(key) ?? 0) + area)
			} catch (error) {
				recordError("backgroundCandidates:element", error)
			}
		}
		let mostCommon: string | null = null
		let maxArea = 0
		for (const [color, area] of freq.entries()) {
			if (area > maxArea) {
				maxArea = area
				mostCommon = color
			}
		}
		const add = (color: string | null | undefined, source: string, priority: number, area?: number) => {
			const normalized = normalizeColor(color)
			if (normalized) candidates.push({ color: normalized, source, priority, area })
		}
		const bodyBg = getStyle(document.body ?? document.documentElement).backgroundColor
		const htmlBg = getStyle(document.documentElement).backgroundColor
		add(bodyBg, "body", normalizeColor(bodyBg) === mostCommon ? 15 : 10)
		add(htmlBg, "html", normalizeColor(htmlBg) === mostCommon ? 14 : 9)
		if (mostCommon && mostCommon !== normalizeColor(bodyBg) && mostCommon !== normalizeColor(htmlBg)) {
			add(mostCommon, "most-common-visible", 12, maxArea)
		}
		const root = getStyle(document.documentElement)
		for (const name of [
			"--background",
			"--background-light",
			"--background-dark",
			"--bg-background",
			"--color-background",
			"--color-background-light",
			"--color-background-dark",
		]) {
			add(root.getPropertyValue(name).trim(), `css-var:${name}`, 8)
		}
		for (const el of Array.from(
			document.querySelectorAll("main, article, [role='main'], header, .main, .container"),
		).slice(0, 5)) {
			const rect = el.getBoundingClientRect()
			if (rect.width * rect.height > constants.minLargeContainerArea) {
				add(getStyle(el).backgroundColor, `${el.tagName.toLowerCase()}-container`, 5, rect.width * rect.height)
			}
		}
		const seen = new Set<string>()
		return candidates
			.filter((candidate) => {
				const key = normalizeColor(candidate.color)
				if (!key || seen.has(key)) return false
				seen.add(key)
				return true
			})
			.sort((a, b) => b.priority - a.priority)
	}

	const cssData = collectCSSData()
	const snapshots = sampleElements().map(getStyleSnapshot)
	const imageData = findImages()
	const typography = getTypography()
	const backgroundCandidates = getBackgroundCandidates()
	const pageBackground = backgroundCandidates[0]?.color ?? null

	return {
		cssData,
		snapshots,
		images: imageData.images,
		logoCandidates: imageData.logoCandidates,
		brandName: extractBrandName(),
		pageTitle: document.title || "",
		pageUrl: window.location.href,
		typography,
		frameworkHints: detectFrameworkHints(),
		colorScheme: detectColorScheme(),
		pageBackground,
		backgroundCandidates,
		errors: errors.length ? errors : undefined,
	}
}
