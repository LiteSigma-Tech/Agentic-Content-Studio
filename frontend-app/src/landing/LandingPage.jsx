import { useEffect, useRef, useState, useCallback } from 'react'
import {
  ArrowRight, Check, CircleDollarSign, Clapperboard, Play, ShieldCheck, Sparkles, Waypoints,
  Zap, Lock, Users, Radio, Activity, BarChart3, Layers, Cpu, Globe, X as XIcon
} from 'lucide-react'
import Layout from './Layout'
import './landing.css'

const navItems = [
  ['Proof', '#proof'],
  ['Platform', '#platform'],
  ['Workflow', '#workflow'],
  ['Trust', '#trust'],
  ['Pricing', '#pricing'],
]

const pillars = [
  {
    icon: Sparkles,
    title: 'Studio',
    stat: '11 stages',
    body: 'Concept to rendered episode. Script, storyboard, characters, keyframes, clips, voices, music, mix   with human review gates at every critical decision.',
    image: 'Script-to-storyboard preview',
    features: ['AI script generation', 'Auto storyboarding', 'Voice casting', 'Music scoring']
  },
  {
    icon: Waypoints,
    title: 'Leads',
    stat: 'HITL sends',
    body: 'Source, score, and approve outreach that actually lands. Compliance checks run before every send   not after the fact.',
    image: 'Outreach queue preview',
    features: ['ICP scoring', 'Consent validation', 'Suppression checks', 'Approval gates']
  },
  {
    icon: CircleDollarSign,
    title: 'Gateway',
    stat: '$0 first',
    body: 'Start producing at zero cost. Evaluate the entire stack with free and mock providers, then add paid keys only when output quality justifies it.',
    image: 'Model routing diagram',
    features: ['Free-first evaluation', 'Hard cost caps', 'Offline capable', 'No lock-in']
  },
]

const steps = [
  { num: '01', title: 'Concept', body: 'Describe your episode or campaign. The agent breaks it into a production-ready plan.', icon: Zap },
  { num: '02', title: 'Pipeline', body: 'The platform selects eligible AI capabilities and queues the work.', icon: Layers },
  { num: '03', title: 'Review', body: 'Humans approve sensitive stages and every outbound touch. Nothing ships unchecked.', icon: Users },
  { num: '04', title: 'Publish', body: 'Ship the final asset or compliant next step. Checkpoints resume automatically if interrupted.', icon: Globe },
]

const filmstrip = [
  'Episode thumbnail   cold open',
  'Episode thumbnail   product demo',
  'Episode thumbnail   explainer',
  'Episode thumbnail   highlight reel',
  'Episode thumbnail   testimonial cut',
  'Episode thumbnail   season recap',
  'Episode thumbnail   behind the scenes',
  'Episode thumbnail   trailer',
]

const stats = [
  { value: '11', label: 'Production stages', suffix: '' },
  { value: '0', label: 'Starting cost', suffix: '$' },
  { value: '10', label: 'Minutes to first episode', suffix: '' },
  { value: '100', label: 'Approval gates', suffix: '%' },
]

/* ─── Animated number counter ─── */
function AnimatedCounter({ value, suffix = '', prefix = '' }) {
  const [display, setDisplay] = useState('0')
  const ref = useRef(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          if (value === '∞') { setDisplay('∞'); return }
          const target = parseInt(value, 10)
          if (isNaN(target)) { setDisplay(value); return }
          let current = 0
          const step = Math.max(1, Math.floor(target / 40))
          const timer = setInterval(() => {
            current += step
            if (current >= target) {
              setDisplay(String(target))
              clearInterval(timer)
            } else {
              setDisplay(String(current))
            }
          }, 30)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [value])

  return (
    <span ref={ref} className="stat-value">
      {prefix}{display}{suffix}
    </span>
  )
}

