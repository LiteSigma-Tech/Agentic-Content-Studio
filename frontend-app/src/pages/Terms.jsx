import Layout from '../landing/Layout'
import { Scale, UserCheck, CreditCard, ShieldAlert, Baby, LogOut, Gavel, FileText, Mail, ChevronRight, Calendar } from 'lucide-react'

const principles = [
  {
    icon: UserCheck,
    title: 'Provisioned Access',
    text: 'Tenants are created by us directly. There is no public registration or self-service signup.'
  },
  {
    icon: CreditCard,
    title: 'Hard Cost Caps',
    text: 'Spend limits are enforced at the routing layer, not advisory. Free mode is the default.'
  },
  {
    icon: ShieldAlert,
    title: 'Mandatory Approval',
    text: 'Every outbound outreach send pauses for explicit human approval. No exceptions.'
  },
  {
    icon: Baby,
    title: 'Content Moderation',
    text: 'Kids content routes through vetted providers only. This is enforced, not optional.'
  }
]

const toc = [
  { id: 'definitions', label: 'Definitions' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'usage', label: 'Acceptable Use' },
  { id: 'payment', label: 'Payment & Caps' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'content', label: 'Content Policies' },
  { id: 'termination', label: 'Termination' },
  { id: 'liability', label: 'Liability' },
  { id: 'governing', label: 'Governing Law' },
  { id: 'changes', label: 'Changes' }
]

