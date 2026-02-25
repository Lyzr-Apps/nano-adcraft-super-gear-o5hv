'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { callAIAgent, AIAgentResponse } from '@/lib/aiAgent'
import parseLLMJson from '@/lib/jsonParser'
import { FiEdit3, FiClock, FiSettings, FiMenu, FiX, FiDownload, FiRefreshCw, FiChevronRight, FiCheck, FiCopy, FiSearch, FiTrash2, FiArrowLeft, FiZap, FiLayers, FiImage } from 'react-icons/fi'

// ---- Constants ----
const MANAGER_AGENT_ID = '699e8fde5cb02bdebdbe2b51'
const IMAGE_GENERATOR_AGENT_ID = '699e8fdea70fc86b203052d3'
const HISTORY_KEY = 'architect_campaign_history'

// ---- Types ----
interface CampaignInput {
  persona: string
  problem: string
  messaging: string
  cta: string
  platform: 'linkedin' | 'meta' | 'instagram'
  adFormat: 'square' | 'portrait' | 'landscape' | 'story'
}

interface AdConcept {
  hook: string
  cta_text: string
  visual_concept: string
  layout_composition: string
  color_treatment: string
  typography_style: string
  imagery_direction: string
  platform_dimensions: string
  platform_notes: string
  design_notes: string
}

interface GeneratedImage {
  file_url: string
  name?: string
  format_type?: string
}

interface CampaignHistoryItem {
  id: string
  timestamp: string
  input: CampaignInput
  concept: AdConcept
  images: GeneratedImage[]
}

type NavScreen = 'builder' | 'history' | 'settings'

// ---- Sample Data ----
const SAMPLE_INPUT: CampaignInput = {
  persona: 'Product Managers at mid-size SaaS companies',
  problem: 'Spending 10+ hours/week on repetitive workflow tasks that could be automated',
  messaging: 'Build an AI worker in minutes with no code. Automate your workflows and focus on what matters.',
  cta: 'Try Architect Free',
  platform: 'linkedin',
  adFormat: 'square',
}

const SAMPLE_CONCEPT: AdConcept = {
  hook: 'Your workflows should run themselves.',
  cta_text: 'Try Free',
  visual_concept: 'A sleek, minimalist workspace dissolving into flowing circuit patterns, symbolizing the transition from manual to automated workflows.',
  layout_composition: 'Center-dominant layout with hook text in the upper third, hero visual filling the middle, CTA button anchored bottom-right. Minimal text overlay.',
  color_treatment: 'Deep navy base (#0A1628) with electric gold accents (#C9A84C) and soft white text. Gradient transitions from dark to warm gold at focal points.',
  typography_style: 'Modern serif for hook text (Playfair Display 700), clean sans-serif for CTA (Inter 500). Maximum visual impact with minimal text.',
  imagery_direction: 'Abstract tech-organic hybrid -- geometric patterns with subtle organic curves. No stock photo people. Focus on the concept of transformation and efficiency.',
  platform_dimensions: '1080x1080px (Square)',
  platform_notes: 'LinkedIn feed optimal. Hook centered in top third, CTA button bottom-right. Keep 80% of the image visual-only.',
  design_notes: 'Ultra-minimal text. The image carries the message. Only hook + CTA visible on the creative. Premium, enterprise-grade aesthetic.',
}

const SAMPLE_HISTORY: CampaignHistoryItem[] = [
  {
    id: '1',
    timestamp: '2025-02-24T14:30:00Z',
    input: SAMPLE_INPUT,
    concept: SAMPLE_CONCEPT,
    images: [{ file_url: 'https://placehold.co/1080x1080/0A1628/C9A84C?text=Ad+Creative', name: 'ad-creative-1.png', format_type: 'image/png' }],
  },
  {
    id: '2',
    timestamp: '2025-02-23T09:15:00Z',
    input: { ...SAMPLE_INPUT, platform: 'meta', adFormat: 'landscape', persona: 'Marketing Directors at Enterprise Companies' },
    concept: { ...SAMPLE_CONCEPT, hook: 'Your marketing team deserves better tools.', platform_dimensions: '1200x628px (Landscape)' },
    images: [{ file_url: 'https://placehold.co/1200x628/0A1628/C9A84C?text=Ad+Creative', name: 'ad-creative-2.png', format_type: 'image/png' }],
  },
  {
    id: '3',
    timestamp: '2025-02-22T16:45:00Z',
    input: { ...SAMPLE_INPUT, platform: 'instagram', adFormat: 'story', persona: 'Startup Founders' },
    concept: { ...SAMPLE_CONCEPT, hook: 'Launch faster. Automate smarter.', platform_dimensions: '1080x1920px (Story)' },
    images: [],
  },
]

// ---- Helpers ----
const LOADING_STAGES = [
  'Polishing copy...',
  'Designing visual direction...',
  'Crafting your concept...',
  'Finalizing details...',
]

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function getPlatformLabel(p: string): string {
  const map: Record<string, string> = { linkedin: 'LinkedIn', meta: 'Meta', instagram: 'Instagram' }
  return map[p] || p
}

