// Headless screenshot via CDP with console capture.
// Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs]
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import WebSocket from 'ws'

const [url, out, w = '1440', h = '900', waitMs = '9000'] = process.argv.slice(2)
const chrome = `${homedir()}/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`
const port = 9222 + Math.floor(1000 * (Number(String(process.pid).slice(-3)) / 1000))

const proc = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=vulkan',
  '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`,
  `--window-size=${w},${h}`,
  '--hide-scrollbars',
  'about:blank',
])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(1500)

const targets = await (await fetch(`http://localhost:${port}/json`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.once('open', r))

let id = 0
const pending = new Map()
ws.on('message', (raw) => {
  const msg = JSON.parse(raw)
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg)
  if (msg.method === 'Runtime.consoleAPICalled') {
    const args = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
    console.log(`[console.${msg.params.type}]`, args)
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    console.log('[exception]', JSON.stringify(msg.params.exceptionDetails, null, 2).slice(0, 2000))
  }
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id
    pending.set(mid, resolve)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })

await send('Runtime.enable')
await send('Page.enable')
if (process.env.TOKEN) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('ecopermit.token', ${JSON.stringify(process.env.TOKEN)})`,
  })
}
if (process.env.DARK) {
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  })
}
await send('Page.navigate', { url })
await sleep(Number(waitMs))
const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
console.log('wrote', out)
ws.close()
proc.kill()
process.exit(0)