export default function Terms({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      {/* ─── HERO ─── */}
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Terms of Service</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Usage boundaries</span>
        </p>
        <h1>The agreement between your organization and the platform.</h1>
        <p className="page-hero__lead">
          These Terms of Service govern access to and use of the Xeliai  Studio platform. 
          They are written for clarity ahead of formal counsel review and reflect the operational 
          limits and enforcement mechanisms active in the current build.
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

            <div className="page-doc__section" id="definitions">
              <h2>1. Definitions</h2>
              <p>
                <strong>"Platform"</strong> refers to the Xeliai  Studio software, 
                including all associated APIs, interfaces, and documentation. 
                <strong>"Tenant"</strong> refers to a provisioned workspace instance. 
                <strong>"Admin"</strong> refers to the designated administrator of a tenant. 
                <strong>"Operator"</strong> refers to any user granted access to a tenant by its admin. 
                <strong>"Content"</strong> refers to all media, text, and data generated, uploaded, 
                or processed through the platform.
              </p>
            </div>

            <div className="page-doc__section" id="accounts">
              <h2>2. Accounts & Provisioning</h2>
              <p>
                Tenants are provisioned exclusively by the platform team. There is no public 
                self-signup. Once provisioned, the designated admin controls user access, role 
                assignments, and tenant-wide settings.
              </p>
              <p>
                The admin is solely responsible for all activity occurring under their tenant, 
                including content produced, outreach sent, and compliance with applicable laws. 
                Admins must ensure all operators are bound by appropriate confidentiality and 
                usage obligations.
              </p>
              <div className="page-doc__callout page-doc__callout--warn">
                <ShieldAlert size={18} aria-hidden="true" />
                <div>
                  <strong>Account security</strong>
                  <p style={{ margin: 0 }}>
                    You are responsible for maintaining the confidentiality of your credentials. 
                    Notify us immediately of any unauthorized access or security breach.
                  </p>
                </div>
              </div>
            </div>

            <div className="page-doc__section" id="usage">
              <h2>3. Acceptable Use</h2>
              <p>You agree not to use the platform to:</p>
              <ul className="page-doc__list">
                <li>Generate or distribute unlawful, defamatory, harassing, or discriminatory content.</li>
                <li>Circumvent human approval gates, cost caps, or compliance checks.</li>
                <li>Reverse engineer, decompile, or extract source code from the platform.</li>
                <li>Upload lead data without lawful basis or proper consent documentation.</li>
                <li>Overload infrastructure through automated abuse, denial-of-service attacks, or excessive API polling.</li>
                <li>Impersonate any person or misrepresent your affiliation with any entity.</li>
              </ul>
              <p>
                We reserve the right to suspend or restrict access immediately upon detection of 
                prohibited use, with or without prior notice.
              </p>
            </div>

            <div className="page-doc__section" id="payment">
              <h2>4. Payment & Cost Caps</h2>
              <p>
                Every tenant operates under an explicit cost cap and job concurrency limit, 
                configured at provisioning and adjustable only by platform administrators. 
                Free-only routing is the default state; all generation runs use local or 
                zero-cost providers unless an admin explicitly opts into paid fallback.
              </p>
              <p>
                Paid fallback usage is metered in real time. The platform enforces the cap at 
                the routing layer; requests that would exceed the cap are rejected automatically. 
                No overage billing occurs. Invoices, where applicable, are issued monthly in 
                arrears.
              </p>
            </div>

            <div className="page-doc__section" id="compliance">
              <h2>5. Compliance & Outreach</h2>
              <p>
                All outreach campaigns are subject to mandatory human-in-the-loop approval. 
                The platform enforces this structurally: sends cannot proceed without explicit 
                admin or operator approval in the UI.
              </p>
              <p>
                Consent validation, suppression list checking, and region-gating run automatically 
                before every approved send. You are responsible for the accuracy and completeness 
                of the consent and suppression data you supply. The platform verifies format and 
                presence; it does not independently verify the legal basis of every record.
              </p>
            </div>

            <div className="page-doc__section" id="content">
              <h2>6. Content Policies</h2>
              <p>
                Content generated through the platform remains the property of the tenant that 
                created it, subject to any third-party provider terms applicable to paid fallback 
                generations. We claim no ownership over your outputs.
              </p>
              <p>
                The <code>kids_cartoon</code> genre and any designated child-facing content 
                pipelines route exclusively through moderation-vetted providers. This restriction 
                is enforced by the routing policy and cannot be disabled or overridden from 
                within a tenant.
              </p>
            </div>

            <div className="page-doc__section" id="termination">
              <h2>7. Termination</h2>
              <p>
                Either party may terminate the service arrangement with 30 days' written notice. 
                Upon termination, the tenant enters a 90-day retention window during which data 
                export is available. After this period, data is securely deleted in accordance 
                with the Privacy Policy.
              </p>
              <p>
                We may terminate or suspend immediately, without notice, for material breach of 
                these terms, unlawful use, or actions that endanger platform integrity or other 
                tenants.
              </p>
            </div>

            <div className="page-doc__section" id="liability">
              <h2>8. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, the platform team's aggregate liability 
                shall not exceed the total amount paid by your tenant in the twelve months 
                preceding the claim. We are not liable for indirect, incidental, special, 
                consequential, or punitive damages, including lost profits or data loss, arising 
                out of or relating to your use of the platform.
              </p>
              <p>
                The platform is provided "as is" without warranties of any kind, express or 
                implied, except where prohibited by law.
              </p>
            </div>

            <div className="page-doc__section" id="governing">
              <h2>9. Governing Law</h2>
              <p>
                These terms are governed by the laws of the jurisdiction in which the platform 
                entity contracting with your tenant is incorporated, without regard to conflict 
                of law principles. Disputes shall first attempt resolution through good-faith 
                negotiation, followed by binding arbitration if unresolved within 60 days.
              </p>
            </div>

            <div className="page-doc__section" id="changes">
              <h2>10. Changes to These Terms</h2>
              <p>
                We may modify these terms as the platform evolves. Material changes will be 
                communicated to tenant admins at least 30 days before taking effect. Continued 
                use after the effective date constitutes acceptance. If you do not agree to the 
                revised terms, you must cease use and request data export before the effective date.
              </p>
            </div>

            <div className="page-doc__section">
              <h2>Contact</h2>
              <p>
                For questions about these terms, contact your tenant admin or reach us directly.
              </p>
              <div className="page-doc__actions">
                <a href="/contact" className="landing-button landing-button--secondary">
                  <Mail size={14} aria-hidden="true" />
                  <span className="landing-button__text">Contact us</span>
                </a>
                <a href="/privacy" className="landing-button landing-button--secondary">
                  <FileText size={14} aria-hidden="true" />
                  <span className="landing-button__text">Privacy Policy</span>
                </a>
              </div>
            </div>
          </article>
        </div>
      </section>
    </Layout>
  )
}