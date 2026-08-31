import Layout from '../landing/Layout'
import { ArrowRight } from 'lucide-react'

const faqCategories = [
  {
    q: 'Can I use Agentic Content Studio completely offline?',
    a: 'Yes! Free mode uses local or mock providers with real FFMPEG rendering. You can design, script, and test complete pipelines on local hardware without incurring any GPU or API key charges.',
  },
  {
    q: 'How are cost caps enforced?',
    a: 'Cost caps are enforced strictly at the routing layer. If a tenant reaches its configured budget cap, the system automatically halts paid provider calls and falls back to free or mock routing.',
  },
  {
    q: 'What happens if a pipeline run crashes mid-render?',
    a: 'Every stage persists its output immediately upon completion. If a process fails or loses connection, clicking retry resumes from the last successful stage rather than restarting from step one.',
  },
  {
    q: 'Can outreach sends happen automatically without review?',
    a: 'No. Outbound outreach sends pause for human operator approval at the orchestration layer by default. Consent, suppression, and regional compliance are re-evaluated right at execution time.',
  },
]

export default function Faq({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">FAQ</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Common Questions</span>
        </p>
        <h1>Everything you need to know about the platform.</h1>
        <p className="page-hero__lead">
          Got questions about our review gates, cost caps, or local model execution? We have answers.
        </p>
      </section>

      <section className="page-section page-section--mb section-reveal">
        <div className="accordion">
          {faqCategories.map((item) => (
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
    </Layout>
  )
}