/* ─── Spotlight cursor effect ─── */
function useSpotlight() {
  const [pos, setPos] = useState({ x: 50, y: 50 })
  useEffect(() => {
    const onMove = (e) => {
      setPos({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  return pos
}

/* ─── Card glow mouse tracking ─── */
function useCardGlow(ref) {
  const handleMouseMove = useCallback((e) => {
    const card = ref.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    card.style.setProperty('--glow-x', `${x}%`)
    card.style.setProperty('--glow-y', `${y}%`)
  }, [ref])

  useEffect(() => {
    const card = ref.current
    if (!card) return
    card.addEventListener('mousemove', handleMouseMove)
    return () => card.removeEventListener('mousemove', handleMouseMove)
  }, [ref, handleMouseMove])
}

/* ─── Decorative skeleton with enhanced animation ─── */
function PipelineStatusSkeleton() {
  const rows = [
    { label: 'Script draft', status: 'Complete', progress: 100 },
    { label: 'Storyboard', status: 'Rendering', progress: 74 },
    { label: 'Voice cast', status: 'Queued', progress: 0 },
    { label: 'Render queue', status: 'Awaiting approval', progress: 0 },
  ]
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="skeleton-panel" aria-label="Sample pipeline status preview">
      <div className="skeleton-panel__head">
        <span className="skeleton-panel__title">
          <Activity size={14} className="skeleton-panel__live-icon" aria-hidden="true" />
          Pipeline status
        </span>
        <span className={`skeleton-panel__badge ${loaded ? 'is-live' : ''}`}>
          {loaded ? (
            <>
              <span className="live-dot" aria-hidden="true" />
              Live
            </>
          ) : 'Initializing…'}
        </span>
      </div>
      {rows.map((row, i) => (
        <div className="skeleton-row" key={row.label} style={{ '--row-i': i }}>
          <span className="skeleton-row__label">{loaded ? row.label : ''}</span>
          <div className="skeleton-row__track">
            <span
              className={`skeleton-row__bar ${loaded ? 'is-done' : 'is-loading'}`}
              style={loaded ? { width: `${row.progress}%` } : {}}
            />
          </div>
          <span className="skeleton-row__status">{loaded ? row.status : ''}</span>
        </div>
      ))}
    </div>
  )
}

function EpisodeRenderQueueSkeleton() {
  const items = [
    { id: 'EP-014', status: 'Rendering · 74%', progress: 74 },
    { id: 'EP-015', status: 'Queued', progress: 0 },
    { id: 'EP-016', status: 'Awaiting approval', progress: 0 },
  ]
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1800)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="skeleton-queue" aria-label="Sample episode render queue">
      {items.map((item, i) => (
        <div className="skeleton-queue__item" key={item.id} style={{ '--item-i': i }}>
          <div className={`skeleton-queue__thumb ${loaded ? 'is-done' : 'is-loading'}`}>
            {loaded && <span className="skeleton-queue__thumb-play"><Play size={12} fill="currentColor" /></span>}
          </div>
          <div className="skeleton-queue__meta">
            <span className={loaded ? 'is-text' : 'skeleton-line'}>{loaded ? item.id : ''}</span>
            <span className={loaded ? 'is-text is-muted' : 'skeleton-line skeleton-line--short'}>
              {loaded ? item.status : ''}
            </span>
            {loaded && (
              <div className="skeleton-queue__progress">
                <div className="skeleton-queue__progress-bar" style={{ width: `${item.progress}%` }} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Buttons ─── */
function MarketingButton({ children, kind = 'primary', onClick, href, icon: Icon = ArrowRight }) {
  const className = `landing-button landing-button--${kind}`
  const content = (
    <>
      <span className="landing-button__text">{children}</span>
      {Icon && <Icon size={16} aria-hidden="true" className="landing-button__icon" />}
      <span className="landing-button__glow" aria-hidden="true" />
    </>
  )
  if (href) {
    return (
      <a className={className} href={href}>
        {content}
      </a>
    )
  }
  return (
    <button className={className} type="button" onClick={onClick}>
      {content}
    </button>
  )
}

/* ─── Hero visual: cinematic console preview ─── */
function HeroFrame() {
  return (
    <div className="hero-frame" aria-label="Studio console preview">
      <div className="hero-frame__bar">
        <div className="hero-frame__dots">
          <span className="hero-frame__dot hero-frame__dot--red" />
          <span className="hero-frame__dot hero-frame__dot--amber" />
          <span className="hero-frame__dot hero-frame__dot--green" />
        </div>
        <span className="hero-frame__title">
          <Radio size={12} className="hero-frame__live-icon" aria-hidden="true" />
          Studio   Episode 014
        </span>
        <span className="hero-frame__badge">LIVE</span>
      </div>
      <div className="hero-frame__body">
        <div className="hero-frame__viewport">
          <div className="hero-frame__viewport-inner">
            <div className="hero-frame__scanline" aria-hidden="true" />
            <div className="hero-frame__grid" aria-hidden="true" />
            <span className="hero-frame__viewport-label">Episode render in progress</span>
            <div className="hero-frame__waveform" aria-hidden="true">
              {Array.from({ length: 32 }).map((_, i) => (
                <span key={i} style={{ '--wave-i': i, height: `${20 + Math.random() * 60}%` }} />
              ))}
            </div>
          </div>
        </div>
        <EpisodeRenderQueueSkeleton />
      </div>
    </div>
  )
}

/* ─── Infinite marquee filmstrip ─── */
function FilmstripReel() {
  const trackRef = useRef(null)
  const [isPaused, setIsPaused] = useState(false)

  return (
    <section
      className="reel section-reveal"
      aria-label="Sample rendered episodes"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="reel__perf reel__perf--top" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => <span key={i} />)}
      </div>
      <div className={`reel__track ${isPaused ? 'is-paused' : ''}`} ref={trackRef}>
        {[...filmstrip, ...filmstrip].map((label, i) => (
          <div className="reel__frame" key={`${label}-${i}`} style={{ '--i': i }}>
            <div className="reel__frame-inner">
  {/* Render the image as a direct child of the inner frame */}
  <img src="/placeholder.jpg" alt={label} className="reel__frame-img" />
  
  <div className="reel__frame-overlay">
    <Play size={20} fill="currentColor" />
  </div>
</div>
          </div>
        ))}
      </div>
      <div className="reel__perf reel__perf--bottom" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => <span key={i} />)}
      </div>
    </section>
  )
}

/* ─── Stat bar ─── */
function StatBar() {
  return (
    <section className="stat-bar section-reveal" aria-label="Platform metrics">
      {stats.map((stat, i) => (
        <div className="stat-item" key={stat.label} style={{ '--stat-i': i }}>
          <AnimatedCounter value={stat.value} suffix={stat.suffix} />
          <span className="stat-label">{stat.label}</span>
        </div>
      ))}
    </section>
  )
}

/* ─── Feature card with hover glow ─── */
function FeatureCard({ icon: Icon, title, stat, body, features, image, index }) {
  const [hovered, setHovered] = useState(false)
  const cardRef = useRef(null)
  useCardGlow(cardRef)

  return (
    <article
      ref={cardRef}
      className="landing-card"
      key={title}
      style={{ '--i': index }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`landing-card__glow ${hovered ? 'is-active' : ''}`} aria-hidden="true" />
      <div className="landing-card__visual">
        <div className="landing-card__placeholder">
          <img src="/placeholder.jpg" alt={title} className="landing-card__img" />
        </div>
        <div className="landing-card__visual-overlay">
          <span className="landing-card__stat">{stat}</span>
        </div>
      </div>
      <div className="landing-card__content">
        <div className="landing-card__header">
          <Icon size={20} aria-hidden="true" />
          <h3>{title}</h3>
        </div>
        <p>{body}</p>
        <ul className="landing-card__features">
          {features.map((f) => (
            <li key={f}><Check size={12} aria-hidden="true" />{f}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/* ─── Process step with connector line ─── */
function ProcessStep({ num, title, body, icon: Icon, index, isLast }) {
  return (
    <article className="landing-process__step" style={{ '--i': index }}>
      <div className="landing-process__connector" aria-hidden="true">
        {!isLast && <div className="landing-process__connector-line" />}
      </div>
      <div className="landing-process__node">
        <span className="landing-process__num">{num}</span>
        <Icon size={18} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  )
}

/* ─── Trust checklist with animated checks ─── */
function TrustChecklist() {
  const items = [
    { icon: Lock, text: 'Outreach sends pause for human approval. No exceptions.' },
    { icon: ShieldCheck, text: 'Consent, suppression, and region gates run before every send.' },
    { icon: Users, text: 'Kids content routes exclusively through moderation-vetted providers.' },
    { icon: BarChart3, text: 'Every action is metered, traced, and bound to tenant quotas.' },
    { icon: Cpu, text: 'Run fully offline with zero GPU or API keys required.' },
  ]
  return (
    <ul className="trust-checklist">
      {items.map((item, i) => (
        <li key={i} style={{ '--check-i': i }}>
          <span className="trust-checklist__icon">
            <item.icon size={18} aria-hidden="true" />
          </span>
          <span className="trust-checklist__text">{item.text}</span>
        </li>
      ))}
    </ul>
  )
}

/* ─── Main landing page ─── */
export default function LandingPage({ onLoginRequest }) {
  const openLogin = () => onLoginRequest?.()
  const spotlight = useSpotlight()

  return (
    <Layout onLoginRequest={onLoginRequest}>
      {/* ─── HERO ─── */}
      <section className="landing-hero">
        <div
          className="landing-hero__spotlight"
          aria-hidden="true"
          style={{ '--spotlight-x': `${spotlight.x}%`, '--spotlight-y': `${spotlight.y}%` }}
        />
        <div className="landing-hero__noise" aria-hidden="true" />

        <div className="landing-hero__copy section-reveal">
          <div className="landing-kicker">
            <span className="landing-kicker__badge">Agentic Content Studio</span>
            <span className="landing-kicker__separator" aria-hidden="true" />
            <span className="landing-kicker__text">Creative studio for modern content teams</span>
          </div>
          <h1>
            <span className="hero-line">Produce episodes.</span>
            <span className="hero-line">In ten minutes.</span>
            <span className="hero-line hero-line--accent">At zero cost.</span>
          </h1>
          <p className="landing-hero__lead">
            A creative studio that takes your episode from concept to rendered video
              offline, at zero cost, with humans in the loop for every decision that matters.
            Lead generation built in, not bolted on.
          </p>
          <div className="landing-actions">
            <MarketingButton onClick={openLogin}>Start producing free</MarketingButton>
            <MarketingButton kind="secondary" onClick={openLogin} icon={Play}>Watch demo</MarketingButton>
          </div>
          <div className="landing-hero__social-proof">
                        <div className="social-avatars" aria-hidden="true">
              {[1,2,3,4].map((i) => (
                <img key={i} src="/placeholder.jpg" alt="" className="social-avatar" />
              ))}
            </div>
            <span>Trusted by content teams shipping <strong>full seasons</strong> without a studio budget.</span>
          </div>
        </div>

        <div className="landing-hero__visual section-reveal">
          <HeroFrame />
          <div className="hero-float-card hero-float-card--1" aria-hidden="true">
            <Cpu size={14} />
            <span>Mock mode active</span>
          </div>
          <div className="hero-float-card hero-float-card--2" aria-hidden="true">
            <Lock size={14} />
            <span>Compliance verified</span>
          </div>
        </div>
      </section>

      {/* ─── STAT BAR ─── */}
      <StatBar />

      {/* ─── MARQUEE REEL ─── */}
      <FilmstripReel />

      {/* ─── PROOF POINTS ─── */}
      <section className="landing-logos section-reveal" id="proof" aria-label="Platform proof points">
        {[
          { label: 'Offline dev', desc: 'Zero GPU required' },
          { label: 'Speed to episode', desc: 'First render in 10 min' },
          { label: 'Tenant metering', desc: 'Per-customer quotas' },
          { label: 'Approval gates', desc: 'HITL by default' },
        ].map((item) => (
          <div className="logo-item" key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.desc}</span>
          </div>
        ))}
      </section>

      {/* ─── BEFORE / AFTER ─── */}
      <section className="landing-split section-reveal" id="split">
        <div className="split-panel split-panel--before">
          <div className="split-panel__badge split-panel__badge--warn">Without it</div>
          <h2>Teams stitch together a dozen tools, API keys, and fragile policies.</h2>
          <p>Costs hit before proof. Model changes mean code changes. Compliance is a spreadsheet ritual that someone always forgets.</p>
          <div className="split-panel__visual">
            <div className="chaos-grid" aria-hidden="true">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="chaos-cell" style={{ '--chaos-i': i }} />
              ))}
            </div>
            <span className="split-panel__visual-label">Disconnected toolchain</span>
          </div>
        </div>
        <div className="split-panel split-panel--after">
          <div className="split-panel__badge split-panel__badge--success">With it</div>
          <h2>One studio. One cost cap. One approval path from idea to episode.</h2>
          <p>Run locally at zero model cost. Keep humans in the loop. Ship episodes predictably without vendor price shocks or rewrite cycles.</p>
          <div className="split-panel__visual">
            <div className="unified-grid" aria-hidden="true">
              <div className="unified-node unified-node--active">
                <Activity size={16} />
                <span>Studio</span>
              </div>
              <div className="unified-connector" />
              <div className="unified-node">
                <Users size={16} />
                <span>Leads</span>
              </div>
              <div className="unified-connector" />
              <div className="unified-node">
                <Cpu size={16} />
                <span>Gateway</span>
              </div>
            </div>
            <span className="split-panel__visual-label">Unified pipeline</span>
          </div>
        </div>
      </section>

      {/* ─── THREE PILLARS ─── */}
      <section className="landing-section section-reveal" id="platform">
        <div className="landing-section__head">
          <p className="landing-kicker">Three pillars</p>
          <h2>Built for teams that ship   not teams that configure.</h2>
          <p className="landing-section__sub">
            Every surface is designed around production reality: review gates, cost caps,
            and predictable turnaround from concept to final episode.
          </p>
        </div>
        <div className="landing-feature-grid">
          {pillars.map((p, i) => (
            <FeatureCard key={p.title} {...p} index={i} />
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="landing-section section-reveal" id="workflow">
        <div className="landing-section__head">
          <p className="landing-kicker">How it works</p>
          <h2>A simple story over a deep operational engine.</h2>
        </div>
        <div className="landing-process">
          {steps.map((step, index) => (
            <ProcessStep
              key={step.title}
              {...step}
              index={index}
              isLast={index === steps.length - 1}
            />
          ))}
        </div>
        <div className="landing-workflow__demo">
          <PipelineStatusSkeleton />
          <div className="workflow-annotation">
            <p>
              <strong>Real-time checkpointing.</strong> Every stage persists state.
              If a run crashes, it resumes from the last completed step   never from scratch.
            </p>
          </div>
        </div>
      </section>

      {/* ─── TRUST ─── */}
      <section className="landing-trust section-reveal" id="trust">
        <div className="landing-trust__copy">
          <p className="landing-kicker">Trust by default</p>
          <h2>Human approval and compliance gates are structural   not footnotes.</h2>
          <p className="landing-trust__lead">
            We built safety into the routing layer, not the prompt layer.
            That means it cannot be bypassed by a clever instruction.
          </p>
          <TrustChecklist />
        </div>
        <div className="landing-trust__visual">
          <div className="trust-visual__frame">
            <div className="trust-visual__header">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Approval checkpoint</span>
              <span className="trust-visual__status">Pending review</span>
            </div>
            <div className="trust-visual__body">
              <div className="trust-visual__row">
                <span className="trust-visual__label">Campaign</span>
                <span className="trust-visual__value">Q3 Product Launch</span>
              </div>
              <div className="trust-visual__row">
                <span className="trust-visual__label">Recipients</span>
                <span className="trust-visual__value">1,247 leads</span>
              </div>
              <div className="trust-visual__row">
                <span className="trust-visual__label">Consent check</span>
                <span className="trust-visual__value trust-visual__value--ok">
                  <Check size={12} aria-hidden="true" /> Passed
                </span>
              </div>
              <div className="trust-visual__row">
                <span className="trust-visual__label">Suppression check</span>
                <span className="trust-visual__value trust-visual__value--ok">
                  <Check size={12} aria-hidden="true" /> Passed
                </span>
              </div>
              <div className="trust-visual__actions">
                <button type="button" className="trust-btn trust-btn--approve">
                  <Check size={14} /> Approve send
                </button>
                <button type="button" className="trust-btn trust-btn--deny">
                  <XIcon size={14} /> Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="landing-pricing section-reveal" id="pricing">
        <div className="landing-pricing__copy">
          <p className="landing-kicker">Free-first economics</p>
          <h2>$0 before you add a paid key.</h2>
          <p className="landing-pricing__lead">
            Evaluate the entire stack   script generation, storyboarding, voice casting,
            rendering, outreach scoring, compliance checks   using mock and free providers.
            Paid fallbacks stay opt-in, visible, and governed by hard cost caps.
          </p>
          <ul className="landing-pricing__checks">
            {[
              'Unlimited mock-mode pipelines',
              'Free-provider routing (OpenRouter, Ollama)',
              'Real ffmpeg render/mix/mux output',
              'Hard spend caps per tenant',
              'No credit card required to start',
            ].map((item) => (
              <li key={item}><Check size={14} aria-hidden="true" />{item}</li>
            ))}
          </ul>
          <MarketingButton onClick={openLogin}>Start in free mode</MarketingButton>
        </div>
        <div className="landing-pricing__visual">
          <div className="pricing-card">
            <div className="pricing-card__header">
              <span className="pricing-card__badge">Current spend</span>
              <span className="pricing-card__amount">$0.00</span>
            </div>
            <div className="pricing-card__meter">
              <div className="pricing-card__meter-track">
                <div className="pricing-card__meter-fill" style={{ width: '0%' }} />
              </div>
              <div className="pricing-card__meter-labels">
                <span>$0 used</span>
                <span>$50 cap</span>
              </div>
            </div>
            <div className="pricing-card__tiers">
              <div className="pricing-tier pricing-tier--active">
                <span className="pricing-tier__name">Free</span>
                <span className="pricing-tier__desc">Mock + free providers</span>
              </div>
              <div className="pricing-tier">
                <span className="pricing-tier__name">Paid</span>
                <span className="pricing-tier__desc">Add keys when ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIAL ─── */}
      <section className="landing-testimonial section-reveal">
        <div className="testimonial-card">
          <div className="testimonial-card__quote">
            <ShieldCheck size={24} aria-hidden="true" />
            <blockquote>
              "We went from concept to a full 5-episode season in two weeks   with our team
              reviewing every script and approving every outreach batch. The fact that we
              never had to manage API keys or worry about a model deprecation breaking our
              pipeline is the real unlock."
            </blockquote>
          </div>
          <div className="testimonial-card__author">
            <div className="testimonial-avatar">
              <span>JD</span>
            </div>
            <div className="testimonial-card__meta">
              <strong>Jamie Dawson</strong>
              <span>Head of Growth, Edutainment Studio</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="landing-final section-reveal">
        <div className="landing-final__copy">
          <h2>Give your team one studio to create, approve, and measure.</h2>
          <p>Join teams shipping content and campaigns without the vendor juggling act.</p>
          <div className="landing-final__actions">
            <MarketingButton onClick={openLogin}>Get started free</MarketingButton>
            <MarketingButton kind="secondary" onClick={openLogin} icon={Play}>Book a demo</MarketingButton>
          </div>
        </div>
        <div className="landing-final__visual" aria-hidden="true">
          <div className="final-rings">
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>
    </Layout>
  )
}