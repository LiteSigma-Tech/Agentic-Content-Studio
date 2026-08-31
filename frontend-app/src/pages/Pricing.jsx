import Layout from '../landing/Layout'
import { Check, ArrowRight } from 'lucide-react'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Perfect for testing workflows and rendering complete local prototypes.',
    featured: false,
    badge: null,
    features: [
      'Unlimited mock mode pipelines',
      'Free provider routing (Ollama / OpenRouter)',
      '11-stage video & audio pipeline',
      'Real FFMPEG rendering & mix',
      '1 Workspace tenant',
    ],
    buttonText: 'Start Free Mode',
  },
  {
    name: 'Pro',
    price: '$49',
    period: 'per month',
    desc: 'For active creators & teams scaling production with commercial API keys.',
    featured: true,
    badge: 'Most Popular',
    features: [
      'Everything in Free',
      'Paid provider fallback integration',
      'Hard spend caps & cost metering',
      'Full lead generation & outreach funnel',
      'Moderation-gated kids content filter',
      'Priority pipeline queue',
    ],
    buttonText: 'Get Started with Pro',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'billed annually',
    desc: 'Custom governance, dedicated compute, and tailored SLA agreements.',
    featured: false,
    badge: null,
    features: [
      'Everything in Pro',
      'Multi-tenant workspace isolation',
      'Custom webhook event signatures',
      'Dedicated moderation policy tuning',
      'Custom SLA & dedicated support channel',
      'Custom security questionnaires',
    ],
    buttonText: 'Contact Sales',
  },
]

export default function Pricing({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Pricing</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Predictable Costs</span>
        </p>
        <h1>Free-first economics. Pay only when you scale.</h1>
        <p className="page-hero__lead">
          Test everything at zero cost using mock and local models. When you opt into commercial providers, hard cost caps ensure you never get surprise bills.
        </p>
      </section>

     <section className="page-section page-section--mb section-reveal">
        <div className="pricing-grid">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`pricing-card--full ${t.featured ? 'pricing-card--featured' : ''}`}
            >
              {t.badge && <span className="pricing-card__badge-top">{t.badge}</span>}
              <h3 className="pricing-card__title">{t.name}</h3>
              <p className="pricing-card__desc">{t.desc}</p>
              <div className="pricing-card__price-row">
                <span className="pricing-card__price">{t.price}</span>
                <span className="pricing-card__period">/ {t.period}</span>
              </div>
              <ul className="pricing-card__feature-list">
                {t.features.map((f) => (
                  <li key={f} className="pricing-card__feature-item">
                    <Check size={16} aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`landing-button ${t.featured ? 'landing-button--primary' : 'landing-button--secondary'}`}
                onClick={onLoginRequest}
              >
                <span className="landing-button__text">{t.buttonText}</span>
                <ArrowRight size={16} aria-hidden="true" className="landing-button__icon" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  )
}