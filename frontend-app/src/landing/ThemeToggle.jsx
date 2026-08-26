import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Palette, Type, Layers, Copy, CheckCheck } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Preset definitions
   ═══════════════════════════════════════════════════════════════ */

const accentPresets = [
  { id: 'slate', label: 'Slate',
    light: { accent: '#e0e0e0', accentFg: '#050505', accentDim: '#666666' },
    dark:  { accent: '#e0e0e0', accentFg: '#050505', accentDim: '#888888' } },
  { id: 'indigo', label: 'Indigo',
    light: { accent: '#6366f1', accentFg: '#ffffff', accentDim: '#4f46e5' },
    dark:  { accent: '#818cf8', accentFg: '#0b0b17', accentDim: '#6366f1' } },
  { id: 'emerald', label: 'Emerald',
    light: { accent: '#10b981', accentFg: '#ffffff', accentDim: '#059669' },
    dark:  { accent: '#34d399', accentFg: '#071410', accentDim: '#10b981' } },
  { id: 'violet', label: 'Violet',
    light: { accent: '#8b5cf6', accentFg: '#ffffff', accentDim: '#7c3aed' },
    dark:  { accent: '#a78bfa', accentFg: '#120b1a', accentDim: '#8b5cf6' } },
  { id: 'amber', label: 'Amber',
    light: { accent: '#f59e0b', accentFg: '#1a1206', accentDim: '#d97706' },
    dark:  { accent: '#fbbf24', accentFg: '#1a1206', accentDim: '#f59e0b' } },
  { id: 'rose', label: 'Rose',
    light: { accent: '#f43f5e', accentFg: '#ffffff', accentDim: '#e11d48' },
    dark:  { accent: '#fb7185', accentFg: '#1a0a0f', accentDim: '#f43f5e' } },
]

const textPresets = [
  { id: 'warm', label: 'Warm White', dark: '#f5f0e8', light: '#2a2520' },
  { id: 'cool', label: 'Cool White', dark: '#e8edf5', light: '#1a1f2e' },
  { id: 'soft', label: 'Soft Gray', dark: '#b8b8b8', light: '#555555' },
  { id: 'ivory', label: 'Ivory', dark: '#fffff0', light: '#1a1a1a' },
  { id: 'platinum', label: 'Platinum', dark: '#d4d4d4', light: '#333333' },
]

const surfacePresets = [
  { id: 'void', label: 'Void' },
  { id: 'slate', label: 'Slate' },
  { id: 'ink', label: 'Ink' },
  { id: 'charcoal', label: 'Charcoal' },
  { id: 'sand', label: 'Sand' },
]

const SURFACE_PRESET_DATA = {
  void: {
    dark:  { bg: '#050505', surface: '#0c0c0c', 'surface-2': '#141414', 'surface-3': '#1e1e1e', border: '#2a2a2a', 'border-subtle': '#1a1a1a' },
    light: { bg: '#ffffff', surface: '#f7f7f5', 'surface-2': '#efeeea', 'surface-3': '#e5e3dc', border: '#ddd9d0', 'border-subtle': '#ebe9e3' },
  },
  slate: {
    dark:  { bg: '#060809', surface: '#0d1012', 'surface-2': '#15191c', 'surface-3': '#1f2428', border: '#2b3136', 'border-subtle': '#181c1f' },
    light: { bg: '#f8fafb', surface: '#eef1f3', 'surface-2': '#e3e7ea', 'surface-3': '#d5dbdf', border: '#c9d0d5', 'border-subtle': '#e9ecee' },
  },
  ink: {
    dark:  { bg: '#05060c', surface: '#0b0d17', 'surface-2': '#121523', 'surface-3': '#1b1f30', border: '#2a2f45', 'border-subtle': '#171a26' },
    light: { bg: '#f6f7fb', surface: '#ebedf5', 'surface-2': '#dfe2ef', 'surface-3': '#cfd3e5', border: '#c3c8dc', 'border-subtle': '#e6e8f2' },
  },
  charcoal: {
    dark:  { bg: '#0a0a09', surface: '#121110', 'surface-2': '#1a1917', 'surface-3': '#242220', border: '#322f2b', 'border-subtle': '#1c1a18' },
    light: { bg: '#faf9f7', surface: '#f0efec', 'surface-2': '#e6e4df', 'surface-3': '#d8d5cd', border: '#ccc8bf', 'border-subtle': '#efeee9' },
  },
  sand: {
    dark:  { bg: '#0d0a06', surface: '#16110b', 'surface-2': '#201a11', 'surface-3': '#2c2418', border: '#3d3222', 'border-subtle': '#1a1510' },
    light: { bg: '#fdfaf5', surface: '#f5efe4', 'surface-2': '#ede4d3', 'surface-3': '#ded1b8', border: '#cbbc98', 'border-subtle': '#f1ebdf' },
  },
}

