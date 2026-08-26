import { Check, X as XIcon, ShieldCheck, Lock, Users, BarChart3, Cpu, Server, Gauge, KeyRound, ArrowRight } from 'lucide-react'
import Layout from '../landing/Layout'

const pillars = [
  {
    icon: Lock,
    title: 'Tenant isolation',
    body: 'Every workspace is a separate tenant with its own leads, projects, spend, and API key. Nothing is shared across tenants by default.',
  },
  {
    icon: Users,
    title: 'Human approval gates',
    body: 'Outreach sends and, optionally, every pipeline stage pause for explicit approval before continuing. The send tool re-checks suppression at execution time   approving someone who unsubscribed still won\u2019t send.',
  },
  {
    icon: ShieldCheck,
    title: 'Moderation-gated kids content',
    body: 'Scripts, dialogue, and music for kids_cartoon content are routed exclusively through providers flagged moderation_ok. That routing rule lives in the policy engine, not in a prompt someone could talk around.',
  },
  {
    icon: Gauge,
    title: 'Hard cost and job caps',
    body: 'Every tenant has an explicit cost cap and job cap. Free-only routing keeps spend at $0.00 until an admin opts in to paid fallback   and even then, the cap is enforced, not advisory.',
  },
  {
    icon: KeyRound,
    title: 'One-time key issuance',
    body: 'API keys are shown once at tenant creation and never again. There is no UI path that can reveal an existing plaintext key   recovery requires an explicit revoke-and-reissue.',
  },
  {
    icon: Server,
    title: 'Signed webhook delivery',
    body: 'run.done and run.failed events are delivered to registered HTTPS endpoints with a shared secret, so your systems can verify events actually came from us.',
  },
]

const faqs = [
  {
    q: 'Can content ever bypass the review gate?',
    a: 'No. Review mode pauses the pipeline after each stage at the orchestration layer, not inside a model call. There is no prompt or setting that skips it while review mode is on, and outreach approval is never optional regardless of mode.',
  },
  {
    q: 'What happens to data if we downgrade or cancel?',
    a: 'Tenant data (projects, leads, run history) remains available for export for a defined retention window after cancellation. Full deletion can be requested at any time through your workspace admin.',
  },
  {
    q: 'Do you train models on our content or leads?',
    a: 'No. Your prompts, generated assets, and lead data are used only to run your pipeline and are not used to train or fine-tune any model, ours or a provider\u2019s.',
  },
  {
    q: 'How is kids content specifically protected?',
    a: 'The kids_cartoon genre routes script, dialogue, and music generation exclusively to providers explicitly flagged moderation_ok in the provider catalogue. That restriction is enforced by the routing layer regardless of your free/paid settings.',
  },
]

export default function Trust({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Trust &amp; Security</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Governance by design</span>
        </p>
        <h1>Approval checkpoints and compliance gates are structural   not footnotes.</h1>
        <p className="page-hero__lead">
          We built safety into the routing layer, not the prompt layer. That means it cant be
          talked around by a clever instruction, and it doesn t depend on a reviewer remembering
          to check something manually.
        </p>
      </section>

      <section className="landing-trust section-reveal" id="checkpoint">
        <div className="landing-trust__copy">
          <p className="landing-kicker">Live example</p>
          <h2>Every send pauses here   including ones you approved before.</h2>
          <p className="landing-trust__lead">
            The approval inbox shows exactly what will go out, to whom, and what already passed
            compliance. Nothing sends without an explicit click, and the suppression check runs
            again at the moment of send, not just at the moment of drafting.
          </p>
          <ul className="trust-checklist">
            {[
              { icon: Lock, text: 'Outreach sends pause for human approval. No exceptions.' },
              { icon: ShieldCheck, text: 'Consent, suppression, and region gates run before every send.' },
              { icon: Users, text: 'Kids content routes exclusively through moderation-vetted providers.' },
              { icon: BarChart3, text: 'Every action is metered, traced, and bound to tenant quotas.' },
              { icon: Cpu, text: 'Run fully offline with zero GPU or API keys required.' },
            ].map((item, i) => (
              <li key={item.text} style={{ '--check-i': i }}>
                <span className="trust-checklist__icon"><item.icon size={18} aria-hidden="true" /></span>
                <span className="trust-checklist__text">{item.text}</span>
              </li>
            ))}
          </ul>
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

      <section className="page-section section-reveal">
        <div className="page-section__head">
          <p className="landing-kicker" style={{ justifyContent: 'center' }}>
            <span className="landing-kicker__badge">How it holds together</span>
          </p>
          <h2>Six controls that run underneath every workspace.</h2>
        </div>
        <div className="content-grid">
          {pillars.map((p) => (
            <article className="content-card" key={p.title}>
              <span className="content-card__icon"><p.icon size={20} aria-hidden="true" /></span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-section section-reveal">
        <div className="page-section__head">
          <p className="landing-kicker" style={{ justifyContent: 'center' }}>
            <span className="landing-kicker__badge">Questions we get often</span>
          </p>
          <h2>Trust, answered directly.</h2>
        </div>
        <div className="accordion">
          {faqs.map((item) => (
            <details className="accordion-item" key={item.q}>
              <summary>
                {item.q}
                <ArrowRight size={16} aria-hidden="true" />
              </summary>
              <div className="accordion-item__body">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-final page-section--mb section-reveal">
        <div className="landing-final__copy">
          <h2>Have a security questionnaire or a specific compliance requirement?</h2>
          <p>Send it over   we&apos;ll walk your team through exactly how each control is implemented.</p>
          <div className="landing-final__actions">
            <a className="landing-button landing-button--primary" href="/contact">
              <span className="landing-button__text">Contact security</span>
              <ArrowRight size={16} aria-hidden="true" className="landing-button__icon" />
              <span className="landing-button__glow" aria-hidden="true" />
            </a>
            <button type="button" className="landing-button landing-button--secondary" onClick={() => onLoginRequest?.()}>
              <span className="landing-button__text">Start in free mode</span>
              <span className="landing-button__glow" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="landing-final__visual" aria-hidden="true">
          <div className="final-rings"><span /><span /><span /></div>
        </div>
      </section>
    </Layout>
  )
}