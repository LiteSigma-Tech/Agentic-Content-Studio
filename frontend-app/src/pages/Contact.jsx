import React, { useState } from 'react'
import Layout from '../landing/Layout'
import { Mail, ShieldCheck, Headphones, Send, CheckCircle2, Sparkles, ArrowUpRight } from 'lucide-react'

export default function Contact({ onLoginRequest }) {
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'Enterprise & Dedicated SLA',
    message: '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

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
          
          {/* Left Column: Direct Inquiry Form */}
          <div className="contact-card">
            {submitted ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', padding: '24px 8px' }}>
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: 999, 
                  background: 'color-mix(in srgb, var(--accent) 15%, transparent)', 
                  display: 'grid', 
                  placeItems: 'center',
                  color: 'var(--accent)',
                  marginBottom: 16
                }}>
                  <CheckCircle2 size={32} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px', color: 'var(--fg)', fontFamily: 'var(--display)' }}>
                  Message Received
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.6, maxWidth: 360, margin: '0 0 24px' }}>
                  Thank you for reaching out. We have logged your request and an engineer or account specialist will respond within 4 hours.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setFormData({ name: '', email: '', topic: 'Enterprise & Dedicated SLA', message: '' })
                  }}
                  className="landing-button landing-button--secondary"
                >
                  <span className="landing-button__text">Send Another Message</span>
                </button>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit}>
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: 'var(--fg)', fontFamily: 'var(--display)' }}>
                      Send a Message
                    </h2>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                      Tell us about your production goals, team requirements, or technical questions.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="field">
                      <label htmlFor="name">Full Name</label>
                      <input
                        type="text"
                        id="name"
                        placeholder="e.g. Alex Morgan"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="email">Work Email</label>
                      <input
                        type="email"
                        id="email"
                        placeholder="alex@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="topic">Topic of Interest</label>
                      <select
                        id="topic"
                        value={formData.topic}
                        onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      >
                        <option value="Enterprise & Dedicated SLA">Enterprise & Dedicated SLA</option>
                        <option value="Custom Model Routing & BYOK">Custom Model Routing & BYOK</option>
                        <option value="Security & Compliance Review">Security & Compliance Review</option>
                        <option value="Technical Support & Integration">Technical Support & Integration</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="message">Message</label>
                      <textarea
                        id="message"
                        rows={4}
                        placeholder="Tell us about your target volume, pipeline stages, or integration needs..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <button type="submit" className="landing-button landing-button--primary" style={{ width: '100%' }}>
                    <Send size={15} style={{ marginRight: 8 }} />
                    <span className="landing-button__text">Send Message</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: Direct Channels & SLA Overview */}
          <div className="contact-card">
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: 'var(--fg)', fontFamily: 'var(--display)' }}>
                Direct Channels
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
                Prefer direct communication? Connect directly with our specialized team desks.
              </p>

              <div className="contact-channel-list">
                {/* Channel 1 */}
                <div className="contact-channel-item">
                  <span className="contact-channel-item__icon">
                    <Sparkles size={18} aria-hidden="true" />
                  </span>
                  <div className="contact-channel-item__content">
                    <h4>Product & Architecture</h4>
                    <p>Discuss pipeline orchestration, multi-agent flows, and high-throughput batch rendering.</p>
                    <a href="mailto:enterprise@xeliaistudio.com" className="contact-channel-item__link">
                      enterprise@xeliaistudio.com
                      <ArrowUpRight size={12} />
                    </a>
                  </div>
                </div>

                {/* Channel 2 */}
                <div className="contact-channel-item">
                  <span className="contact-channel-item__icon">
                    <ShieldCheck size={18} aria-hidden="true" />
                  </span>
                  <div className="contact-channel-item__content">
                    <h4>Security & Dedicated Tenancy</h4>
                    <p>Request SOC2 Type II certifications, custom VPC setup, or security questionnaires.</p>
                    <a href="mailto:security@xeliaistudio.com" className="contact-channel-item__link">
                      security@xeliaistudio.com
                      <ArrowUpRight size={12} />
                    </a>
                  </div>
                </div>

                {/* Channel 3 */}
                <div className="contact-channel-item">
                  <span className="contact-channel-item__icon">
                    <Headphones size={18} aria-hidden="true" />
                  </span>
                  <div className="contact-channel-item__content">
                    <h4>Technical Support & SLA</h4>
                    <p>Live debugging for active studio pipelines and dedicated community Slack access.</p>
                    <a href="mailto:support@xeliaistudio.com" className="contact-channel-item__link">
                      support@xeliaistudio.com
                      <ArrowUpRight size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            
            
          </div>

        </div>
      </section>
    </Layout>
  )
}