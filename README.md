# brandpull

Extract clean branding JSON from any public website: logos, favicons, OG images, colors, fonts, typography, spacing, and component styles.

![brandpull preview showing Exa branding tokens](assets/brandpull-preview-exa.png)

## Install

Requires [Bun](https://bun.sh), because the CLI runs TypeScript directly with Bun.

```bash
# Run without installing
bunx brandpull https://exa.ai

# Or install globally with Bun
bun install -g brandpull

# npm works too, as long as Bun is installed on your PATH
npm install -g brandpull
```

## Quick Start

```bash
# Extract branding JSON, save it, and open the local preview
brandpull https://exa.ai

# Save to a custom file
brandpull https://exa.ai -o exa-branding.json

# Reopen an existing branding JSON file
brandpull preview exa-branding.json
```

## Branding Commands

```bash
brandpull <url> [options]
brandpull branding <url> [options]
brandpull brand <url> [options]
brandpull preview <file.json> [options]
```

Options:

```txt
-o, --out <file>    Write branding JSON to a file instead of stdout
--web-preview       Open a local browser preview for the branding JSON
--no-preview        Save JSON without starting the preview in shorthand mode
--preview-port <n>  Preferred preview server port (default: 4177)
--no-open           Start preview server without opening a browser
--llm               Use optional OpenAI enhancement when OPENAI_API_KEY is set
--raw               Include raw logo/button/background candidates
--wait <ms>         Extra page settle wait (default: 2000)
--timeout <ms>      Page navigation timeout (default: 30000)
```

If the preview port is already busy, `brandpull` automatically tries the next port.

## Examples

```bash
# Save exa-ai-branding.json and open the preview
brandpull https://exa.ai

# Save the branding profile
brandpull branding https://ramp.com -o ramp-branding.json

# Capture debug candidates and inspect them visually
brandpull branding https://exa.ai --raw --web-preview

# Preview a local JSON file without scraping again
brandpull preview ramp-branding.json

# Use the optional LLM cleanup pass
OPENAI_API_KEY=... brandpull branding https://linear.app --llm -o linear-branding.json
```

## How Branding Works

Branding mode renders the page in Chromium, waits for it to settle, then collects computed styles and page metadata from the live DOM. It pulls logo candidates from images and SVGs, captures favicons and OG images, samples colors from real elements, reads typography stacks, and snapshots buttons/inputs with their rendered CSS.

The processor then scores those candidates into a stable profile. If navigation, image loading, or optional LLM enhancement fails, the command still returns JSON with diagnostics so you can see what happened in the preview.

## Output Shape

```json
{
  "brandName": "Exa",
  "url": "https://exa.ai/",
  "logo": "https://exa.ai/...",
  "images": {
    "favicon": "https://exa.ai/favicon.ico",
    "ogImage": "https://exa.ai/..."
  },
  "colors": {
    "primary": "#ffffff",
    "accent": "#e5e5e5",
    "background": "#0a0a0a",
    "textPrimary": "#ffffff"
  },
  "fonts": [],
  "typography": {},
  "components": {},
  "confidence": {}
}
```

## Requirements

- [Bun](https://bun.sh)
- Playwright browser dependencies for rendered branding extraction

## License

MIT
