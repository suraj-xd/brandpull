#!/usr/bin/env bun
import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import type { BrandingProfile } from "./branding/types"
import { createSpinner } from "./ui"

interface Config {
	mode: "branding" | "preview"
	url: string
	out: string | null
	llm: boolean
	includeRaw: boolean
	waitMs: number
	timeoutMs: number
	webPreview: boolean
	previewPort: number
	openPreview: boolean
}

const help = `
  brandpull - Extract website branding JSON

  Usage:
    brandpull <url> [options]               Extract branding, save JSON, open preview
    brandpull branding <url> [options]      Extract branding JSON
    brandpull preview <file.json> [options] Preview saved branding JSON

  Options:
    -o, --out <file>      Write JSON to file instead of stdout
    --web-preview         Open a local browser preview for the branding JSON
    --no-preview          Save JSON without starting the local preview server
    --preview-port <n>    Preferred preview server port (default: 4177)
    --no-open             Start preview server without opening a browser
    --llm                 Use OpenAI enhancement when OPENAI_API_KEY is set
    --raw                 Include raw candidates/buttons in debug output
    --wait <ms>           Extra page settle wait (default: 2000)
    --timeout <ms>        Page navigation timeout (default: 30000)
`

const toBrandingOut = (hostname: string) =>
	`./${hostname
		.replace(/^www\./, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase()}-branding.json`

const parseUrl = (input: string): URL => {
	let raw = input
	if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`

	try {
		return new URL(raw)
	} catch {
		console.error(`Bad URL: ${input}`)
		process.exit(1)
	}
}

const parseArgs = (args: string[]): Config => {
	if (!args.length || args.includes("-h") || args.includes("--help")) {
		console.log(help)
		process.exit(0)
	}

	const argv = [...args]
	let mode: Config["mode"] = "branding"
	let implicitBranding = true

	if (argv[0] === "branding" || argv[0] === "brand") {
		implicitBranding = false
		argv.shift()
	} else if (argv[0] === "preview" || argv[0] === "web-preview") {
		mode = "preview"
		implicitBranding = false
		argv.shift()
	}

	const input = argv[0]
	if (!input) {
		console.error(mode === "preview" ? "Missing JSON file" : "Missing URL")
		process.exit(1)
	}

	let urlHref = input
	let hostname = ""
	if (mode === "branding") {
		const url = parseUrl(input)
		urlHref = url.href
		hostname = url.hostname
	}

	let out: string | null = null
	let llm = false
	let includeRaw = false
	let waitMs = 2000
	let timeoutMs = 30000
	let webPreview = implicitBranding
	let previewPort = 4177
	let openPreview = true

	for (let i = 1; i < argv.length; i++) {
		const arg = argv[i]
		const next = argv[i + 1]
		if (("-o" === arg || "--out" === arg) && next) {
			out = next
			i++
		} else if ("--llm" === arg) {
			llm = true
		} else if ("--no-llm" === arg) {
			llm = false
		} else if ("--raw" === arg || "--debug-branding" === arg) {
			includeRaw = true
		} else if ("--wait" === arg && next) {
			waitMs = +next
			i++
		} else if ("--timeout" === arg && next) {
			timeoutMs = +next
			i++
		} else if ("--web-preview" === arg || "--preview" === arg) {
			webPreview = true
		} else if ("--no-preview" === arg) {
			webPreview = false
		} else if ("--preview-port" === arg && next) {
			previewPort = +next
			i++
		} else if ("--no-open" === arg) {
			openPreview = false
		}
	}

	if (mode === "branding" && (implicitBranding || webPreview) && !out) {
		out = toBrandingOut(hostname)
	}

	return {
		mode,
		url: mode === "preview" ? resolve(input) : urlHref,
		out: out ? resolve(out) : null,
		llm,
		includeRaw,
		waitMs,
		timeoutMs,
		webPreview,
		previewPort,
		openPreview,
	}
}

const runPreview = async (config: Config) => {
	const { serveBrandingPreview } = await import("./branding/preview")
	process.stderr.write(`\n  \x1b[1mbrandpull preview\x1b[0m \x1b[90m- loading branding JSON...\x1b[0m\n`)
	process.stderr.write(`  \x1b[90m${config.url}\x1b[0m\n\n`)

	let profile: unknown
	try {
		profile = JSON.parse(await Bun.file(config.url).text())
	} catch (error) {
		throw new Error(`Could not read branding JSON: ${error instanceof Error ? error.message : String(error)}`)
	}

	if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
		throw new Error("Branding preview file must contain a JSON object")
	}

	await serveBrandingPreview(profile as BrandingProfile, {
		open: config.openPreview,
		port: config.previewPort,
	})
}

const runBranding = async (config: Config) => {
	const { extractBranding } = await import("./branding")
	const target = config.out ? ` -> ${config.out}` : config.webPreview ? " -> preview" : " -> stdout"
	process.stderr.write(`\n  \x1b[1mbrandpull\x1b[0m \x1b[90m- rendering page...\x1b[0m\n`)
	process.stderr.write(`  \x1b[90m${config.url}${target}\x1b[0m\n\n`)

	const spinner = createSpinner("Rendering page with Chromium")
	let profile: BrandingProfile
	try {
		profile = await extractBranding(config.url, {
			debug: config.includeRaw,
			includeRaw: config.includeRaw,
			llm: config.llm,
			waitMs: config.waitMs,
			timeoutMs: config.timeoutMs,
		})
		spinner.stop("\x1b[32mExtracted\x1b[0m branding signals")
	} catch (error) {
		spinner.stop("\x1b[31mFailed\x1b[0m branding extraction")
		throw error
	}

	const json = `${JSON.stringify(profile, null, 2)}\n`
	if (config.out) {
		const writeSpinner = createSpinner("Writing branding JSON")
		await mkdir(dirname(config.out), { recursive: true })
		await Bun.write(config.out, json)
		writeSpinner.stop(`\x1b[32mSaved\x1b[0m branding JSON: \x1b[90m${config.out}\x1b[0m`)
	} else if (!config.webPreview) {
		process.stdout.write(json)
	}

	if (config.webPreview) {
		const previewSpinner = createSpinner("Starting local preview")
		const { serveBrandingPreview } = await import("./branding/preview")
		previewSpinner.stop()
		await serveBrandingPreview(profile, {
			open: config.openPreview,
			port: config.previewPort,
		})
	}
}

async function main() {
	const config = parseArgs(process.argv.slice(2))
	if (config.mode === "preview") {
		await runPreview(config)
		return
	}
	await runBranding(config)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
