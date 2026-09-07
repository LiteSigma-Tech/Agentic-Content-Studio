import Layout from '../landing/Layout'
import {
  Zap,
  Layers,
  Users,
  Globe,
  LayoutDashboard,
  Clapperboard,
  ShieldCheck,
  Film,
  ArrowRight,
  Play,
  Check,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'

const steps = [
  {
    num: '01',
    title: 'Concept & Scripting',
    icon: Zap,
    body: 'Input your campaign target or idea. The system drafts a comprehensive 11-stage production blueprint with visual scripts and shot lists.',
  },
  {
    num: '02',
    title: 'Automated Generation',
    icon: Layers,
    body: 'Tasks route dynamically to specialized media engines. Test your configurations in offline mock mode to build without spend.',
  },
  {
    num: '03',
    title: 'Operator Review',
    icon: Users,
    body: 'Sensitive stages or distribution triggers pause safely for your sign-off. Request instant variations with prompt-level adjustments.',
  },
  {
    num: '04',
    title: 'Mix & Delivery',
    icon: Globe,
    body: 'Voice synthesis, soundtracks, and FFMPEG rendering automatically assemble your final output, triggering delivery webhooks.',
  },
]

const leadLifecycleSteps = [
  {
    num: '01',
    title: 'Batch Sourcing',
    icon: UserPlus,
    body: 'Pull down high-quality candidate metadata directly from connected directories.',
  },
  {
    num: '02',
    title: 'Scoring & Clean Sweep',
    icon: ShieldAlert,
    body: 'Evaluate ICP scores and sweep lists against country suppression/GDPR opt-in parameters.',
  },
  {
    num: '03',
    title: 'Human Verification',
    icon: CheckCircle2,
    body: 'Preview tailored email drafts, attach revision suggestions, and authorize deliveries in real-time.',
  },
]

const appAreas = [
  {
    num: '1',
    title: 'Dashboard',
    icon: LayoutDashboard,
    body: 'Keep tabs on running renders, account parameters, and pending human approvals in one screen.',
  },
  {
    num: '2',
    title: 'Studio Workspace',
    icon: Clapperboard,
    body: 'Initiate campaign tasks and monitor the active 11-stage pipeline as assets come together.',
  },
  {
    num: '3',
    title: 'Review Queue',
    icon: ShieldCheck,
    body: 'Verify generated drafts, voice tracks, and scripts before authorizing downstream rendering.',
  },
  {
    num: '4',
    title: 'Production Logs',
    icon: Film,
    body: 'Follow background ffmpeg commands, voice generation states, and assembly hooks in real-time.',
  },
]

export default function HowItWorks({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      {/* Hero Intro */}
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">How It Works</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">System Architecture</span>
        </p>
        <h1>Concept to rendered media in four clear steps.</h1>
        <p className="page-hero__lead">
          Our stateful pipelines handle heavy media generation processes sequentially. If a render is interrupted, it safely resumes exactly where it left off.
        </p>
      </section>

      {/* The 4-Step Pipeline Section */}
      <section className="page-section page-section--mb section-reveal">
        <div className="landing-process">
          {steps.map((s, i) => (
            <article className="landing-process__step" key={s.title} style={{ '--i': i }}>
              {i < steps.length - 1 && (
                <div className="landing-process__connector" aria-hidden="true">
                  <div className="landing-process__connector-line" style={{ '--i': i }} />
                </div>
              )}
              <div className="landing-process__node">
                <span className="landing-process__num">{s.num}</span>
                <s.icon size={18} aria-hidden="true" />
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>

        {/* Visual Pipeline Simulator Grid */}
        <div className="landing-workflow__demo section-reveal" style={{ marginTop: '24px' }}>
          <div className="workflow-annotation">
            <p>
              <strong>Stateful Orchestration:</strong> Behind the scenes, we structure your input into distinct blocks. You can view, re-run, or fine-tune any single stage without forcing a full rebuild of your entire project.
            </p>
          </div>
          <div className="unified-grid" style={{ height: '100%', alignItems: 'center' }}>
            <div className="unified-node">
              <span>Scripting</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node unified-node--active">
              <span>AI Gen</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node">
              <span>Voice</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node">
              <span>Muxing</span>
            </div>
          </div>
        </div>
      </section>

      {/* Deep Dive into App Areas */}
      <section className="page-section section-reveal" style={{ paddingBottom: '120px' }}>
        <p className="landing-kicker">
          <span className="landing-kicker__badge">In the Studio</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Where you create</span>
        </p>
        <h2 className="app-tour__heading">A guided view of your workspaces.</h2>
        <p className="page-hero__lead app-tour__lead">
          Every tools is situated exactly where you need it, organized linearly from ideas to asset outputs.
        </p>

        {/* Step Cards with Timeline Rail */}
        <div className="app-tour">
          <div className="app-tour__rail" aria-hidden="true" />
          {appAreas.map((a, idx) => (
            <article className="app-tour__step" key={a.title}>
              <div className="app-tour__marker">
                <span>{a.num}</span>
              </div>
              <div className="app-tour__icon" style={{ marginTop: '12px' }}>
                <a.icon size={16} aria-hidden="true" />
              </div>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
            </article>
          ))}
        </div>

        {/* Mini UI Previews Grid to Visualize the Steps */}
        <div className="showcase-grid section-reveal" style={{ marginTop: '48px' }}>
          {/* Dashboard Preview Component */}
          <div className="skeleton-panel">
            <div className="skeleton-panel__head">
              <span className="skeleton-panel__title">
                <span className="skeleton-panel__live-icon" aria-hidden="true">●</span> Active Tasks
              </span>
              <span className="skeleton-panel__badge is-live">
                <span className="live-dot" aria-hidden="true" /> rendering
              </span>
            </div>
            <div className="skeleton-queue">
              <div className="skeleton-row">
                <span className="skeleton-row__label">Scene #01</span>
                <div className="skeleton-row__track">
                  <div className="skeleton-row__bar is-done" style={{ width: '100%' }} />
                </div>
                <span className="skeleton-row__status">Success</span>
              </div>
              <div className="skeleton-row">
                <span className="skeleton-row__label">Scene #02</span>
                <div className="skeleton-row__track">
                  <div className="skeleton-row__bar is-loading" style={{ width: '65%' }} />
                </div>
                <span className="skeleton-row__status">Rendering</span>
              </div>
            </div>
          </div>

          {/* Review Queue Preview Component */}
          <div className="trust-visual__frame">
            <div className="trust-visual__header">
              <span>Approval Required</span>
              <span className="trust-visual__status">Step 03 / 04</span>
            </div>
            <div className="trust-visual__body">
              <div className="trust-visual__row">
                <span className="trust-visual__label">AI Script Draft</span>
                <span className="trust-visual__value">Review complete</span>
              </div>
              <div className="trust-visual__row">
                <span className="trust-visual__label">Voice Cast Overlap</span>
                <span className="trust-visual__value trust-visual__value--ok">
                  <Check size={14} /> Ready
                </span>
              </div>
              <div className="trust-visual__actions">
                <button type="button" className="trust-btn trust-btn--deny">Edit Prompt</button>
                <button type="button" className="trust-btn trust-btn--approve">Approve Block</button>
              </div>
            </div>
          </div>

          {/* Workspace Sequence Preview Component */}
          <div className="skeleton-panel">
            <div className="skeleton-panel__head">
              <span className="skeleton-panel__title">Project Workspace</span>
              <span className="skeleton-panel__badge">Campaign #38</span>
            </div>
            <div className="skeleton-queue" style={{ gap: '16px' }}>
              <div className="skeleton-queue__item">
                <div className="skeleton-queue__thumb is-done">
                  <Play size={14} className="skeleton-queue__thumb-play" />
                </div>
                <div className="skeleton-queue__meta">
                  <span className="is-text">audio_layer_primary.mp3</span>
                  <span className="is-text is-muted">Generated voice clip</span>
                </div>
              </div>
              <div className="skeleton-queue__item">
                <div className="skeleton-queue__thumb is-loading" />
                <div className="skeleton-queue__meta">
                  <span className="skeleton-line" />
                  <span className="skeleton-line skeleton-line--short" />
                </div>
              </div>
            </div>
          </div>

          {/* Terminal Logs Preview Component */}
          <div className="terminal-logs" style={{ margin: 0, height: '100%', minHeight: '140px' }}>
            <div className="terminal-logs-header">
              <span className="terminal-dot red" />
              <span className="terminal-dot yellow" />
              <span className="terminal-dot green" />
              <span className="terminal-title">system-worker-01</span>
            </div>
            <div className="terminal-log-line">
              <span className="terminal-time">[08:44:01]</span>
              <span className="terminal-task">fetching_metadata</span>
              <span className="terminal-result">OK</span>
            </div>
            <div className="terminal-log-line">
              <span className="terminal-time">[08:44:12]</span>
              <span className="terminal-task">generating_waveform</span>
              <span className="terminal-result">OK</span>
            </div>
            <div className="terminal-log-line">
              <span className="terminal-time">[08:44:28]</span>
              <span className="terminal-task">compiling_ffmpeg_mux</span>
              <span className="terminal-result" style={{ color: 'var(--accent)' }}>RUNNING</span>
            </div>
          </div>
        </div>
      </section>

      {/* Outreach & Lead Control Room Section */}
      <section className="page-section section-reveal" style={{ paddingBottom: '120px' }}>
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Lead Intelligence</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Outreach &amp; Compliance Engine</span>
        </p>
        <h2 className="app-tour__heading">Outreach &amp; Lead Control Room</h2>
        <p className="page-hero__lead app-tour__lead">
          Unified lead acquisition and compliance engine: source candidates, execute scoring modules, and approve generated outreach inline.
        </p>

        {/* Guided Tour Banner */}
        <div
          className="workflow-annotation"
          style={{
            marginTop: '28px',
            marginBottom: '28px',
            background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))',
            borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: '12px',
            padding: '20px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Sparkles size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--fg)', fontFamily: 'var(--body)' }}>
                Quick Guided Tour: The Lead Lifecycle
              </h3>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6 }}>
                New to the platform? Your leads move smoothly through three stages of verification before reaching their destination:
              </p>
            </div>
          </div>
        </div>

        {/* 3-Step Lead Lifecycle Grid */}
        <div
          className="landing-process"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            marginBottom: '32px',
          }}
        >
          {leadLifecycleSteps.map((s, i) => (
            <article className="landing-process__step" key={s.title} style={{ '--i': i }}>
              {i < leadLifecycleSteps.length - 1 && (
                <div className="landing-process__connector" aria-hidden="true">
                  <div className="landing-process__connector-line" style={{ '--i': i }} />
                </div>
              )}
              <div className="landing-process__node">
                <span className="landing-process__num">{s.num}</span>
                <s.icon size={18} aria-hidden="true" />
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>

        {/* Pipeline Simulation Grid */}
        <div className="landing-workflow__demo section-reveal" style={{ marginTop: '16px' }}>
          <div className="workflow-annotation">
            <p>
              <strong>Compliant Outbound Flow:</strong> Sourced candidates pass through rigorous ICP evaluation and regional suppression sweeps before AI models draft personalized outreach variants for human sign-off.
            </p>
          </div>
          <div className="unified-grid" style={{ height: '100%', alignItems: 'center' }}>
            <div className="unified-node">
              <span>Directory</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node unified-node--active">
              <span>ICP Score</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node">
              <span>Opt-In Sweep</span>
            </div>
            <div className="unified-connector" aria-hidden="true" />
            <div className="unified-node">
              <span>HITL Review</span>
            </div>
          </div>
        </div>

        {/* Custom Premium CTA */}
        <div className="app-tour__cta" style={{ marginTop: '56px' }}>
          <div>
            <h3>Ready to draft your first project?</h3>
            <p>Generate, script, and preview in offline mock mode completely free.</p>
          </div>
          <button 
            type="button" 
            className="landing-button landing-button--primary" 
            onClick={onLoginRequest}
          >
            <span className="landing-button__glow" />
            <span className="landing-button__text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Get Started <ArrowRight size={16} aria-hidden="true" />
            </span>
          </button>
        </div>
      </section>
    </Layout>
  )
}