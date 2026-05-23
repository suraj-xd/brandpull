import type { BrandingProfile } from "./types"

interface PreviewOptions {
	port?: number
	open?: boolean
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
}

function html(profile: BrandingProfile): string {
	const title = profile.brandName ? `${profile.brandName} Branding` : "Branding Preview"
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @font-face {
      font-family: "Geist Sans";
      src: url("https://cdn.jsdelivr.net/npm/geist@1.7.0/dist/fonts/geist-sans/Geist-Variable.woff2") format("woff2");
      font-display: swap;
      font-style: normal;
      font-weight: 100 900;
    }
    @font-face {
      font-family: "Geist Mono";
      src: url("https://cdn.jsdelivr.net/npm/geist@1.7.0/dist/fonts/geist-mono/GeistMono-Variable.woff2") format("woff2");
      font-display: swap;
      font-style: normal;
      font-weight: 100 900;
    }
    :root { color-scheme: light; }
    html.preview-dark { color-scheme: dark; }
    body { font-family: "Geist Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    code, pre, .font-mono {
      font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-variant-numeric: tabular-nums;
    }
    .label-mono {
      font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .checker {
      background-color: #fff;
      background-image:
        linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
        linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
        linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
      background-size: 18px 18px;
      background-position: 0 0, 0 9px, 9px -9px, -9px 0;
    }
    html.preview-dark .checker {
      background-color: #18181b;
      background-image:
        linear-gradient(45deg, #3f3f46 25%, transparent 25%),
        linear-gradient(-45deg, #3f3f46 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #3f3f46 75%),
        linear-gradient(-45deg, transparent 75%, #3f3f46 75%);
    }
    html.preview-dark body,
    html.preview-dark .bg-zinc-50 {
      background-color: #09090b !important;
      color: #f4f4f5;
    }
    html.preview-dark header,
    html.preview-dark section {
      background-color: #09090b !important;
      border-color: #27272a !important;
    }
    html.preview-dark .bg-white {
      background-color: #18181b !important;
    }
    html.preview-dark .bg-zinc-100 {
      background-color: #27272a !important;
    }
    html.preview-dark .border-zinc-100,
    html.preview-dark .border-zinc-200 {
      border-color: #27272a !important;
    }
    html.preview-dark .text-zinc-950,
    html.preview-dark .text-zinc-900,
    html.preview-dark .text-zinc-800,
    html.preview-dark .text-zinc-700 {
      color: #f4f4f5 !important;
    }
    html.preview-dark .text-zinc-600,
    html.preview-dark .text-zinc-500,
    html.preview-dark .text-zinc-400 {
      color: #a1a1aa !important;
    }
    html.preview-dark .hover\\:bg-zinc-50:hover {
      background-color: #27272a !important;
    }
    html.preview-dark [data-tab][aria-pressed="true"] {
      background-color: #f4f4f5 !important;
      border-color: #f4f4f5 !important;
      color: #09090b !important;
    }
  </style>
</head>
<body class="min-h-screen bg-zinc-50 text-zinc-950">
  <div id="app"></div>
  <script>
    const state = { data: null, tab: "overview", previewTheme: "light", imageErrors: new Set() };

    const app = document.getElementById("app");
    const applyPreviewTheme = () => {
      document.documentElement.classList.toggle("preview-dark", state.previewTheme === "dark");
    };
    applyPreviewTheme();
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
    const swatch = (label, color) => {
      const display = color || "missing";
      return \`
        <div class="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 last:border-b-0">
          <dt class="text-sm text-zinc-500">\${esc(label)}</dt>
          <dd class="flex min-w-0 items-center gap-2">
            <code class="truncate text-sm text-zinc-800">\${esc(display)}</code>
            <span class="h-7 w-7 shrink-0 rounded border border-zinc-200 shadow-sm" style="background:\${esc(color || "transparent")}"></span>
          </dd>
        </div>
      \`;
    };

    const confidence = (score) => {
      const pct = Math.max(0, Math.min(100, Math.round((score || 0) * 100)));
      const color = pct >= 75 ? "bg-emerald-100 text-emerald-800 border-emerald-200" : pct >= 45 ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-rose-100 text-rose-800 border-rose-200";
      return \`<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium \${color}">\${pct}%</span>\`;
    };

    const section = (title, body, aside = "") => \`
      <section class="border-t border-zinc-200 bg-white">
        <div class="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
          <div>
            <h2 class="label-mono text-xs font-semibold text-zinc-500">\${esc(title)}</h2>
            \${aside}
          </div>
          <div>\${body}</div>
        </div>
      </section>
    \`;

    const imgPanel = (label, src, options = {}) => {
      const id = label.toLowerCase().replace(/\\W+/g, "-");
      const key = options.key || id;
      const failed = state.imageErrors.has(id);
      const href = src && !src.startsWith("data:") ? \`<a class="text-xs text-zinc-500 underline underline-offset-2" href="\${esc(src)}" target="_blank" rel="noreferrer">open source</a>\` : "";
      const download = src ? \`
        <a class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900" href="/download?image=\${encodeURIComponent(key)}" title="Download \${esc(label)}" aria-label="Download \${esc(label)}">
          <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <path d="M7 10l5 5 5-5"></path>
            <path d="M12 15V3"></path>
          </svg>
        </a>
      \` : "";
      const actions = src ? \`<div class="flex items-center gap-2">\${href}\${download}</div>\` : "";
      const body = !src
        ? \`<div class="flex h-48 items-center justify-center text-sm text-zinc-400">No \${esc(label)} detected</div>\`
        : failed
          ? \`<div class="flex h-48 items-center justify-center px-4 text-center text-sm text-rose-600">Image failed to load</div>\`
          : \`<div class="checker flex h-48 items-center justify-center rounded-b-md p-5">
              <img src="\${esc(src)}" alt="\${esc(label)}" class="\${options.wide ? "max-h-full max-w-full" : "max-h-28 max-w-56"} object-contain" data-image-id="\${id}" />
            </div>\`;
      return \`
        <div class="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <div class="flex min-h-12 items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-100 px-4">
            <h3 class="label-mono text-xs font-semibold text-zinc-700">\${esc(label)}</h3>
            \${actions}
          </div>
          \${body}
        </div>
      \`;
    };

    const componentStyle = (label, style) => {
      if (!style) return "";
      const bg = style.background || "transparent";
      const color = style.textColor || "#111827";
      const border = style.borderColor || "transparent";
      const radius = style.borderRadius || "6px";
      const shadow = style.shadow && style.shadow !== "none" ? style.shadow : "none";
      return \`
        <div class="flex flex-wrap items-center gap-4 rounded-md border border-zinc-200 bg-white p-4">
          <button class="min-h-10 max-w-full truncate px-4 py-2 text-sm font-medium" style="background:\${esc(bg)}; color:\${esc(color)}; border:1px solid \${esc(border)}; border-radius:\${esc(radius)}; box-shadow:\${esc(shadow)}">
            \${esc(style.text || label)}
          </button>
          <dl class="grid min-w-0 flex-1 grid-cols-1 gap-x-5 gap-y-1 text-sm text-zinc-600 sm:grid-cols-3">
            <div><dt class="text-zinc-400">Background</dt><dd><code>\${esc(bg)}</code></dd></div>
            <div><dt class="text-zinc-400">Text</dt><dd><code>\${esc(color)}</code></dd></div>
            <div><dt class="text-zinc-400">Radius</dt><dd><code>\${esc(radius)}</code></dd></div>
          </dl>
        </div>
      \`;
    };

    const overview = () => {
      const data = state.data || {};
      const colors = data.colors || {};
      const images = data.images || {};
      const typography = data.typography || {};
      const components = data.components || {};
      const fonts = data.fonts || [];
      const diagnostics = data.diagnostics || {};
      const errors = diagnostics.errors || [];
      return \`
        \${errors.length ? section("Diagnostics", \`
          <div class="rounded-md border border-amber-200 bg-amber-50 p-4">
            <h3 class="text-sm font-semibold text-amber-900">Extraction diagnostics</h3>
            <ul class="mt-2 space-y-1 text-sm text-amber-800">
              \${errors.map((err) => \`<li><code>\${esc(err.context)}</code>: \${esc(err.message)}</li>\`).join("")}
            </ul>
          </div>\`) : ""}

        \${section("Images", \`
          <div class="grid gap-4 lg:grid-cols-3">
            \${imgPanel("Logo", data.logo || images.logo, { key: "logo" })}
            \${imgPanel("Favicon", images.favicon, { key: "favicon" })}
            \${imgPanel("OG Image", images.ogImage, { wide: true, key: "ogImage" })}
          </div>
        \`)}

        \${section("Components", \`
          <div class="space-y-3">
            \${componentStyle("Primary", components.buttonPrimary)}
            \${componentStyle("Secondary", components.buttonSecondary)}
            \${componentStyle("Input", components.input)}
            \${!components.buttonPrimary && !components.buttonSecondary && !components.input ? '<div class="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500">No component styles detected.</div>' : ""}
          </div>
        \`)}

        \${section("Tokens", \`
          <div class="grid gap-6 lg:grid-cols-3">
            <div class="rounded-md border border-zinc-200 bg-white p-4">
              <h3 class="label-mono mb-2 text-xs font-semibold text-zinc-800">Colors</h3>
              <dl>
                \${swatch("Primary", colors.primary)}
                \${swatch("Secondary", colors.secondary)}
                \${swatch("Accent", colors.accent)}
                \${swatch("Background", colors.background)}
                \${swatch("Text", colors.textPrimary)}
                \${swatch("Link", colors.link)}
              </dl>
            </div>
            <div class="rounded-md border border-zinc-200 bg-white p-4">
              <h3 class="label-mono mb-3 text-xs font-semibold text-zinc-800">Fonts</h3>
              <div class="space-y-2">
                \${fonts.length ? fonts.map((font) => \`
                  <div class="flex items-baseline justify-between gap-4">
                    <span class="truncate text-sm font-medium text-zinc-800">\${esc(font.family)}</span>
                    <span class="shrink-0 text-xs text-zinc-500">\${esc(font.role || (font.count ? font.count + "x" : ""))}</span>
                  </div>
                \`).join("") : '<p class="text-sm text-zinc-500">No custom fonts detected.</p>'}
              </div>
            </div>
            <div class="rounded-md border border-zinc-200 bg-white p-4">
              <h3 class="label-mono mb-3 text-xs font-semibold text-zinc-800">Typography</h3>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between gap-3"><dt class="text-zinc-500">Primary</dt><dd class="truncate font-mono">\${esc(typography.fontFamilies?.primary || "")}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-zinc-500">Heading</dt><dd class="truncate font-mono">\${esc(typography.fontFamilies?.heading || "")}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-zinc-500">H1</dt><dd class="font-mono">\${esc(typography.fontSizes?.h1 || "")}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-zinc-500">H2</dt><dd class="font-mono">\${esc(typography.fontSizes?.h2 || "")}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-zinc-500">Body</dt><dd class="font-mono">\${esc(typography.fontSizes?.body || "")}</dd></div>
              </dl>
            </div>
          </div>
        \`)}

        \${section("Spacing", \`
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-md border border-zinc-200 bg-white p-4"><div class="label-mono text-xs text-zinc-500">Base Unit</div><div class="mt-1 text-2xl font-semibold text-zinc-900">\${esc(data.spacing?.baseUnit ?? "")}</div></div>
            <div class="rounded-md border border-zinc-200 bg-white p-4"><div class="label-mono text-xs text-zinc-500">Border Radius</div><div class="mt-1 text-2xl font-semibold text-zinc-900">\${esc(data.spacing?.borderRadius ?? "")}</div></div>
            <div class="rounded-md border border-zinc-200 bg-white p-4"><div class="label-mono text-xs text-zinc-500">Theme</div><div class="mt-1 text-2xl font-semibold text-zinc-900">\${esc(data.colorScheme || "")}</div></div>
            <div class="rounded-md border border-zinc-200 bg-white p-4"><div class="label-mono text-xs text-zinc-500">Overall Confidence</div><div class="mt-2">\${confidence(data.confidence?.overall)}</div></div>
          </div>
        \`)}
      \`;
    };

    const rawPanel = () => \`
      \${section("JSON", \`
        <div class="overflow-hidden rounded-md border border-zinc-200 bg-zinc-950">
          <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <h3 class="label-mono text-xs font-semibold text-zinc-100">branding.json</h3>
            <button id="copy-json" class="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-900">Copy JSON</button>
          </div>
          <pre class="max-h-[70vh] overflow-auto p-4 text-xs leading-5 text-zinc-100"><code>\${esc(JSON.stringify(state.data, null, 2))}</code></pre>
        </div>
      \`)}
    \`;

    const debugPanel = () => {
      const debug = state.data?.debug || {};
      const candidates = debug.logoCandidates || [];
      const buttons = debug.buttons || [];
      return \`
        \${section("Logo Candidates", \`
          <div class="grid gap-3">
            \${candidates.length ? candidates.map((item, idx) => \`
              <div class="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 lg:grid-cols-[90px_1fr]">
                <div class="checker flex h-20 w-20 items-center justify-center rounded border border-zinc-200 p-2">
                  \${item.src ? \`<img src="\${esc(item.src)}" class="max-h-full max-w-full object-contain" alt="">\` : ""}
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-semibold text-zinc-900">#\${idx}</span>
                    <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">\${esc(item.location)}</span>
                    <span class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">\${item.isVisible ? "visible" : "hidden"}</span>
                  </div>
                  <p class="mt-2 truncate text-sm text-zinc-700">\${esc(item.alt || item.ariaLabel || item.title || "No label")}</p>
                  <p class="mt-1 truncate font-mono text-xs text-zinc-500">\${esc(item.src)}</p>
                  <p class="mt-2 text-xs text-zinc-500">\${Math.round(item.position?.width || 0)}x\${Math.round(item.position?.height || 0)} - href: \${esc(item.href || "none")}</p>
                </div>
              </div>
            \`).join("") : '<div class="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500">No logo candidates available. Run with --raw to include debug candidates.</div>'}
          </div>
        \`)}
        \${section("Button Candidates", \`
          <div class="grid gap-3">
            \${buttons.length ? buttons.map((button) => componentStyle("#" + button.index + " " + (button.text || "Button"), button)).join("") : '<div class="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500">No button candidates available. Run with --raw to include debug candidates.</div>'}
          </div>
        \`)}
      \`;
    };

    const render = () => {
      applyPreviewTheme();
      const data = state.data || {};
      const diagnostics = data.diagnostics || {};
      app.innerHTML = \`
        <header class="border-b border-zinc-200 bg-white">
          <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="truncate text-2xl font-semibold text-zinc-950">\${esc(data.brandName || "Branding Preview")}</h1>
                  <span class="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">\${esc(data.colorScheme || "unknown")}</span>
                </div>
                <p class="mt-1 truncate text-sm text-zinc-500">\${esc(data.finalUrl || data.url || "")}</p>
              </div>
            </div>
            <nav class="flex flex-wrap gap-2" aria-label="Preview tabs">
              \${["overview", "debug", "json"].map((tab) => \`
                <button class="rounded-md border px-3 py-2 text-sm font-medium \${state.tab === tab ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}" data-tab="\${tab}" aria-pressed="\${state.tab === tab}">\${tab[0].toUpperCase() + tab.slice(1)}</button>
              \`).join("")}
              <button class="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50" data-theme-toggle>Viewer: \${state.previewTheme === "dark" ? "Dark" : "Light"}</button>
              <a class="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50" href="/branding.json" target="_blank" rel="noreferrer">Open JSON</a>
            </nav>
            \${diagnostics.llm?.error ? \`<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">LLM enhancement did not run: \${esc(diagnostics.llm.error)}</div>\` : ""}
          </div>
        </header>
        <main>\${state.tab === "json" ? rawPanel() : state.tab === "debug" ? debugPanel() : overview()}</main>
      \`;

      app.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          state.tab = button.getAttribute("data-tab");
          render();
        });
      });
      app.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
        state.previewTheme = state.previewTheme === "dark" ? "light" : "dark";
        render();
      });
      app.querySelectorAll("img[data-image-id]").forEach((img) => {
        img.addEventListener("error", () => {
          state.imageErrors.add(img.getAttribute("data-image-id"));
          render();
        }, { once: true });
      });
      document.getElementById("copy-json")?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(JSON.stringify(state.data, null, 2));
      });
    };

    fetch("/branding.json")
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then((json) => {
        state.data = json;
        state.previewTheme = "light";
        render();
      })
      .catch((error) => {
        app.innerHTML = \`<div class="mx-auto max-w-3xl p-8"><div class="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-800">Failed to load branding JSON: \${esc(error.message)}</div></div>\`;
      });
  </script>
</body>
</html>`
}

function imageUrl(profile: BrandingProfile, key: string): string | null {
	const images = profile.images ?? {}
	if (key === "logo") return profile.logo || images.logo || null
	if (key === "favicon") return images.favicon || null
	if (key === "ogImage") return images.ogImage || null
	return null
}

function slug(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/^https?:\/\//, "")
			.replace(/^www\./, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "brand"
	)
}

function profileSlug(profile: BrandingProfile): string {
	if (profile.brandName) return slug(profile.brandName)
	const url = profile.finalUrl || profile.url
	if (!url) return "brand"
	try {
		return slug(new URL(url).hostname)
	} catch {
		return slug(url)
	}
}

function extensionFor(contentType: string, src: string): string {
	const mime = contentType.toLowerCase().split(";")[0]?.trim()
	if (mime === "image/svg+xml") return "svg"
	if (mime === "image/png") return "png"
	if (mime === "image/jpeg") return "jpg"
	if (mime === "image/webp") return "webp"
	if (mime === "image/gif") return "gif"
	if (mime === "image/x-icon" || mime === "image/vnd.microsoft.icon") return "ico"

	try {
		const ext = new URL(src).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]
		if (ext && !["html", "php", "aspx"].includes(ext.toLowerCase())) return ext.toLowerCase()
	} catch {
		const ext = src.match(/\.([a-z0-9]{2,5})(?:$|[?#])/i)?.[1]
		if (ext) return ext.toLowerCase()
	}
	return "bin"
}

function imageFilename(profile: BrandingProfile, key: string, contentType: string, src: string): string {
	const names: Record<string, string> = {
		logo: "logo",
		favicon: "favicon",
		ogImage: "og-image",
	}
	return `${profileSlug(profile)}-${names[key] ?? slug(key)}.${extensionFor(contentType, src)}`
}

function dataUrlResponse(profile: BrandingProfile, key: string, src: string): Response {
	const comma = src.indexOf(",")
	if (comma === -1) return new Response("Bad data URL", { status: 400 })
	const meta = src.slice("data:".length, comma)
	const contentType = meta.split(";")[0] || "application/octet-stream"
	const payload = src.slice(comma + 1)
	const body = meta.includes(";base64") ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload))
	return new Response(body, {
		headers: {
			"content-type": contentType,
			"content-disposition": `attachment; filename="${imageFilename(profile, key, contentType, src)}"`,
			"cache-control": "no-store",
		},
	})
}

async function downloadImage(profile: BrandingProfile, request: Request): Promise<Response> {
	const url = new URL(request.url)
	const key = url.searchParams.get("image") ?? ""
	const src = imageUrl(profile, key)
	if (!src) return new Response("Image not found", { status: 404 })
	if (src.startsWith("data:")) return dataUrlResponse(profile, key, src)

	let resolved = src
	try {
		resolved = new URL(src, profile.finalUrl || profile.url).href
	} catch {
		return new Response("Bad image URL", { status: 400 })
	}

	const response = await fetch(resolved, {
		headers: {
			"user-agent": "brandpull-preview/0.1",
		},
	})
	if (!response.ok) return new Response(`Could not fetch image: HTTP ${response.status}`, { status: 502 })

	const contentType = response.headers.get("content-type") || "application/octet-stream"
	return new Response(response.body, {
		headers: {
			"content-type": contentType,
			"content-disposition": `attachment; filename="${imageFilename(profile, key, contentType, resolved)}"`,
			"cache-control": "no-store",
		},
	})
}

async function startServer(
	profile: BrandingProfile,
	port: number,
	attempts = 20,
): Promise<{ server: ReturnType<typeof Bun.serve>; url: string }> {
	for (let offset = 0; offset < attempts; offset++) {
		const candidatePort = port + offset
		try {
			const server = Bun.serve({
				port: candidatePort,
				async fetch(request) {
					const url = new URL(request.url)
					if (url.pathname === "/branding.json") {
						return Response.json(profile, {
							headers: {
								"cache-control": "no-store",
							},
						})
					}
					if (url.pathname === "/download") {
						return downloadImage(profile, request)
					}
					if (url.pathname === "/" || url.pathname === "/index.html") {
						return new Response(html(profile), {
							headers: {
								"content-type": "text/html; charset=utf-8",
								"cache-control": "no-store",
							},
						})
					}
					return new Response("Not found", { status: 404 })
				},
			})
			return { server, url: `http://localhost:${candidatePort}` }
		} catch (error) {
			if (!isAddressInUse(error) || offset === attempts - 1) throw error
			process.stderr.write(`  Port ${candidatePort} is in use, trying ${candidatePort + 1}...\n`)
		}
	}
	throw new Error("No available preview port found")
}

function isAddressInUse(error: unknown): boolean {
	if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") return true
	const message = error instanceof Error ? error.message : String(error)
	return message.includes("EADDRINUSE") || message.includes("Address already in use")
}

export async function serveBrandingPreview(profile: BrandingProfile, options: PreviewOptions = {}): Promise<void> {
	const { server, url } = await startServer(profile, options.port ?? 4177)
	const label = options.open === false ? "Preview server running" : "Opening preview"
	process.stderr.write(`  ${label}: ${url}\n`)
	process.stderr.write("  Press Ctrl+C to stop the preview server.\n")

	if (options.open !== false) {
		Bun.spawn(["open", url], {
			stdout: "ignore",
			stderr: "ignore",
		})
	}

	await new Promise<void>((resolve) => {
		const stop = () => {
			server.stop(true)
			process.stderr.write("\n  Preview server stopped.\n")
			resolve()
		}
		process.once("SIGINT", stop)
		process.once("SIGTERM", stop)
	})
}