function getFormatLabel(f: string): string {
  const map: Record<string, string> = { square: '1080x1080', portrait: '1080x1350', landscape: '1200x628', story: '1080x1920' }
  return map[f] || f
}

function getFormatName(f: string): string {
  const map: Record<string, string> = { square: 'Square', portrait: 'Portrait', landscape: 'Landscape', story: 'Story' }
  return map[f] || f
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-serif font-normal text-sm mt-3 mb-1 tracking-wider">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-serif font-normal text-base mt-3 mb-1 tracking-wider">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-serif font-normal text-lg mt-4 mb-2 tracking-wider">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm font-light leading-relaxed">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm font-light leading-relaxed">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm font-light leading-relaxed">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-normal">{part}</strong> : part
  )
}

async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename || 'ad-creative.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  } catch (err) {
    console.error('Download failed:', err)
  }
}

function loadHistory(): CampaignHistoryItem[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY)
    if (!data) return []
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveToHistory(input: CampaignInput, concept: AdConcept, images: GeneratedImage[]) {
  const history = loadHistory()
  const item: CampaignHistoryItem = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    input,
    concept,
    images,
  }
  history.unshift(item)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)))
}

function removeFromHistory(id: string) {
  const history = loadHistory()
  const filtered = history.filter(h => h.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered))
}

// ---- ErrorBoundary ----
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-serif font-normal mb-2 tracking-wider">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm font-light">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-6 py-3 bg-primary text-primary-foreground text-sm tracking-wider font-light">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---- Inline Editable Field ----
function EditableField({ value, onChange, multiline, className }: { value: string; onChange: (v: string) => void; multiline?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== value) {
      onChange(draft)
    }
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
          className={`w-full bg-secondary border border-border p-2 text-foreground font-light text-sm leading-relaxed tracking-wider focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[60px] ${className || ''}`}
          rows={4}
        />
      )
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className={`w-full bg-secondary border border-border p-2 text-foreground font-light text-sm tracking-wider focus:outline-none focus:ring-1 focus:ring-primary ${className || ''}`}
      />
    )
  }

  return (
    <div onClick={() => setEditing(true)} className={`cursor-pointer group relative ${className || ''}`} title="Click to edit">
      <span className="group-hover:opacity-70 transition-opacity">{value || 'Click to edit'}</span>
      <FiEdit3 className="inline-block ml-2 w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity text-muted-foreground" />
    </div>
  )
}

