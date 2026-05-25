import { useState, useEffect } from 'react'
import JSZip from 'jszip'
import './App.css'

const BASE = import.meta.env.BASE_URL
const ZIPS_BASE = import.meta.env.VITE_ZIPS_BASE_URL ?? null

// ── Per-game special-case rules (mirrors app.py patch logic) ────────────────

function applyKH1Rules(rowByPC, fileVersion, row, selected) {
  const pc = row['PC Number']
  if (pc === '99' && rowByPC['97']) fileVersion[rowByPC['97'].File] = selected
  if (pc === '106') {
    for (const n of ['107', '108', '109']) {
      if (rowByPC[n]) fileVersion[rowByPC[n].File] = selected
    }
  }
  if (pc === '113') {
    if (rowByPC['115']) fileVersion[rowByPC['115'].File] = selected
    if (rowByPC['114']) fileVersion[rowByPC['114'].File] = selected
  }
  if (pc === '132' && rowByPC['142']) fileVersion[rowByPC['142'].File] = selected
  if (pc === '156' && rowByPC['194']) fileVersion[rowByPC['194'].File] = selected
  if (pc === '196' && rowByPC['98']) fileVersion[rowByPC['98'].File] = selected
}

function applyKH2Rules(rowByPC, fileVersion, row, selected) {
  const pc = row['PC Number']
  if (pc === '120' && rowByPC['81']) fileVersion[rowByPC['81'].File] = selected
  if (pc === '124') {
    for (const n of ['122', '123', '125']) {
      if (rowByPC[n]) fileVersion[rowByPC[n].File] = selected
    }
  }
  if (pc === '149' && rowByPC['86']) fileVersion[rowByPC['86'].File] = selected
  if (pc === '530' && rowByPC['155']) fileVersion[rowByPC['155'].File] = selected
}

// ── Game configuration ────────────────────────────────────────────────────────

const GAMES = {
  kh1: {
    id: 'kh1',
    tabLabel: 'KH1',
    title: 'Kingdom Hearts 1',
    jsonFile: 'kh1.json',
    assetBase: 'kh1',
    patchFileName: 'Soundtrack.kh1pcpatch',
    emptyDirs: ['kh1_second/original/.gitkeep', 'kh1_first/original/.gitkeep'],
    applyRules: applyKH1Rules,
    switcherFile: 'kh1soundtrack.lua',
    switcherPatchFileName: 'kh1-Switcher.kh1pcpatch',
    switcherDesc: 'Switch between Custom, Classic, and Remastered soundtracks on the fly — no restart needed.',

    switcherCombos: [
      { keys: 'Select + R2 + Triangle', mode: 'Custom', desc: 'OpenKH / modded audio (prefix: amusic)' },
      { keys: 'Select + R2 + Circle',   mode: 'Remastered', desc: 'HD remastered audio (prefix: amusi3)' },
      { keys: 'Select + R2 + Cross',    mode: 'Classic', desc: 'PS2 classic audio (prefix: amusi2)' },
    ],
  },
  kh2: {
    id: 'kh2',
    tabLabel: 'KH2',
    title: 'Kingdom Hearts 2',
    jsonFile: 'kh2.json',
    assetBase: 'kh2',
    patchFileName: 'Soundtrack.kh2pcpatch',
    emptyDirs: [
      'kh2_fifth/remastered/.gitkeep',
      'kh2_first/remastered/.gitkeep',
      'kh2_sixth/remastered/.gitkeep',
    ],
    applyRules: applyKH2Rules,
    switcherFile: 'kh2soundtrack.lua',
    switcherPatchFileName: 'kh2-Switcher.kh2pcpatch',
    switcherDesc: 'Switch between Custom, Classic, and Remastered soundtracks on the fly — no restart needed.',

    switcherCombos: [
      { keys: 'Select + R2 + Triangle', mode: 'Custom', desc: 'OpenKH / modded audio (bgm / vagstream)' },
      { keys: 'Select + R2 + Circle',   mode: 'Remastered', desc: 'HD remastered audio (bg3 / vagstrea3)' },
      { keys: 'Select + R2 + Cross',    mode: 'Classic', desc: 'PS2 classic audio (bg2 / vagstrea2)' },
    ],
  },
}

// ── GameDownloadsView ─────────────────────────────────────────────────────────

