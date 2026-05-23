import { type Browser, chromium } from "playwright"
import { enhanceWithLLM } from "./llm"
import { extractBrandingFromPage } from "./page-script"
import { processRawBranding } from "./processor"
import type { BrandingExtractionOptions, BrandingProfile, RawBrandingData } from "./types"

function normalizeUrl(input: string): string {
	const raw = /^https?:\/\//i.test(input) ? input : `https://${input}`
	return new URL(raw).href
}

async function launchBrowser(): Promise<Browser> {
	try {
		return await chromium.launch({ headless: true })
	} catch (error) {
		try {
			return await chromium.launch({ headless: true, channel: "chrome" })
		} catch {
			throw error
		}
	}
}

function failureProfile(url: string, error: unknown): BrandingProfile {
	return {
		url,
		finalUrl: url,
		brandName: "",
		colorScheme: "light",
		logo: null,
		colors: {},
		typography: {},
		spacing: {},
		components: {},
		images: {},
		confidence: {
			logo: 0,
			colors: 0,
			buttons: 0,
			overall: 0,
		},
		diagnostics: {
			llm: { enabled: false, used: false },
			logo: {
				source: "none",
				selectedIndex: -1,
				reasoning: "Branding extraction failed before logo detection",
				confidence: 0,
			},
			errors: [
				{
					context: "extractBranding",
					message: error instanceof Error ? error.message : String(error),
					timestamp: Date.now(),
				},
			],
		},
	}
}

export async function extractBranding(
	inputUrl: string,
	options: BrandingExtractionOptions = {},
): Promise<BrandingProfile> {
	const url = normalizeUrl(inputUrl)
	let browser: Browser | null = null

	try {
		browser = await launchBrowser()
		const context = await browser.newContext({
			viewport: { width: 1440, height: 1000 },
			deviceScaleFactor: 1,
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		})
		const page = await context.newPage()
		page.setDefaultTimeout(options.timeoutMs ?? 30000)
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs ?? 30000 })
		await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => undefined)
		await page.waitForTimeout(options.waitMs ?? 2000)

		const raw = await page.evaluate(extractBrandingFromPage)
		const profile = processRawBranding(raw as RawBrandingData, {
			debug: options.debug || options.includeRaw || options.llm,
			url,
		})

		if (options.llm) {
			await enhanceWithLLM(profile, raw as RawBrandingData)
		} else {
			profile.diagnostics = {
				...profile.diagnostics,
				llm: { enabled: false, used: false },
			}
		}

		if (!options.debug && !options.includeRaw) delete profile.debug
		await context.close()
		return profile
	} catch (error) {
		return failureProfile(url, error)
	} finally {
		await browser?.close().catch(() => undefined)
	}
}

export type { BrandingExtractionOptions, BrandingProfile } from "./types"
