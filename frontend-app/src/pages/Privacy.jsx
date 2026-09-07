import Layout from '../landing/Layout'
import { Shield, EyeOff, Download, Globe, Lock, FileText, Mail, Calendar, ChevronRight } from 'lucide-react'

const principles = [
  {
    icon: Lock,
    title: 'Tenant Isolation',
    text: "Every tenant's data is logically and physically segmented. No cross-tenant access by default."
  },
  {
    icon: EyeOff,
    title: 'No Model Training',
    text: 'Your prompts, outputs, and lead data are never used to train or fine-tune AI models.'
  },
  {
    icon: Download,
    title: 'Full Export',
    text: 'Request a complete data export at any time. We provide machine-readable dumps within 72 hours.'
  },
  {
    icon: Globe,
    title: 'Transparent Routing',
    text: 'Every generation log shows exactly which provider handled the request and under what terms.'
  }
]

const toc = [
  { id: 'scope', label: 'Scope' },
  { id: 'collection', label: 'What We Collect' },
  { id: 'usage', label: 'How We Use It' },
  { id: 'prohibited', label: 'What We Never Do' },
  { id: 'retention', label: 'Retention & Deletion' },
  { id: 'providers', label: 'Subprocessors' },
  { id: 'rights', label: 'Your Rights' },
  { id: 'changes', label: 'Changes' },
  { id: 'contact', label: 'Contact' }
]

