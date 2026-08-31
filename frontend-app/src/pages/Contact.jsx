import Layout from '../landing/Layout'
import { Mail, MessageSquare, ShieldCheck } from 'lucide-react'

export default function Contact({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Contact</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Get in touch</span>
        </p>
        <h1>We are here to help you build and scale your pipeline.</h1>
        <p className="page-hero__lead">
          Have questions about custom model routing, enterprise security questionnaires, or platform onboarding? Reach out below.
        </p>
      </section>

      <section className="page-section page-section--mb section-reveal">
        <div className="contact-grid">
          <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input type="text" id="name" placeholder="Your name" required />
            </div>
            <div className="field">
              <label htmlFor="email">Work Email</label>
              <input type="email" id="email" placeholder="you@company.com" required />
            </div>
            <div className="field">
              <label htmlFor="message">Message</label>
              <textarea id="message" rows={5} placeholder="How can we help you?" required />
            </div>
            <button type="submit" className="landing-button landing-button--primary">
              <span className="landing-button__text">Send Message</span>
            </button>
          </form>

          <div className="contact-info-cards">
            <article className="content-card">
              <span className="content-card__icon"><Mail size={20} aria-hidden="true" /></span>
              <h3>Product & Sales Inquiry</h3>
              <p>Speak directly with our engineering team regarding workspace setups and custom tiers.</p>
            </article>
            <article className="content-card">
              <span className="content-card__icon"><ShieldCheck size={20} aria-hidden="true" /></span>
              <h3>Security & Compliance</h3>
              <p>Request security documentation, audit logs, or custom compliance reviews.</p>
            </article>
          </div>
        </div>
      </section>
    </Layout>
  )
}