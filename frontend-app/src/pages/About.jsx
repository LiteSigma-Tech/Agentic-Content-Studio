import Layout from '../landing/Layout'
import { Sparkles, ShieldCheck, Target, Users, ArrowRight } from 'lucide-react'

const values = [
  {
    icon: Sparkles,
    title: 'Zero-Cost Prototyping',
    body: 'We believe you shouldn\'t spend a dollar on model APIs until your workflow and concepts are completely validated locally.',
  },
  {
    icon: ShieldCheck,
    title: 'Governance at the Gate',
    body: 'Safety and compliance shouldn\'t depend on prompts or developer discipline. We build review gates into the execution pipeline itself.',
  },
  {
    icon: Target,
    title: 'Deterministic Quality',
    body: 'AI output can be chaotic. By splitting production into 11 discrete, stateful stages, every episode achieves predictable perfection.',
  },
]

export default function About({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">About</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Our Mission</span>
        </p>
        <h1>Eliminating friction between creative concept and rendered reality.</h1>
        <p className="page-hero__lead">
          Agentic Content Studio was built to give modern content and growth teams a single, governed command center. We bridge concept, automation, and outreach without the vendor fragmentation.
        </p>
      </section>

      <section className="page-section section-reveal">
        <div className="page-section__head">
          <p className="landing-kicker">Core Principles</p>
          <h2>How we design the platform</h2>
        </div>
        <div className="content-grid">
          {values.map((v) => (
            <article className="content-card" key={v.title}>
              <span className="content-card__icon"><v.icon size={20} aria-hidden="true" /></span>
              <h3>{v.title}</h3>
              <p>{v.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final page-section--mb section-reveal">
        <div className="landing-final__copy">
          <h2>Ready to transform your production workflow?</h2>
          <p>Get started today with our free tier   no credit card or API keys required.</p>
          <div className="landing-final__actions">
            <button type="button" className="landing-button landing-button--primary" onClick={onLoginRequest}>
              <span className="landing-button__text">Start Free Mode</span>
              <ArrowRight size={16} aria-hidden="true" className="landing-button__icon" />
            </button>
          </div>
        </div>
      </section>
    </Layout>
  )
}