export default function Privacy({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      {/* ─── HERO ─── */}
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Privacy</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Data handling & stewardship</span>
        </p>
        <h1>How we process data, what control you retain, and what we never touch.</h1>
        <p className="page-hero__lead">
          This policy describes the data practices of the Xeliai  Studio platform. 
          It is written in plain language and will be superseded by counsel-reviewed terms 
          before general availability, but the operational behaviors described here are 
          accurate to the current build.
        </p>
      </section>

      {/* ─── PRINCIPLES ─── */}
      <section className="page-section section-reveal" style={{ paddingTop: 24 }}>
        <div className="page-doc__grid">
          {principles.map((p) => (
            <div className="page-doc__principle" key={p.title}>
              <div className="page-doc__principle-icon">
                <p.icon size={18} />
              </div>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── DOCUMENT BODY ─── */}
      <section className="page-section page-section--mb section-reveal">
        <div className="page-doc__layout">
          {/* Sidebar TOC */}
          <aside className="page-doc__toc" aria-label="Table of contents">
            <nav>
              <span className="page-doc__toc-title">Contents</span>
              <ul>
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="page-doc__toc-link">
                      <ChevronRight size={12} aria-hidden="true" />
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Main document */}
          <article className="page-doc">
            <header className="page-doc__header">
              <span className="page-doc__updated">
                <Calendar size={12} aria-hidden="true" />
                Last updated: August 2026
              </span>
            </header>

            <div className="page-doc__section" id="scope">
              <h2>1. Scope</h2>
              <p>
                This Privacy Policy applies to all data processed by the Xeliai  Studio 
                platform on behalf of provisioned tenants and their authorized users. It governs 
                the collection, use, storage, and deletion of tenant data, including project 
                configurations, generated media assets, pipeline execution logs, and lead 
                outreach records.
              </p>
              <p>
                By using the platform, you acknowledge that your tenant admin has accepted these 
                terms on behalf of your organization. If you are the tenant admin, you are 
                responsible for ensuring all users within your tenant are aware of this policy.
              </p>
            </div>

            <div className="page-doc__section" id="collection">
              <h2>2. What We Collect</h2>
              <p>We process only the data necessary to operate the platform:</p>
              <ul className="page-doc__list">
                <li><strong>Account data:</strong> Tenant name, admin contact, billing entity, and user roles.</li>
                <li><strong>Project data:</strong> Scripts, storyboards, voice parameters, render settings, and episode metadata.</li>
                <li><strong>Generated assets:</strong> Audio, video, and image outputs produced by the pipeline.</li>
                <li><strong>Pipeline logs:</strong> Execution traces, checkpoint states, and provider routing decisions.</li>
                <li><strong>Lead data:</strong> Sourced prospect information, consent flags, suppression lists, and outreach history provided by you or imported under your direction.</li>
              </ul>
            </div>

            <div className="page-doc__section" id="usage">
              <h2>3. How We Use It</h2>
              <p>
                Data is used solely to deliver the services you have engaged: content production, 
                lead scoring, compliance verification, and approved outreach execution. We do not 
                process data for advertising, profiling, or any purpose unrelated to platform 
                functionality.
              </p>
              <p>
                Provider routing decisions are logged per-run so you can audit which subprocessors 
                handled specific generations. Free-only routing keeps all compute local; paid 
                fallback routes only the specific request to the designated third-party provider.
              </p>
            </div>

            <div className="page-doc__section" id="prohibited">
              <h2>4. What We Never Do</h2>
              <div className="page-doc__callout page-doc__callout--success">
                <Shield size={18} aria-hidden="true" />
                <div>
                  <strong>Absolute prohibitions</strong>
                  <ul className="page-doc__list--checks">
                    <li>We do not use your prompts or outputs to train, fine-tune, or improve any machine learning model.</li>
                    <li>We do not sell, rent, or share lead data with third-party advertisers or data brokers.</li>
                    <li>We do not allow cross-tenant data access unless explicitly authorized by both tenant admins in writing.</li>
                    <li>We do not process payment data; all billing is handled by our PCI-compliant payment processor.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="page-doc__section" id="retention">
              <h2>5. Retention & Deletion</h2>
              <p>
                Active tenant data is retained for the duration of your subscription. Upon 
                cancellation or downgrade, data enters a 90-day retention window during which 
                full export is available. After this window, data is queued for secure deletion 
                within 30 days.
              </p>
              <p>
                Immediate deletion can be requested at any time by your tenant admin through the 
                workspace settings. Deletion requests are acknowledged within 24 hours and 
                executed irreversibly within 72 hours, subject to any legal hold obligations.
              </p>
            </div>

            <div className="page-doc__section" id="providers">
              <h2>6. Subprocessors & Model Providers</h2>
              <p>
                When you opt into paid provider fallback, your requests are transmitted to the 
                specific third-party AI provider selected in your routing configuration. Each 
                provider operates under its own data processing terms. We maintain an up-to-date 
                list of active subprocessors, including their jurisdictions and applicable 
                safeguards, available upon request.
              </p>
              <p>
                Free-only and mock-mode pipelines do not transmit generation data to external 
                providers. All compute occurs within your tenant`&apos;`s isolated environment.
              </p>
            </div>

            <div className="page-doc__section" id="rights">
              <h2>7. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="page-doc__list">
                <li>Access the personal data we hold about you or your tenant.</li>
                <li>Request correction of inaccurate or incomplete data.</li>
                <li>Request restriction or objection to certain processing activities.</li>
                <li>Receive a portable copy of your data in a structured, machine-readable format.</li>
                <li>Withdraw consent where processing is based on consent, without affecting the lawfulness of processing before withdrawal.</li>
              </ul>
              <p>
                To exercise these rights, contact your tenant admin or reach us directly via the 
                Contact page. We respond to all verifiable requests within 30 days.
              </p>
            </div>

            <div className="page-doc__section" id="changes">
              <h2>8. Changes to This Policy</h2>
              <p>
                We may update this policy as the platform evolves or as required by law. Material 
                changes will be notified to tenant admins at least 30 days before taking effect. 
                Continued use after the effective date constitutes acceptance of the revised policy.
              </p>
            </div>

            <div className="page-doc__section" id="contact">
              <h2>9. Contact</h2>
              <p>
                For data-related inquiries, deletion requests, or subprocessor documentation, 
                contact your workspace admin or reach the platform team directly.
              </p>
              <div className="page-doc__actions">
                <a href="/contact" className="landing-button landing-button--secondary">
                  <Mail size={14} aria-hidden="true" />
                  <span className="landing-button__text">Contact us</span>
                </a>
                <a href="/trust" className="landing-button landing-button--secondary">
                  <FileText size={14} aria-hidden="true" />
                  <span className="landing-button__text">Trust & Security</span>
                </a>
              </div>
            </div>
          </article>
        </div>
      </section>
    </Layout>
  )
}