/* ═══════════════════════════════════════════════════════════════
   Color utility helpers
   ═══════════════════════════════════════════════════════════════ */

function hexToRgb(hex) {
  const m = hex.match(/^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i)
  if (!m) return { r: 0, g: 0, b: 0 }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
}

function getLuminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

function getContrastRatio(lum1, lum2) {
  const l1 = Math.max(lum1, lum2) + 0.05
  const l2 = Math.min(lum1, lum2) + 0.05
  return l1 / l2
}

function hexToHsl(hex) {
  let { r, g, b } = hexToRgb(hex)
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return { h: h * 360, s, l }
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r, g, b
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

function darkenColor(hex, amount = 0.15) {
  const hsl = hexToHsl(hex)
  hsl.l = Math.max(0, hsl.l - amount)
  hsl.s = Math.max(0, hsl.s - 0.1)
  return hslToHex(hsl.h, hsl.s, hsl.l)
}

function getAutoVariant(hex, fromTheme, toTheme) {
  if (fromTheme === toTheme) return hex
  const hsl = hexToHsl(hex)
  if (toTheme === 'dark') {
    hsl.l = Math.max(0.15, hsl.l - 0.18)
    hsl.s = Math.min(1, hsl.s * 1.05)
  } else {
    hsl.l = Math.min(0.95, hsl.l + 0.18)
    hsl.s = Math.max(0, hsl.s * 0.95)
  }
  return hslToHex(hsl.h, hsl.s, hsl.l)
}

function deriveAccentColors(hex) {
  const rgb = hexToRgb(hex)
  const lum = getLuminance(rgb.r, rgb.g, rgb.b)
  const accentFg = lum > 0.5 ? '#0a0a0a' : '#ffffff'
  const accentDim = darkenColor(hex, 0.15)
  return { accent: hex, accentFg, accentDim }
}

function enforceContrast(hex, bgHex = '#050505', minRatio = 4.5) {
  const bgRgb = hexToRgb(bgHex)
  const bgLum = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b)
  let rgb = hexToRgb(hex)
  let lum = getLuminance(rgb.r, rgb.g, rgb.b)
  let ratio = getContrastRatio(lum, bgLum)
  if (ratio >= minRatio) return hex

  const hsl = hexToHsl(hex)
  let attempts = 0
  while (ratio < minRatio && attempts < 30) {
    hsl.l = Math.min(0.98, hsl.l + 0.04)
    const candidate = hslToHex(hsl.h, hsl.s, hsl.l)
    rgb = hexToRgb(candidate)
    lum = getLuminance(rgb.r, rgb.g, rgb.b)
    ratio = getContrastRatio(lum, bgLum)
    attempts++
  }
  return hslToHex(hsl.h, hsl.s, hsl.l)
}

/* ═══════════════════════════════════════════════════════════════
   ThemeToggle Component
   ═══════════════════════════════════════════════════════════════ */