function GameDownloadsView({ game, visible }) {
  return (
    <div style={{ display: visible ? 'block' : 'none' }}>
      <header>
        <h2>{game.title} — Downloads</h2>
        <p className="subtitle">
          Download both track packs. You'll need them to use the Selector tab.
        </p>
      </header>

      <div className="download-cards">
        {['Classic', 'Remastered'].map(version => (
          <div key={version} className="download-card">
            <h3>{version}</h3>
            <p>
              {version === 'Classic'
                ? 'Original PS2 synthesised / MIDI soundtrack.'
                : 'Fully orchestrated HD re-recording from the 1.5+2.5 HD ReMIX collection.'}
            </p>
            {ZIPS_BASE ? (
              <a
                className="btn"
                href={`${ZIPS_BASE}/${game.assetBase}-${version}.${game.id}pcpatch`}
              >
                Download {version}
              </a>
            ) : (
              <span className="msg-error">Download URL not configured.</span>
            )}
          </div>
        ))}
      </div>

      <p className="note" style={{ marginTop: '20px' }}>
        After downloading, go to the <strong>{game.title} Selector</strong> tab, upload both patches, choose your preferred tracks, and generate your custom <code>.{game.id}pcpatch</code> — then install it with <strong>OpenKH Mods Manager</strong>.
      </p>
    </div>
  )
}

// ── GameSelectorView ──────────────────────────────────────────────────────────

