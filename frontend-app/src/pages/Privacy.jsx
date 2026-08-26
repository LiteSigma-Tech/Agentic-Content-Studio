import Layout from '../landing/Layout'

export default function Privacy({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Privacy</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Data handling</span>
        </p>
        <h1>What we process, why, and what control you keep over it.</h1>
        <p className="page-hero__lead">
          This is a working draft written in plain terms. It will be replaced by counsel-reviewed
          language before a broader rollout, but the underlying behavior described here is accurate
          to how the platform operates today.
        </p>
      </section>
      <section className="page-section page-section--mb section-reveal">
        <div className="page-doc">
          <p className="page-doc__updated">Last updated   August 2026</p>
          <h2>What we process</h2>
          <p>
            Each tenant&#39;s data   projects, generated assets, run history, and sourced leads   is
            scoped to that tenant and is not shared with other tenants. We process it to run your
            pipeline: producing content, scoring leads, and executing approved outreach.
          </p>
          <h2>What we don&#39;t do with it</h2>
          <ul>
            <li>Your prompts and generated assets are not used to train or fine-tune any model, ours or a provider&#39;s.</li>
            <li>Lead data is not sold, shared with third-party advertisers, or used outside your own outreach campaigns.</li>
            <li>Nothing crosses tenant boundaries by default.</li>
          </ul>
          <h2>Retention and export</h2>
          <p>
            Tenant data remains available for export for a defined retention window after
            cancellation or downgrade. Full deletion can be requested at any time through your
            workspace admin   see Trust &amp; Security for how that request is handled.
          </p>
          <h2>Third-party model providers</h2>
          <p>
            Requests routed to paid provider fallback are sent under that provider&#39;s own data
            handling terms. Free-only routing keeps generation local by default. Which provider
            handled a given run is visible in that run&#39;s activity log.
          </p>
          <h2>Contact</h2>
          <p>
            Questions about a specific tenant&#39;s data can go through your workspace admin, or
            directly to us via the Contact page.
          </p>
        </div>
      </section>
    </Layout>
  )
}