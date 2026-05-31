import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const sourceBase = process.env.VITE_ZIPS_BASE_URL || process.env.ZIPS_BASE_URL || ''
const outputDir = path.join(rootDir, '.generated', 'switcher-patches')

const targets = [
  { patch: 'kh1-Switcher.kh1pcpatch', lua: 'kh1soundtrack.lua' },
  { patch: 'kh2-Switcher.kh2pcpatch', lua: 'kh2soundtrack.lua' },
]

if (!sourceBase) {
  const msg = '[prepare-switcher] VITE_ZIPS_BASE_URL not set; cannot generate bundled switcher patches.'
  if (process.env.CI) {
    throw new Error(msg)
  }
  console.warn(`${msg} Skipping in local environment.`)
  process.exit(0)
}

await mkdir(outputDir, { recursive: true })

for (const target of targets) {
  const sourceUrl = `${sourceBase.replace(/\/$/, '')}/${target.patch}`
  const luaPath = path.join(rootDir, 'public', target.lua)
  const outPath = path.join(outputDir, target.patch)

  const luaContent = await readFile(luaPath, 'utf8')
  const res = await fetch(sourceUrl)
  if (!res.ok) {
    throw new Error(`[prepare-switcher] Failed to download ${sourceUrl}: ${res.status}`)
  }

  const buffer = await res.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  const luaEntries = Object.keys(zip.files).filter(
    p => !zip.files[p].dir && p.toLowerCase().endsWith('.lua')
  )

  if (luaEntries.length > 0) {
    for (const entry of luaEntries) {
      zip.file(entry, luaContent)
    }
  } else {
    zip.file(target.lua, luaContent)
    zip.file(`scripts/${target.lua}`, luaContent)
  }

  const patched = await zip.generateAsync({ type: 'nodebuffer' })
  await writeFile(outPath, patched)
  console.log(`[prepare-switcher] Wrote ${path.relative(rootDir, outPath)}`)
}