function GameSelectorView({ game, visible }) {
  const [allRows, setAllRows] = useState([])
  const [displayRows, setDisplayRows] = useState([])
  const [preset, setPreset] = useState('Classic')
  const [selections, setSelections] = useState({})
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [classicPatch, setClassicPatch] = useState(null)
  const [remasteredPatch, setRemasteredPatch] = useState(null)
  const [patchStatus, setPatchStatus] = useState({ classic: null, remastered: null })

  useEffect(() => {
    fetch(`${BASE}${game.jsonFile}`)
      .then(r => r.json())
      .then(data => {
        setAllRows(data)
        const filtered = data
          .filter(r => r.Changed === 'Y' && r.Main === 'Y')
          .sort((a, b) => a.Name.localeCompare(b.Name))
        setDisplayRows(filtered)
        const initSel = {}
        filtered.forEach(r => { initSel[r.File] = 'Classic' })
        setSelections(initSel)
      })
  }, [game])

  async function handlePatchUpload(version, file) {
    const key = version.toLowerCase()
    setPatchStatus(prev => ({ ...prev, [key]: 'loading' }))
    try {
      const patch = await JSZip.loadAsync(file)
      if (version === 'Classic') setClassicPatch(patch)
      else setRemasteredPatch(patch)
      setPatchStatus(prev => ({ ...prev, [key]: 'ready' }))
    } catch {
      setPatchStatus(prev => ({ ...prev, [key]: 'error' }))
    }
  }

  function applyPreset(p) {
    setPreset(p)
    setSelections(prev => {
      const next = { ...prev }
      displayRows.forEach(r => { next[r.File] = p })
      return next
    })
  }

  function setSelection(file, version) {
    setSelections(prev => ({ ...prev, [file]: version }))
  }

  async function handleGetPatch() {
    setStatus('generating')
    setProgress({ current: 0, total: 0 })
    try {
      await generatePatch(game, allRows, selections, setProgress, classicPatch, remasteredPatch)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setStatus('error')
    }
  }

  const patchesReady = patchStatus.classic === 'ready' && patchStatus.remastered === 'ready'

  return (
    <div style={{ display: visible ? 'block' : 'none' }}>
      <header>
        <h2>{game.title} — Selector</h2>
        <p className="subtitle">Build a custom patch with a different choice of Classic or Remastered audio for each individual track.</p>
      </header>

      <div className="upload-row">
        {['Classic', 'Remastered'].map(version => {
          const key = version.toLowerCase()
          return (
            <div key={version} className="upload-card">
              <span className="upload-label">{version} patch</span>
              <label className="upload-file-btn btn">
                {patchStatus[key] === 'ready' ? `${version} ✓` : `Choose ${version} patch`}
                <input
                  type="file"
                  accept={`.${game.id}pcpatch`}
                  style={{ display: 'none' }}
                  onChange={e => e.target.files[0] && handlePatchUpload(version, e.target.files[0])}
                />
              </label>
              <PatchStatusBadge status={patchStatus[key]} />
            </div>
          )
        })}
      </div>

      {!patchesReady && (
        <p className="note" style={{ marginTop: '12px' }}>
          Upload both patches to enable the selector. Download them from the <strong>{game.title} Downloads</strong> tab if you don't have them yet. Once you generate the patch, install it using <strong>OpenKH Mods Manager</strong>.
        </p>
      )}

      {patchesReady && displayRows.length > 0 && (
        <>
          <div className="preset-bar">
            <span>Preset (sets all tracks):</span>
            <label>
              <input
                type="radio"
                name={`${game.id}-preset`}
                value="Classic"
                checked={preset === 'Classic'}
                onChange={() => applyPreset('Classic')}
              />
              Classic
            </label>
            <label>
              <input
                type="radio"
                name={`${game.id}-preset`}
                value="Remastered"
                checked={preset === 'Remastered'}
                onChange={() => applyPreset('Remastered')}
              />
              Remastered
            </label>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Classic</th>
                  <th>Remastered</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(row => {
                  const file2 = row.File.replace('.scd', '.ogg')
                  const sel = selections[row.File] || 'Classic'
                  const previewBase = `${BASE}${game.assetBase}/previews`

                  return (
                    <tr key={row.File}>
                      <td className="td-name">{row.Name}</td>
                      <td className="td-desc">{row.Description}</td>

                      <td className="td-version">
                        <input
                          type="radio"
                          name={`${game.id}-${row.File}`}
                          value="Classic"
                          checked={sel === 'Classic'}
                          onChange={() => setSelection(row.File, 'Classic')}
                          aria-label={`${row.Name} – Classic`}
                        />
                        <audio controls preload="none">
                          <source src={`${previewBase}/Classic/${file2}`} type="audio/ogg" />
                        </audio>
                      </td>

                      <td className="td-version">
                        <input
                          type="radio"
                          name={`${game.id}-${row.File}`}
                          value="Remastered"
                          checked={sel === 'Remastered'}
                          onChange={() => setSelection(row.File, 'Remastered')}
                          aria-label={`${row.Name} – Remastered`}
                        />
                        <audio controls preload="none">
                          <source src={`${previewBase}/Remastered/${file2}`} type="audio/ogg" />
                        </audio>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bottom-bar">
            <button onClick={handleGetPatch} disabled={status === 'generating'}>
              {status === 'generating' ? 'Generating…' : 'Get Patch'}
            </button>

            {status === 'generating' && progress.total > 0 && (
              <span className="progress-text">
                {progress.label}: {progress.current} / {progress.total}
              </span>
            )}
            {status === 'done' && (
              <span className="msg-success">
                Patch created successfully! Check your downloads folder.
              </span>
            )}
            {status === 'error' && (
              <span className="msg-error">
                Failed to generate patch. Make sure both patches are valid and check the browser console.
              </span>
            )}
          </div>

          <p className="note">After clicking "Get Patch", wait for the download to begin.</p>
        </>
      )}
    </div>
  )
}

// ── Patch status badge ───────────────────────────────────────────────────────

function PatchStatusBadge({ status }) {
  if (!status) return null
  if (status === 'loading') return <span className="zip-badge zip-loading">Loading…</span>
  if (status === 'ready') return <span className="zip-badge zip-ready">Ready</span>
  if (status === 'error') return <span className="zip-badge zip-error">Invalid patch</span>
  return null
}

// ── GameSwitcherView ─────────────────────────────────────────────────────────

function GameSwitcherView({ game, visible }) {
  return (
    <div style={{ display: visible ? 'block' : 'none' }}>
      <header>
        <h2>{game.title} — Soundtrack Switcher</h2>
        <p className="subtitle">{game.switcherDesc}</p>
      </header>

      <div className="switcher-cards">
        <div className="switcher-card">
          <h3>Requirements</h3>
          <ul>
            <li><strong>OpenKH Mods Manager</strong> must be installed.</li>
          </ul>
        </div>

        <div className="switcher-card">
          <h3>Installation</h3>
          <p>Install both the Switcher patch and the Lua script using <strong>OpenKH Mods Manager</strong>.</p>
        </div>

        <div className="switcher-card switcher-card-full">
          <h3>Downloads</h3>
          <div className="switcher-dl-list">
            <div className="switcher-dl-item">
              <div className="switcher-dl-info">
                <strong>Lua Script</strong>
              </div>
              <a
                className="btn"
                href={`${BASE}${game.switcherFile}`}
                download={game.switcherFile}
              >
                Download {game.switcherFile}
              </a>
            </div>

            <div className="switcher-dl-item">
              <div className="switcher-dl-info">
                <strong>Switcher Patch</strong>
                <span className="switcher-dl-desc">Includes both Classic and Remastered audio for in-game switching</span>
              </div>
              {ZIPS_BASE ? (
                <a
                  className="btn"
                  href={`${ZIPS_BASE}/${game.switcherPatchFileName}`}
                >
                  Download Switcher Patch
                </a>
              ) : (
                <span className="msg-error">Download URL not configured.</span>
              )}
            </div>
          </div>
        </div>

        <div className="switcher-card switcher-card-full">
          <h3>In-Game Button Combos</h3>
          <p className="switcher-note">Defaults to <strong>Custom</strong> on each script load.</p>
          <table className="switcher-table">
            <thead>
              <tr>
                <th>Buttons</th>
                <th>Mode</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {game.switcherCombos.map(c => (
                <tr key={c.mode}>
                  <td><code>{c.keys}</code></td>
                  <td className="switcher-mode">{c.mode}</td>
                  <td className="switcher-desc">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── About tab ─────────────────────────────────────────────────────────────────

function AboutView({ visible }) {
  return (
    <div style={{ display: visible ? 'block' : 'none' }}>
      <div className="about-view">
        <h2>KH1 &amp; KH2 Classic Soundtrack Mods</h2>
        <p className="subtitle">
          A collection of OpenKH-based music mods and a tool for the Kingdom Hearts PC collection.
          Mix and match Classic (PS2) and Remastered (HD ReMIX) tracks per-song, or restore the
          full PS2 soundtrack in one click. Includes an in-game Soundtrack Switcher.
        </p>

        <div className="about-section">
          <h3>Overview</h3>
          <p>This project covers six mods:</p>
          <table className="about-table">
            <thead>
              <tr><th>Mod</th><th>Game</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td>Classic Soundtrack</td><td>KH1FM PC</td><td>Replaces the full KH1 PC soundtrack with the original PS2 version</td></tr>
              <tr><td>Classic Soundtrack</td><td>KH2FM PC</td><td>Replaces the full KH2 PC soundtrack with the original PS2 version</td></tr>
              <tr><td>Track Selector</td><td>KH1FM PC</td><td>Tool to build a custom per-track mix of Classic and Remastered audio</td></tr>
              <tr><td>Track Selector</td><td>KH2FM PC</td><td>Tool to build a custom per-track mix of Classic and Remastered audio</td></tr>
              <tr><td>Soundtrack Switcher</td><td>KH1FM PC</td><td>Switch between Custom / Classic / Remastered in-game via button combos</td></tr>
              <tr><td>Soundtrack Switcher</td><td>KH2FM PC</td><td>Switch between Custom / Classic / Remastered in-game via button combos</td></tr>
            </tbody>
          </table>
        </div>

        <div className="about-section">
          <h3>Requirements</h3>
          <ul>
            <li>
              <strong>OpenKH</strong> with <strong>Panacea</strong> and <strong>Lua Backend</strong> installed and configured
              {' '}— <a className="about-link" href="https://github.com/OpenKH/OpenKh/releases" target="_blank" rel="noreferrer">Download</a>
            </li>
          </ul>
        </div>

        <div className="about-section">
          <h3>Classic Soundtrack — Installation</h3>
          <p>Download <code>Soundtrack.kh1pcpatch</code> (KH1) or <code>Soundtrack.kh2pcpatch</code> (KH2) and install it using <strong>OpenKH Mods Manager</strong>.</p>
          <p className="about-note-inline">Note: This mod does not replace the Atlantica minigame songs in KH2 to avoid conflicts with dub mods.</p>
        </div>

        <div className="about-section">
          <h3>Track Selector — Installation</h3>
          <p>Build a custom patch with a different choice of Classic or Remastered audio for each individual track.</p>
          <ol>
            <li>Open the <strong>Downloads</strong> tab for KH1 or KH2 and download both the Classic and Remastered patch files.</li>
            <li>Switch to the <strong>Selector</strong> tab, upload both patches, choose a version per track, and click <strong>Get Patch</strong>.</li>
            <li>Install the generated <code>.kh1pcpatch</code> / <code>.kh2pcpatch</code> file using <strong>OpenKH Mods Manager</strong>.</li>
          </ol>
        </div>

        <div className="about-section">
          <h3>Soundtrack Switcher — Installation</h3>
          <p>Switch between Custom, Classic, and Remastered soundtracks on the fly — no restart needed.</p>
          <p>Install both the Switcher patch and the Lua script using <strong>OpenKH Mods Manager</strong>.</p>
        </div>

        <div className="about-section">
          <h3>Track Versions</h3>
          <ul>
            <li><strong>Classic</strong> — Original PS2 synthesised / MIDI soundtrack.</li>
            <li><strong>Remastered</strong> — Fully orchestrated HD re-recording from the 1.5+2.5 HD ReMIX collection.</li>
            <li><strong>Custom</strong> (Switcher only) — Your installed OpenKH mods / default PC audio.</li>
          </ul>
        </div>

        <div className="about-section">
          <h3>Credits</h3>
          <ul>
            <li><strong>ThePenitentTextures1</strong> — Found the loop points for the Classic Soundtrack tracks.</li>
            <li><strong>OpenKH Community Contributors</strong> — Their knowledge and tools make extracting and patching the game files possible.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'downloads', label: 'Downloads' },
  { id: 'selector',  label: 'Selector'  },
  { id: 'switcher',  label: 'Switcher'  },
]

export default function App() {
  const [activeSection, setActiveSection] = useState('about')   // 'about' | 'kh1' | 'kh2'
  const [activeSubTab, setActiveSubTab]   = useState('downloads') // 'downloads' | 'selector' | 'switcher'

  return (
    <div className="app">
      <nav className="navbar">
        <button
          className={`nav-btn${activeSection === 'about' ? ' active' : ''}`}
          onClick={() => setActiveSection('about')}
        >
          About
        </button>
        {Object.values(GAMES).map(g => (
          <button
            key={g.id}
            className={`nav-btn${activeSection === g.id ? ' active' : ''}`}
            onClick={() => setActiveSection(g.id)}
          >
            {g.title}
          </button>
        ))}
      </nav>

      <div className="main-content">
        {activeSection !== 'about' && (
          <div className="subtab-bar">
            {SUB_TABS.map(s => (
              <button
                key={s.id}
                className={`subtab-btn${activeSubTab === s.id ? ' active' : ''}`}
                onClick={() => setActiveSubTab(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <AboutView visible={activeSection === 'about'} />

        {Object.values(GAMES).flatMap(game => [
          <GameDownloadsView key={`${game.id}-dl`}  game={game} visible={activeSection === game.id && activeSubTab === 'downloads'} />,
          <GameSelectorView  key={`${game.id}-sel`} game={game} visible={activeSection === game.id && activeSubTab === 'selector'}  />,
          <GameSwitcherView  key={`${game.id}-sw`}  game={game} visible={activeSection === game.id && activeSubTab === 'switcher'}  />,
        ])}
      </div>
    </div>
  )
}

// ── Patch generation ──────────────────────────────────────────────────────────

async function generatePatch(game, allRows, selections, setProgress, classicPatch, remasteredPatch) {
  // Build filename → version map, propagating dependent track selections via applyRules
  const rowByPC = {}
  for (const row of allRows) rowByPC[row['PC Number']] = row

  const fileVersion = {}
  for (const row of allRows.filter(r => r.Main === 'Y' && r.Changed === 'Y')) {
    const selected = selections[row.File] || 'Classic'
    fileVersion[row.File] = selected
    game.applyRules(rowByPC, fileVersion, row, selected)
  }

  // Classic patch defines the full set of paths (both patches share identical structure)
  const allPaths = Object.keys(classicPatch.files).filter(p => !classicPatch.files[p].dir)

  // Supplement with Remastered-only forced tracks (Main: N, Changed: Y, not set by applyRules)
  const forcedRemasteredNames = new Set(
    allRows
      .filter(r => r.Main === 'N' && r.Changed === 'Y' && !fileVersion[r.File])
      .map(r => r.File)
  )
  const remasteredExtraPaths = Object.keys(remasteredPatch.files)
    .filter(p => !remasteredPatch.files[p].dir && forcedRemasteredNames.has(p.split('/').pop()))
  for (const p of remasteredExtraPaths) fileVersion[p.split('/').pop()] = 'Remastered'
  const combinedPaths = [...allPaths, ...remasteredExtraPaths]

  const outputPatch = new JSZip()
  for (const placeholder of game.emptyDirs) {
    outputPatch.file(placeholder, '')
  }

  setProgress({ current: 0, total: combinedPaths.length, label: 'Building patch' })
  let done = 0

  await Promise.all(combinedPaths.map(async path => {
    const filename = path.split('/').pop()
    const version = fileVersion[filename] ?? 'Classic'
    const sourcePatch = version === 'Remastered' ? remasteredPatch : classicPatch
    const entry = sourcePatch.file(path)
    if (entry) {
      const data = await entry.async('arraybuffer')
      outputPatch.file(path, data)
    }
    setProgress({ current: ++done, total: combinedPaths.length, label: 'Building patch' })
  }))

  const blob = await outputPatch.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = game.patchFileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
