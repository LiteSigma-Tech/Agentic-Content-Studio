import Layout from '../landing/Layout'
import { Zap, Layers, Users, Globe } from 'lucide-react'

const steps = [
  {
    num: '01',
    title: 'Concept & Script Drafting',
    icon: Zap,
    body: 'Input your theme or campaign angle. The agent decomposes the request into an 11-stage production plan with auto-generated scripts and shot lists.',
  },
  {
    num: '02',
    title: 'Model Routing & Generation',
    icon: Layers,
    body: 'Tasks are routed to selected providers based on cost and genre rules. Offline mock modes keep spend at $0 during initial drafting.',
  },
  {
    num: '03',
    title: 'Human Review Checkpoint',
    icon: Users,
    body: 'Sensitive stages and outbound messaging pause for explicit operator review. Rejections include prompt feedback for instant retries.',
  },
  {
    num: '04',
    title: 'Audio Mix & Delivery',
    icon: Globe,
    body: 'Voice casting, background music scoring, and final FFMPEG muxing output publish-ready assets and triggers verified webhooks.',
  },
]

export default function HowItWorks({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">How It Works</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">System Architecture</span>
        </p>
        <h1>From initial concept to rendered delivery in four simple steps.</h1>
        <p className="page-hero__lead">
          Our stateful pipeline ensures that every step is persisted, reviewable, and resumable if interrupted mid-render.
        </p>
      </section>

      <section className="page-section page-section--mb section-reveal">
        <div className="landing-process" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {steps.map((s, i) => (
            <article className="landing-process__step" key={s.title} style={{ '--i': i }}>
              <div className="landing-process__node">
                <span className="landing-process__num">{s.num}</span>
                <s.icon size={18} aria-hidden="true" />
              </div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  )
}