export default function ThemeToggle({ theme }) {
  const [accentPresetIndex, setAccentPresetIndex] = useState(0)
  const [accentMode, setAccentMode] = useState('preset')
  const [textPresetIndex, setTextPresetIndex] = useState(0)
  const [textMode, setTextMode] = useState('preset')
  const [surfacePresetIndex, setSurfacePresetIndex] = useState(0)
  const [surfaceMode, setSurfaceMode] = useState('preset')
  const [customAccent, setCustomAccent] = useState({ dark: null, light: null })
  const [customText, setCustomText] = useState({ dark: null, light: null })
  const [lastChanged, setLastChanged] = useState(null)
  const [labelVisible, setLabelVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const hideTimer = useRef(null)
  const accentInputRef = useRef(null)
  const textInputRef = useRef(null)
  const containerRef = useRef(null)

  const showLabel = useCallback(() => {
    setLabelVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setLabelVisible(false), 1400)
  }, [])

  useEffect(() => () => hideTimer.current && clearTimeout(hideTimer.current), [])

  const resolvedAccent = useMemo(() => {
    if (accentMode !== 'custom') return null
    if (customAccent[theme]) return customAccent[theme]
    const other = theme === 'dark' ? 'light' : 'dark'
    if (customAccent[other]) {
      const auto = getAutoVariant(customAccent[other].accent, other, theme)
      return deriveAccentColors(auto)
    }
    return null
  }, [accentMode, customAccent, theme])

  const resolvedText = useMemo(() => {
    if (textMode !== 'custom') return null
    if (customText[theme]) return customText[theme]
    const other = theme === 'dark' ? 'light' : 'dark'
    if (customText[other]) {
      const auto = getAutoVariant(customText[other], other, theme)
      const bgForTheme = theme === 'dark' ? '#050505' : '#ffffff'
      return enforceContrast(auto, bgForTheme)
    }
    return null
  }, [textMode, customText, theme])

  const currentAccentColor = accentMode === 'custom'
    ? (resolvedAccent?.accent || '#ffffff')
    : accentPresets[accentPresetIndex][theme === 'dark' ? 'dark' : 'light'].accent

  const currentTextColor = textMode === 'custom'
    ? (resolvedText || '#f0f0f0')
    : textPresets[textPresetIndex][theme === 'dark' ? 'dark' : 'light']

  const currentSurfaceLabel = surfaceMode === 'custom'
    ? 'Custom surface'
    : surfacePresets[surfacePresetIndex].label

  const accentLabel = accentMode === 'custom' ? 'Custom accent' : accentPresets[accentPresetIndex].label
  const textLabel = textMode === 'custom' ? 'Custom text' : textPresets[textPresetIndex].label
  const labelText = lastChanged === 'accent' ? accentLabel : lastChanged === 'text' ? textLabel : lastChanged === 'surface' ? currentSurfaceLabel : ''

  const cycleAccent = () => {
    setAccentMode('preset')
    setAccentPresetIndex((i) => (i + 1) % accentPresets.length)
    setLastChanged('accent')
    showLabel()
  }

  const cycleText = () => {
    setTextMode('preset')
    setTextPresetIndex((i) => (i + 1) % textPresets.length)
    setLastChanged('text')
    showLabel()
  }

  const cycleSurface = () => {
    setSurfaceMode('preset')
    setSurfacePresetIndex((i) => (i + 1) % surfacePresets.length)
    setLastChanged('surface')
    showLabel()
  }

  const handleAccentCustom = (e) => {
    const hex = e.target.value
    const derived = deriveAccentColors(hex)
    setCustomAccent((prev) => ({ ...prev, [theme]: derived }))
    setAccentMode('custom')
    setLastChanged('accent')
    showLabel()
  }

  const handleTextCustom = (e) => {
    const bgForTheme = theme === 'dark' ? '#050505' : '#ffffff'
    const hex = enforceContrast(e.target.value, bgForTheme)
    setCustomText((prev) => ({ ...prev, [theme]: hex }))
    setTextMode('custom')
    setLastChanged('text')
    showLabel()
  }

  const paletteId = accentMode === 'preset' ? accentPresets[accentPresetIndex].id : 'custom'
  const textPresetId = textMode === 'preset' ? textPresets[textPresetIndex].id : 'custom'
  const surfaceId = surfaceMode === 'preset' ? surfacePresets[surfacePresetIndex].id : 'custom'

  // Push resolved custom values into CSS custom properties on the landing-page wrapper.
  useEffect(() => {
    const root = containerRef.current?.closest('.landing-page')
    if (!root) return
    const vars = {}
    if (resolvedAccent) {
      vars['--accent'] = resolvedAccent.accent
      vars['--accent-fg'] = resolvedAccent.accentFg
      vars['--accent-dim'] = resolvedAccent.accentDim
    }
    if (resolvedText) {
      vars['--fg'] = resolvedText
    }
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
    return () => {
      Object.keys(vars).forEach((k) => root.style.removeProperty(k))
    }
  }, [resolvedAccent, resolvedText])

  // Keep data-palette, data-text-preset, and data-surface in sync with the DOM wrapper.
  useEffect(() => {
    const root = containerRef.current?.closest('.landing-page')
    if (!root) return
    root.setAttribute('data-palette', paletteId)
    if (textMode === 'preset') {
      root.setAttribute('data-text-preset', textPresetId)
    } else {
      root.removeAttribute('data-text-preset')
    }
    root.setAttribute('data-surface', surfaceId)
  }, [paletteId, textPresetId, textMode, surfaceId])

  const copyColors = useCallback(async () => {
    const root = containerRef.current?.closest('.landing-page')
    if (!root) return
    const cs = getComputedStyle(root)

    const tokenMap = {
      '--bg': 'Page background',
      '--fg': 'Primary text',
      '--muted': 'Secondary / muted text',
      '--surface': 'Card / panel background',
      '--surface-2': 'Elevated surface (headers, badges)',
      '--surface-3': 'Deeper surface (viewport, thumbnails)',
      '--border': 'Primary borders',
      '--border-subtle': 'Subtle dividers',
      '--accent': 'Accent / CTA color',
      '--accent-fg': 'Text on accent backgrounds',
      '--accent-dim': 'Dimmed accent (hover states)',
      '--shadow': 'Drop shadow',
      '--shadow-glow': 'Glow / halo shadow',
    }

    const lines = [
      `Agentic Content Studio — Theme Color Report`,
      `═══════════════════════════════════════════`,
      ``,
      `Active Configuration`,
      `─────────────────────`,
      `Theme:        ${theme}`,
      `Surface:      ${currentSurfaceLabel} (${surfaceId})`,
      `Accent:       ${accentLabel} (${paletteId})`,
      `Text:         ${textLabel} (${textPresetId})`,
      ``,
      `CSS Custom Properties (Current Theme — ${theme})`,
      `──────────────────────────────────────────────────`,
      `Token                | Value     | Usage`,
      `──────────────────────────────────────────────────`,
    ]

    Object.entries(tokenMap).forEach(([token, usage]) => {
      const value = cs.getPropertyValue(token).trim()
      if (value) {
        lines.push(`${token.padEnd(20)} | ${value.padEnd(9)} | ${usage}`)
      }
    })

    lines.push(``)
    lines.push(`Preset Reference (Light ↔ Dark)`)
    lines.push(`──────────────────────────────────────────────────`)

    const activeSurface = SURFACE_PRESET_DATA[surfaceId]
    if (activeSurface) {
      lines.push(`Surface: ${currentSurfaceLabel}`)
      lines.push(`  Dark  → bg: ${activeSurface.dark.bg}, surface: ${activeSurface.dark.surface}, surface-2: ${activeSurface.dark['surface-2']}, surface-3: ${activeSurface.dark['surface-3']}`)
      lines.push(`  Light → bg: ${activeSurface.light.bg}, surface: ${activeSurface.light.surface}, surface-2: ${activeSurface.light['surface-2']}, surface-3: ${activeSurface.light['surface-3']}`)
      lines.push(``)
    }

    const activeAccent = accentPresets.find(p => p.id === paletteId)
    if (activeAccent) {
      lines.push(`Accent: ${accentLabel}`)
      lines.push(`  Dark  → accent: ${activeAccent.dark.accent}, accent-fg: ${activeAccent.dark.accentFg}, accent-dim: ${activeAccent.dark.accentDim}`)
      lines.push(`  Light → accent: ${activeAccent.light.accent}, accent-fg: ${activeAccent.light.accentFg}, accent-dim: ${activeAccent.light.accentDim}`)
      lines.push(``)
    }

    const activeText = textPresets.find(p => p.id === textPresetId)
    if (activeText) {
      lines.push(`Text: ${textLabel}`)
      lines.push(`  Dark  → fg: ${activeText.dark}`)
      lines.push(`  Light → fg: ${activeText.light}`)
      lines.push(``)
    }

    if (accentMode === 'custom' && customAccent[theme]) {
      lines.push(`Custom Accent Override (${theme}):`)
      lines.push(`  accent: ${customAccent[theme].accent}, accent-fg: ${customAccent[theme].accentFg}, accent-dim: ${customAccent[theme].accentDim}`)
      lines.push(``)
    }
    if (textMode === 'custom' && customText[theme]) {
      lines.push(`Custom Text Override (${theme}): ${customText[theme]}`)
      lines.push(``)
    }

    const text = lines.join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setLastChanged('copy')
      showLabel()
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy colors:', err)
    }
  }, [theme, currentSurfaceLabel, surfaceId, accentLabel, paletteId, textLabel, textPresetId, accentMode, textMode, customAccent, customText, showLabel])

  return (
    <div className='color-controls' ref={containerRef}>
      <span className={`color-controls__label ${labelVisible ? 'is-visible' : ''}`} aria-hidden='true'>
        {lastChanged === 'copy' ? (copied ? 'Colors copied!' : 'Copy failed') : labelText}
      </span>

      {/* Surface control */}
      <div className='color-control'>
        <button
          type='button'
          className='color-control__btn'
          onClick={cycleSurface}
          aria-label={`Cycle surface theme (current: ${currentSurfaceLabel})`}
          title={`Cycle surface theme (current: ${currentSurfaceLabel})`}
        >
          <Layers size={18} aria-hidden='true' />
          <span
            className='color-control__swatch color-control__swatch--surface'
            aria-hidden='true'
            style={{ background: 'var(--bg)' }}
          />
        </button>
      </div>

      {/* Accent control */}
      <div className='color-control'>
        <button
          type='button'
          className='color-control__btn'
          onClick={cycleAccent}
          aria-label={`Cycle accent color (current: ${accentLabel})`}
          title={`Cycle accent color (current: ${accentLabel})`}
        >
          <Palette size={18} aria-hidden='true' />
          <span
            className='color-control__swatch'
            aria-hidden='true'
            style={{ background: currentAccentColor }}
          />
        </button>
        <button
          type='button'
          className='color-control__picker-btn'
          onClick={() => accentInputRef.current?.click()}
          aria-label='Pick custom accent color'
          title='Pick custom accent color'
        >
          <span className='color-control__picker-dot' style={{ background: currentAccentColor }} />
        </button>
        <input
          ref={accentInputRef}
          type='color'
          className='color-control__input'
          value={currentAccentColor}
          onChange={handleAccentCustom}
          aria-hidden='true'
          tabIndex={-1}
        />
      </div>

      {/* Text control */}
      <div className='color-control'>
        <button
          type='button'
          className='color-control__btn'
          onClick={cycleText}
          aria-label={`Cycle text color (current: ${textLabel})`}
          title={`Cycle text color (current: ${textLabel})`}
        >
          <Type size={18} aria-hidden='true' />
          <span
            className='color-control__swatch color-control__swatch--text'
            aria-hidden='true'
            style={{ background: currentTextColor }}
          />
        </button>
        <button
          type='button'
          className='color-control__picker-btn'
          onClick={() => textInputRef.current?.click()}
          aria-label='Pick custom text color'
          title='Pick custom text color'
        >
          <span className='color-control__picker-dot' style={{ background: currentTextColor }} />
        </button>
        <input
          ref={textInputRef}
          type='color'
          className='color-control__input'
          value={currentTextColor}
          onChange={handleTextCustom}
          aria-hidden='true'
          tabIndex={-1}
        />
      </div>

      {/* Copy colors control */}
      <div className='color-control'>
        <button
          type='button'
          className='color-control__btn'
          onClick={copyColors}
          aria-label='Copy current color tokens to clipboard'
          title='Copy current color tokens to clipboard'
        >
          {copied ? <CheckCheck size={18} aria-hidden='true' /> : <Copy size={18} aria-hidden='true' />}
        </button>
      </div>
    </div>
  )
}