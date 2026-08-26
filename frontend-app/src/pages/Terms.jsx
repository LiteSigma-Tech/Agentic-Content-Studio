import Layout from '../landing/Layout'

export default function Terms({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Terms</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Usage boundaries</span>
        </p>
        <h1>What using the platform means for operators, admins, and tenants.</h1>
        <p className="page-hero__lead">
          A working draft, written for clarity ahead of counsel review. It reflects how the
          platform actually enforces limits today, not aspirational language.
        </p>
      </section>
      <section className="page-section page-section--mb section-reveal">
        <div className="page-doc">
          <p className="page-doc__updated">Last updated   August 2026</p>
          <h2>Accounts and tenants</h2>
          <p>
            Tenants are admin-provisioned; there is no public self-signup. Whoever creates a tenant
            is responsible for the operators and admins they grant access to within it, and for the
            outreach sent under that tenant&#39;s name.
          </p>
          <h2>Cost caps and usage</h2>
          <p>
            Every tenant has an explicit cost cap and job cap, tracked by the tenant&#39;s main admin
            rather than per individual user. Free-only routing keeps spend at $0.00 until an admin
            opts in to paid provider fallback   the cap is enforced at the routing layer, not
            advisory.
          </p>
          <h2>Outreach and compliance</h2>
          <p>
            Outreach sends pause for human approval with no exceptions. Consent, suppression, and
            region checks run before every send and again at the moment of send. You are
            responsible for the accuracy of consent and suppression data your tenant supplies.
          </p>
          <h2>Kids content</h2>
          <p>
            The kids_cartoon genre routes exclusively through moderation-vetted providers. This
            restriction is enforced by the routing policy and cannot be disabled from within a
            tenant.
          </p>
          <h2>Termination</h2>
          <p>
            Either party may end the arrangement per the retention terms described on the Privacy
            page. Data export remains available for the defined retention window after
            cancellation.
          </p>
        </div>
      </section>
    </Layout>
  )
}