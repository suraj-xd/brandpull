const Y = "\x1b[33m"
const D = "\x1b[90m"
const RST = "\x1b[0m"

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const CLEAR = "\x1b[2K"

export function createSpinner(label: string) {
	const started = performance.now()
	const enabled = process.stderr.isTTY
	let frame = 0
	let text = label
	let stopped = false
	let timer: ReturnType<typeof setInterval> | null = null

	const render = () => {
		if (stopped) return
		const elapsed = ((performance.now() - started) / 1000).toFixed(1)
		const spin = `${Y}${SPINNER[frame % SPINNER.length]}${RST}`
		frame++
		process.stderr.write(`\r${CLEAR}  ${spin} ${text} ${D}${elapsed}s${RST}`)
	}

	if (enabled) {
		render()
		timer = setInterval(render, 80)
	} else {
		process.stderr.write(`  ${label}...\n`)
	}

	return {
		update(next: string) {
			text = next
			if (enabled) render()
			else process.stderr.write(`  ${next}...\n`)
		},
		stop(message?: string) {
			if (stopped) return
			stopped = true
			if (timer) clearInterval(timer)
			if (enabled) process.stderr.write(`\r${CLEAR}`)
			if (message) process.stderr.write(`  ${message}\n`)
		},
	}
}