// ---- Shimmer Skeleton ----
function ShimmerBlock({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse ${className || ''}`} />
}

// ---- Concept Preview Skeleton ----
function ConceptSkeleton({ stage }: { stage: string }) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent animate-spin" style={{ borderRadius: '50%' }} />
        <span className="text-primary font-light text-sm tracking-wider">{stage}</span>
      </div>
      <div className="space-y-4">
        <ShimmerBlock className="h-8 w-3/4" />
        <ShimmerBlock className="h-4 w-full" />
        <ShimmerBlock className="h-4 w-5/6" />
      </div>
      <div className="space-y-3 mt-6">
        <ShimmerBlock className="h-4 w-full" />
        <ShimmerBlock className="h-4 w-4/5" />
        <ShimmerBlock className="h-4 w-full" />
        <ShimmerBlock className="h-4 w-3/4" />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-6">
        <ShimmerBlock className="h-20" />
        <ShimmerBlock className="h-20" />
        <ShimmerBlock className="h-20" />
        <ShimmerBlock className="h-20" />
      </div>
    </div>
  )
}

// ---- Image Loading ----
function ImageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-2 border-primary border-t-transparent animate-spin" style={{ borderRadius: '50%' }} />
        <FiImage className="absolute inset-0 m-auto w-6 h-6 text-primary" />
      </div>
      <span className="text-primary font-light text-sm tracking-wider">Generating your ad creative...</span>
    </div>
  )
}

// ---- Sidebar ----
function Sidebar({ activeScreen, onNavigate, mobileOpen, onCloseMobile }: { activeScreen: NavScreen; onNavigate: (s: NavScreen) => void; mobileOpen: boolean; onCloseMobile: () => void }) {
  const navItems: { key: NavScreen; label: string; icon: React.ReactNode }[] = [
    { key: 'builder', label: 'Campaign Builder', icon: <FiEdit3 className="w-5 h-5" /> },
    { key: 'history', label: 'Campaign History', icon: <FiClock className="w-5 h-5" /> },
    { key: 'settings', label: 'Brand Settings', icon: <FiSettings className="w-5 h-5" /> },
  ]

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-8 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif font-normal text-xl tracking-wider text-foreground">Architect</h1>
            <p className="text-xs text-muted-foreground tracking-wider font-light mt-1">Ad Creative Generator</p>
          </div>
          <button onClick={onCloseMobile} className="lg:hidden text-muted-foreground hover:text-foreground transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => { onNavigate(item.key); onCloseMobile() }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm tracking-wider font-light transition-all ${activeScreen === item.key ? 'bg-secondary text-primary border-l-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wider font-light">
          <FiZap className="w-3.5 h-3.5 text-primary" />
          <span>Powered by Lyzr</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-card border-r border-border h-screen fixed left-0 top-0 z-30">
        {sidebarContent}
      </aside>
      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseMobile} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r border-border">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}

// ---- Campaign History Screen ----
function CampaignHistoryScreen({
  sampleMode,
  historyVersion,
  onReuseTemplate,
}: {
  sampleMode: boolean
  historyVersion: number
  onReuseTemplate: (input: CampaignInput) => void
}) {
  const [history, setHistory] = useState<CampaignHistoryItem[]>([])
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (sampleMode) {
      setHistory(SAMPLE_HISTORY)
    } else {
      setHistory(loadHistory())
    }
  }, [sampleMode, historyVersion])

  const filteredHistory = useMemo(() => {
    let result = history
    if (platformFilter !== 'all') {
      result = result.filter(h => h.input?.platform === platformFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(h =>
        (h.concept?.hook || '').toLowerCase().includes(q) ||
        (h.input?.persona || '').toLowerCase().includes(q) ||
        (h.input?.messaging || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [history, search, platformFilter])

  const handleDelete = useCallback((id: string) => {
    if (!sampleMode) {
      removeFromHistory(id)
      setHistory(loadHistory())
    }
    setExpandedId(null)
  }, [sampleMode])

  const expandedItem = useMemo(() => {
    if (!expandedId) return null
    return filteredHistory.find(h => h.id === expandedId) || null
  }, [expandedId, filteredHistory])

  if (expandedItem) {
    return (
      <div className="p-6 lg:p-8 space-y-6 overflow-y-auto">
        <button onClick={() => setExpandedId(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground tracking-wider font-light transition-colors">
          <FiArrowLeft className="w-4 h-4" />
          Back to History
        </button>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 tracking-wider font-light">{getPlatformLabel(expandedItem.input?.platform || '')}</span>
              <span className="text-xs text-muted-foreground tracking-wider font-light">{formatDate(expandedItem.timestamp)}</span>
            </div>
            <h2 className="font-serif font-normal text-2xl tracking-wider text-foreground italic">{expandedItem.concept?.hook || 'Untitled'}</h2>
          </div>

          {/* Copy Elements */}
          <div className="space-y-4">
            <div className="border-l-2 border-primary pl-4">
              <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Hook</label>
              <p className="text-lg font-light tracking-wider leading-relaxed italic text-foreground">{expandedItem.concept?.hook || ''}</p>
            </div>
            <div>
              <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">CTA</label>
              <span className="inline-block bg-primary/10 border border-primary/30 px-4 py-2 text-primary text-sm tracking-wider font-normal">{expandedItem.concept?.cta_text || ''}</span>
            </div>
          </div>

          <div className="border border-border bg-card p-6 space-y-4">
            <h3 className="font-serif font-normal text-lg tracking-wider text-foreground">Visual Direction</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-light tracking-wider leading-relaxed">
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase">Visual Concept</label>
                <p>{expandedItem.concept?.visual_concept || ''}</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase">Layout</label>
                <p>{expandedItem.concept?.layout_composition || ''}</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase">Color Treatment</label>
                <p>{expandedItem.concept?.color_treatment || ''}</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 uppercase">Typography</label>
                <p>{expandedItem.concept?.typography_style || ''}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wider font-light">Imagery Direction</label>
              <p className="text-sm font-light tracking-wider leading-relaxed">{expandedItem.concept?.imagery_direction || ''}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 border border-border bg-card p-4">
              <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Dimensions</label>
              <p className="text-sm font-light tracking-wider">{expandedItem.concept?.platform_dimensions || ''}</p>
            </div>
            <div className="flex-1 border border-border bg-card p-4">
              <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Platform Notes</label>
              <p className="text-sm font-light tracking-wider leading-relaxed">{expandedItem.concept?.platform_notes || ''}</p>
            </div>
          </div>

          {expandedItem.concept?.design_notes && (
            <div className="border border-border bg-card p-4">
              <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Design Notes</label>
              <p className="text-sm font-light tracking-wider leading-relaxed">{expandedItem.concept.design_notes}</p>
            </div>
          )}

          {/* Images */}
          {Array.isArray(expandedItem.images) && expandedItem.images.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-serif font-normal text-lg tracking-wider text-foreground">Creative</h3>
              {expandedItem.images.map((img, idx) => (
                <div key={idx} className="relative border border-border bg-card group">
                  <img src={img.file_url} alt={img.name || 'Ad Creative'} className="w-full h-auto" loading="lazy" />
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => downloadImage(img.file_url, img.name || `ad-creative-${idx + 1}.png`)}
                      className="bg-background/90 text-foreground p-2 border border-border hover:bg-card transition-colors"
                    >
                      <FiDownload className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                if (expandedItem.input) {
                  onReuseTemplate(expandedItem.input)
                }
              }}
              className="flex-1 bg-primary text-primary-foreground py-3 text-sm tracking-wider font-light hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <FiCopy className="w-4 h-4" />
              Reuse as Template
            </button>
            {!sampleMode && (
              <button
                onClick={() => handleDelete(expandedItem.id)}
                className="border border-destructive/30 text-destructive py-3 px-4 text-sm tracking-wider font-light hover:bg-destructive/10 transition-colors flex items-center justify-center gap-2"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-y-auto">
      <div>
        <h2 className="font-serif font-normal text-2xl tracking-wider text-foreground">Campaign History</h2>
        <p className="text-muted-foreground text-sm font-light tracking-wider mt-1">Review and reuse past campaign concepts</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full bg-input border border-border pl-10 pr-3 py-2.5 text-sm font-light text-foreground tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'linkedin', 'meta', 'instagram'].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-2 text-xs tracking-wider font-light border transition-all ${platformFilter === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border hover:border-muted-foreground'}`}
            >
              {p === 'all' ? 'All' : getPlatformLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {/* History Grid */}
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
          <div className="w-16 h-16 border border-border flex items-center justify-center bg-card">
            <FiClock className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-serif font-normal text-lg tracking-wider text-foreground mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground text-sm font-light tracking-wider max-w-sm">Your generated campaigns will appear here. Head to Campaign Builder to create your first ad concept.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredHistory.map((item) => (
            <button
              key={item.id}
              onClick={() => setExpandedId(item.id)}
              className="border border-border bg-card p-0 text-left hover:border-primary/50 transition-colors group"
            >
              {/* Thumbnail */}
              {Array.isArray(item.images) && item.images.length > 0 && item.images[0]?.file_url ? (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img src={item.images[0].file_url} alt="Campaign thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <FiImage className="w-8 h-8 text-muted-foreground/40" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <h4 className="font-serif font-normal text-sm tracking-wider text-foreground truncate italic">{item.concept?.hook || 'Untitled Campaign'}</h4>
                <p className="text-xs text-muted-foreground font-light tracking-wider truncate">{item.input?.persona || ''}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 tracking-wider font-light">{getPlatformLabel(item.input?.platform || '')}</span>
                  <span className="text-[10px] text-muted-foreground tracking-wider font-light">{formatDate(item.timestamp)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Brand Settings Screen ----
function BrandSettingsScreen() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-2xl">
      <div>
        <h2 className="font-serif font-normal text-2xl tracking-wider text-foreground">Brand Settings</h2>
        <p className="text-muted-foreground text-sm font-light tracking-wider mt-1">Brand guidelines and knowledge base configuration</p>
      </div>

      <div className="border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
            <FiCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-serif font-normal text-base tracking-wider text-foreground">Brand Guidelines</h3>
            <p className="text-xs text-muted-foreground tracking-wider font-light">Architect brand guidelines PDF is loaded</p>
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-500" style={{ borderRadius: '50%' }} />
            <span className="text-sm font-light tracking-wider text-foreground">Knowledge Base Status: Active</span>
          </div>
          <p className="text-sm font-light tracking-wider leading-relaxed text-muted-foreground">
            The brand guidelines knowledge base contains comprehensive information about visual identity, tone of voice, messaging frameworks, color palettes, typography specifications, and design principles. This ensures all generated ad concepts align with the established brand standards.
          </p>
        </div>
      </div>

      <div className="border border-border bg-card p-6 space-y-4">
        <h3 className="font-serif font-normal text-base tracking-wider text-foreground">What the Guidelines Cover</h3>
        <div className="space-y-3">
          {[
            { title: 'Visual Identity', desc: 'Logo usage, spacing rules, approved color palettes, and approved imagery styles.' },
            { title: 'Typography', desc: 'Primary and secondary typefaces, sizing hierarchy, and weight specifications.' },
            { title: 'Tone of Voice', desc: 'Brand personality, messaging principles, and language guidelines for different audiences.' },
            { title: 'Ad Templates', desc: 'Approved layouts, compositional rules, and platform-specific adaptation notes.' },
            { title: 'Color System', desc: 'Primary, secondary, and accent color definitions with hex/RGB values and usage contexts.' },
          ].map((item, idx) => (
            <div key={idx} className="flex gap-3">
              <FiChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-normal tracking-wider text-foreground">{item.title}</h4>
                <p className="text-xs font-light tracking-wider text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----
export default function Page() {
  const [activeScreen, setActiveScreen] = useState<NavScreen>('builder')
  const [sampleMode, setSampleMode] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [reuseInput, setReuseInput] = useState<CampaignInput | null>(null)

  const handleReuseTemplate = useCallback((input: CampaignInput) => {
    setReuseInput(input)
    setActiveScreen('builder')
  }, [])

  const handleHistoryUpdate = useCallback(() => {
    setHistoryVersion(v => v + 1)
  }, [])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar
          activeScreen={activeScreen}
          onNavigate={setActiveScreen}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main content area */}
        <div className="lg:ml-64 min-h-screen flex flex-col">
          {/* Top bar */}
          <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden text-foreground">
                <FiMenu className="w-5 h-5" />
              </button>
              <span className="text-xs tracking-wider text-muted-foreground font-light uppercase">
                {activeScreen === 'builder' ? 'Campaign Builder' : activeScreen === 'history' ? 'Campaign History' : 'Brand Settings'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs tracking-wider text-muted-foreground font-light">Sample Data</span>
                <button
                  onClick={() => setSampleMode(!sampleMode)}
                  className={`relative w-10 h-5 transition-colors ${sampleMode ? 'bg-primary' : 'bg-muted'}`}
                  aria-label="Toggle sample data"
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-foreground transition-transform ${sampleMode ? 'left-5.5 translate-x-0' : 'left-0.5'}`} style={sampleMode ? { left: '22px' } : { left: '2px' }} />
                </button>
              </label>
            </div>
          </div>

          {/* Screen content */}
          <div className="flex-1 overflow-y-auto">
            {activeScreen === 'builder' && (
              <CampaignBuilderWithReuse
                sampleMode={sampleMode}
                reuseInput={reuseInput}
                clearReuse={() => setReuseInput(null)}
                onHistoryUpdate={handleHistoryUpdate}
              />
            )}
            {activeScreen === 'history' && (
              <CampaignHistoryScreen
                sampleMode={sampleMode}
                historyVersion={historyVersion}
                onReuseTemplate={handleReuseTemplate}
              />
            )}
            {activeScreen === 'settings' && <BrandSettingsScreen />}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

// ---- Wrapper to pass reuse input to Campaign Builder ----
function CampaignBuilderWithReuse({
  sampleMode,
  reuseInput,
  clearReuse,
  onHistoryUpdate,
}: {
  sampleMode: boolean
  reuseInput: CampaignInput | null
  clearReuse: () => void
  onHistoryUpdate: () => void
}) {
  const [localInput, setLocalInput] = useState<CampaignInput | null>(null)

  useEffect(() => {
    if (reuseInput) {
      setLocalInput(reuseInput)
      clearReuse()
    }
  }, [reuseInput, clearReuse])

  return (
    <CampaignBuilderScreenWithReuse
      sampleMode={sampleMode}
      initialInput={localInput}
      onHistoryUpdate={onHistoryUpdate}
    />
  )
}

function CampaignBuilderScreenWithReuse({
  sampleMode,
  initialInput,
  onHistoryUpdate,
}: {
  sampleMode: boolean
  initialInput: CampaignInput | null
  onHistoryUpdate: () => void
}) {
  const [input, setInput] = useState<CampaignInput>({
    persona: '',
    problem: '',
    messaging: '',
    cta: '',
    platform: 'linkedin',
    adFormat: 'square',
  })
  const [concept, setConcept] = useState<AdConcept | null>(null)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [conceptLoading, setConceptLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [stageIndex, setStageIndex] = useState(0)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const stageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (initialInput) {
      setInput(initialInput)
      setConcept(null)
      setGeneratedImages([])
      setError('')
      setImageError('')
    }
  }, [initialInput])

  useEffect(() => {
    if (sampleMode) {
      setInput(SAMPLE_INPUT)
      setConcept(SAMPLE_CONCEPT)
      setGeneratedImages([{ file_url: 'https://placehold.co/1080x1080/0A1628/C9A84C?text=Ad+Creative+Preview', name: 'sample-ad.png', format_type: 'image/png' }])
    } else if (!initialInput) {
      setInput({ persona: '', problem: '', messaging: '', cta: '', platform: 'linkedin', adFormat: 'square' } as CampaignInput)
      setConcept(null)
      setGeneratedImages([])
    }
    setError('')
    setImageError('')
  }, [sampleMode, initialInput])

  useEffect(() => {
    if (conceptLoading) {
      setStageIndex(0)
      stageIntervalRef.current = setInterval(() => {
        setStageIndex((prev) => (prev + 1) % LOADING_STAGES.length)
      }, 2500)
    } else {
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current)
        stageIntervalRef.current = null
      }
    }
    return () => {
      if (stageIntervalRef.current) clearInterval(stageIntervalRef.current)
    }
  }, [conceptLoading])

  const handleGenerateConcept = useCallback(async () => {
    if (!input.persona.trim() || !input.problem.trim() || !input.messaging.trim()) {
      setError('Please fill in persona, problem, and messaging fields.')
      return
    }
    setError('')
    setImageError('')
    setConcept(null)
    setGeneratedImages([])
    setConceptLoading(true)
    setActiveAgentId(MANAGER_AGENT_ID)

    const message = `Generate an ad concept for the following campaign:
Target Persona: ${input.persona}
Problem to Solve: ${input.problem}
Key Messaging: ${input.messaging}
Call to Action: ${input.cta || 'Learn More'}
Platform: ${input.platform}
Ad Format: ${getFormatName(input.adFormat)} (${getFormatLabel(input.adFormat)})`

    try {
      const result: AIAgentResponse = await callAIAgent(message, MANAGER_AGENT_ID)
      if (result.success) {
        const parsed = parseLLMJson(result.response?.result)
        if (parsed && typeof parsed === 'object' && !parsed.error) {
          const newConcept: AdConcept = {
            hook: parsed?.hook ?? '',
            cta_text: parsed?.cta_text ?? '',
            visual_concept: parsed?.visual_concept ?? '',
            layout_composition: parsed?.layout_composition ?? '',
            color_treatment: parsed?.color_treatment ?? '',
            typography_style: parsed?.typography_style ?? '',
            imagery_direction: parsed?.imagery_direction ?? '',
            platform_dimensions: parsed?.platform_dimensions ?? '',
            platform_notes: parsed?.platform_notes ?? '',
            design_notes: parsed?.design_notes ?? '',
          }
          setConcept(newConcept)
        } else {
          setError('Could not parse concept from agent response. Please try again.')
        }
      } else {
        setError(result.error || 'Failed to generate concept. Please try again.')
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.')
    }

    setConceptLoading(false)
    setActiveAgentId(null)
  }, [input])

  const handleGenerateImage = useCallback(async () => {
    if (!concept) return
    setImageError('')
    setImageLoading(true)
    setActiveAgentId(IMAGE_GENERATOR_AGENT_ID)

    const prompt = `Create an ad creative image with these specifications:
IMPORTANT: This ad has ONLY two text elements. No headline, no body copy, no subtitle. Just these two:
Hook Text (the single line on the ad): ${concept.hook}
CTA Button Text: ${concept.cta_text}

Visual Concept: ${concept.visual_concept}
Layout: ${concept.layout_composition}
Color Treatment: ${concept.color_treatment}
Typography: ${concept.typography_style}
Imagery Direction: ${concept.imagery_direction}
Platform Dimensions: ${concept.platform_dimensions}
Text Placement Notes: ${concept.platform_notes}
Design Notes: ${concept.design_notes}

CRITICAL: Only render these two text elements on the image: the hook line and the CTA. The rest of the image should be purely visual. Modern, minimal, visual-first ad creative.`

    try {
      const result: AIAgentResponse = await callAIAgent(prompt, IMAGE_GENERATOR_AGENT_ID)
      if (result.success) {
        const artifacts = result.module_outputs?.artifact_files
        if (Array.isArray(artifacts) && artifacts.length > 0) {
          setGeneratedImages(artifacts)
          saveToHistory(input, concept, artifacts)
          onHistoryUpdate()
        } else {
          setImageError('No image was generated. Please try again.')
        }
      } else {
        setImageError(result.error || 'Failed to generate image. Please try again.')
      }
    } catch (err) {
      setImageError('Network error during image generation. Please try again.')
    }

    setImageLoading(false)
    setActiveAgentId(null)
  }, [concept, input, onHistoryUpdate])

  const updateConceptField = useCallback((field: keyof AdConcept, value: string) => {
    setConcept((prev) => prev ? { ...prev, [field]: value } : prev)
  }, [])

  const platforms: { key: CampaignInput['platform']; label: string }[] = [
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'meta', label: 'Meta' },
    { key: 'instagram', label: 'Instagram' },
  ]

  const formats: { key: CampaignInput['adFormat']; label: string; dims: string }[] = [
    { key: 'square', label: 'Square', dims: '1080x1080' },
    { key: 'portrait', label: 'Portrait', dims: '1080x1350' },
    { key: 'landscape', label: 'Landscape', dims: '1200x628' },
    { key: 'story', label: 'Story', dims: '1080x1920' },
  ]

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-full">
      {/* Left: Input Form */}
      <div className="lg:w-2/5 border-r border-border overflow-y-auto">
        <div className="p-6 lg:p-8 space-y-6">
          <div>
            <h2 className="font-serif font-normal text-2xl tracking-wider text-foreground">Campaign Builder</h2>
            <p className="text-muted-foreground text-sm font-light tracking-wider mt-1">Define your campaign parameters below</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs tracking-wider text-muted-foreground mb-2 font-light uppercase">Target Persona</label>
              <textarea
                value={input.persona}
                onChange={(e) => setInput(prev => ({ ...prev, persona: e.target.value }))}
                placeholder="e.g., Product Managers at mid-size SaaS companies"
                rows={2}
                className="w-full bg-input border border-border p-3 text-sm font-light text-foreground tracking-wider leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div>
              <label className="block text-xs tracking-wider text-muted-foreground mb-2 font-light uppercase">Problem to Solve</label>
              <textarea
                value={input.problem}
                onChange={(e) => setInput(prev => ({ ...prev, problem: e.target.value }))}
                placeholder="e.g., Spending 10+ hours/week on repetitive workflow tasks"
                rows={2}
                className="w-full bg-input border border-border p-3 text-sm font-light text-foreground tracking-wider leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div>
              <label className="block text-xs tracking-wider text-muted-foreground mb-2 font-light uppercase">Messaging</label>
              <textarea
                value={input.messaging}
                onChange={(e) => setInput(prev => ({ ...prev, messaging: e.target.value }))}
                placeholder="e.g., Build an AI worker in minutes, no code needed"
                rows={3}
                className="w-full bg-input border border-border p-3 text-sm font-light text-foreground tracking-wider leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div>
              <label className="block text-xs tracking-wider text-muted-foreground mb-2 font-light uppercase">Call to Action</label>
              <input
                type="text"
                value={input.cta}
                onChange={(e) => setInput(prev => ({ ...prev, cta: e.target.value }))}
                placeholder="e.g., Try Architect Free"
                className="w-full bg-input border border-border p-3 text-sm font-light text-foreground tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs tracking-wider text-muted-foreground mb-2 font-light uppercase">Platform</label>
              <div className="flex gap-2">
                {platforms.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setInput(prev => ({ ...prev, platform: p.key }))}
                    className={`flex-1 py-2.5 px-3 text-xs tracking-wider font-light border transition-all ${input.platform === p.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border hover:border-muted-foreground'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs tracking-wider text-muted-foreground mb-2 font-light uppercase">Ad Format</label>
              <div className="grid grid-cols-2 gap-2">
                {formats.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setInput(prev => ({ ...prev, adFormat: f.key }))}
                    className={`py-2.5 px-3 text-xs tracking-wider font-light border transition-all text-left ${input.adFormat === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border hover:border-muted-foreground'}`}
                  >
                    <div>{f.label}</div>
                    <div className={`text-[10px] mt-0.5 ${input.adFormat === f.key ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{f.dims}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-light tracking-wider">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerateConcept}
            disabled={conceptLoading || imageLoading}
            className="w-full bg-primary text-primary-foreground py-3.5 text-sm tracking-wider font-light transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {conceptLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent animate-spin" style={{ borderRadius: '50%' }} />
                Generating...
              </>
            ) : (
              <>
                <FiZap className="w-4 h-4" />
                Generate Ad Concept
              </>
            )}
          </button>

          {/* Agent Status */}
          <div className="border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs tracking-wider text-muted-foreground uppercase font-light">Agent Status</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 ${activeAgentId === MANAGER_AGENT_ID ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} style={{ borderRadius: '50%' }} />
                <span className="text-xs font-light tracking-wider text-foreground">Ad Campaign Orchestrator</span>
                {activeAgentId === MANAGER_AGENT_ID && <span className="text-[10px] text-primary tracking-wider">Active</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 ${activeAgentId === IMAGE_GENERATOR_AGENT_ID ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} style={{ borderRadius: '50%' }} />
                <span className="text-xs font-light tracking-wider text-foreground">Ad Image Generator</span>
                {activeAgentId === IMAGE_GENERATOR_AGENT_ID && <span className="text-[10px] text-primary tracking-wider">Active</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Preview Panel */}
      <div className="lg:w-3/5 overflow-y-auto">
        <div className="p-6 lg:p-8">
          {conceptLoading ? (
            <ConceptSkeleton stage={LOADING_STAGES[stageIndex]} />
          ) : concept ? (
            <div className="space-y-6">
              {/* Ad Copy - Hook + CTA Only */}
              <div className="border border-border bg-card p-6 space-y-5">
                <h3 className="font-serif font-normal text-lg tracking-wider text-muted-foreground flex items-center gap-2">
                  <FiZap className="w-4 h-4 text-primary" />
                  Ad Copy
                </h3>
                {/* Hook */}
                <div className="border-l-2 border-primary pl-4">
                  <label className="block text-xs tracking-wider text-muted-foreground mb-2 font-light uppercase">Hook</label>
                  <EditableField
                    value={concept.hook}
                    onChange={(v) => updateConceptField('hook', v)}
                    className="font-serif text-2xl font-normal tracking-wider leading-relaxed text-foreground italic"
                  />
                </div>

                {/* CTA Text */}
                <div>
                  <label className="block text-xs tracking-wider text-muted-foreground mb-2 font-light uppercase">CTA</label>
                  <div className="inline-block bg-primary text-primary-foreground px-6 py-2.5">
                    <EditableField
                      value={concept.cta_text}
                      onChange={(v) => updateConceptField('cta_text', v)}
                      className="font-normal tracking-wider text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Visual Direction */}
              <div className="border border-border bg-card p-6 space-y-4">
                <h3 className="font-serif font-normal text-lg tracking-wider text-foreground flex items-center gap-2">
                  <FiLayers className="w-4 h-4 text-primary" />
                  Visual Direction
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Visual Concept</label>
                    <EditableField
                      value={concept.visual_concept}
                      onChange={(v) => updateConceptField('visual_concept', v)}
                      multiline
                      className="text-sm font-light tracking-wider leading-relaxed text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Layout Composition</label>
                    <EditableField
                      value={concept.layout_composition}
                      onChange={(v) => updateConceptField('layout_composition', v)}
                      multiline
                      className="text-sm font-light tracking-wider leading-relaxed text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Color Treatment</label>
                    <EditableField
                      value={concept.color_treatment}
                      onChange={(v) => updateConceptField('color_treatment', v)}
                      multiline
                      className="text-sm font-light tracking-wider leading-relaxed text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Typography Style</label>
                    <EditableField
                      value={concept.typography_style}
                      onChange={(v) => updateConceptField('typography_style', v)}
                      multiline
                      className="text-sm font-light tracking-wider leading-relaxed text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Imagery Direction</label>
                  <EditableField
                    value={concept.imagery_direction}
                    onChange={(v) => updateConceptField('imagery_direction', v)}
                    multiline
                    className="text-sm font-light tracking-wider leading-relaxed text-foreground"
                  />
                </div>
              </div>

              {/* Platform Info */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 border border-border bg-card p-4">
                  <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Platform Dimensions</label>
                  <EditableField
                    value={concept.platform_dimensions}
                    onChange={(v) => updateConceptField('platform_dimensions', v)}
                    className="text-sm font-light tracking-wider text-foreground"
                  />
                </div>
                <div className="flex-1 border border-border bg-card p-4">
                  <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Platform Notes</label>
                  <EditableField
                    value={concept.platform_notes}
                    onChange={(v) => updateConceptField('platform_notes', v)}
                    multiline
                    className="text-sm font-light tracking-wider leading-relaxed text-foreground"
                  />
                </div>
              </div>

              {/* Design Notes */}
              <div className="border border-border bg-card p-4">
                <label className="block text-xs tracking-wider text-muted-foreground mb-1 font-light uppercase">Design Notes</label>
                <EditableField
                  value={concept.design_notes}
                  onChange={(v) => updateConceptField('design_notes', v)}
                  multiline
                  className="text-sm font-light tracking-wider leading-relaxed text-foreground"
                />
              </div>

              {/* Generate Creative Button */}
              {!imageLoading && generatedImages.length === 0 && (
                <div className="pt-2">
                  {imageError && (
                    <div className="bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-light tracking-wider mb-4">
                      {imageError}
                    </div>
                  )}
                  <button
                    onClick={handleGenerateImage}
                    disabled={imageLoading}
                    className="w-full bg-primary text-primary-foreground py-3.5 text-sm tracking-wider font-light transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <FiImage className="w-4 h-4" />
                    Generate Creative
                  </button>
                </div>
              )}

              {/* Image Loading */}
              {imageLoading && <ImageSkeleton />}

              {/* Generated Images */}
              {Array.isArray(generatedImages) && generatedImages.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-serif font-normal text-lg tracking-wider text-foreground">Generated Creative</h3>
                  {generatedImages.map((img, idx) => (
                    <div key={idx} className="relative border border-border bg-card group">
                      <img
                        src={img.file_url}
                        alt={img.name || 'Ad Creative'}
                        className="w-full h-auto"
                        loading="lazy"
                      />
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => downloadImage(img.file_url, img.name || `ad-creative-${idx + 1}.png`)}
                          className="bg-background/90 text-foreground p-2 border border-border hover:bg-card transition-colors"
                          title="Download"
                        >
                          <FiDownload className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3">
                    <button
                      onClick={handleGenerateImage}
                      disabled={imageLoading}
                      className="flex-1 border border-border bg-secondary text-secondary-foreground py-3 text-sm tracking-wider font-light hover:bg-muted transition-colors flex items-center justify-center gap-2"
                    >
                      <FiRefreshCw className="w-4 h-4" />
                      Regenerate
                    </button>
                    <button
                      onClick={() => {
                        if (generatedImages[0]?.file_url) {
                          downloadImage(generatedImages[0].file_url, generatedImages[0].name || 'ad-creative.png')
                        }
                      }}
                      className="flex-1 bg-primary text-primary-foreground py-3 text-sm tracking-wider font-light hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <FiDownload className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                  {imageError && (
                    <div className="bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-light tracking-wider">
                      {imageError}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-4">
              <div className="w-16 h-16 border border-border flex items-center justify-center bg-card">
                <FiLayers className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-serif font-normal text-lg tracking-wider text-foreground mb-2">Your ad concept will appear here</h3>
                <p className="text-muted-foreground text-sm font-light tracking-wider max-w-sm">Fill in the campaign parameters on the left and click "Generate Ad Concept" to get started.</p>
              </div>
              <FiChevronRight className="w-5 h-5 text-muted-foreground animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
