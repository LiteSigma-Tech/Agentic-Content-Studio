import Layout from '../landing/Layout'

const entries = [
  {
    date: 'Aug 2026',
    tags: ['feature'],
    title: 'Activity Log and Notifications',
    body: 'A dedicated Activity Log now separates approval history, compliance events, and system events into their own views, and a Notifications panel surfaces run completions and failures without digging through project detail pages.',
  },
  {
    date: 'Jul 2026',
    tags: ['improvement'],
    title: 'Split video and audio lanes in Studio',
    body: 'The pipeline\u2019s audio half (cast voices \u2192 dialogue \u2192 music \u2192 mix \u2192 mux) now runs from its own Audio section, so a team can pick up an in-progress episode and continue it without re-opening the original run.',
    list: [
      'Continue an existing episode from any completed video stage',
      'Review and approve audio-lane stages independently of video-lane ones',
      'Final Mix view lists every completed render for quick playback',
    ],
  },
  {
    date: 'Jun 2026',
    tags: ['feature'],
    title: 'Per-stage review mode',
    body: 'Review mode pauses the pipeline after each of the 11 stages, showing a summary of what the stage produced and letting you approve, or reject with revision instructions that get appended to the retry prompt.',
  },
  {
    date: 'May 2026',
    tags: ['feature'],
    title: 'Leads funnel: source, qualify, comply, outreach',
    body: 'Lead sourcing, qualification scoring, and compliance checks (consent, suppression, region rules) now run as independent, re-triggerable steps feeding a single funnel, with an approval inbox gating every outreach send.',
  },
  {
    date: 'Apr 2026',
    tags: ['improvement'],
    title: 'Free-only routing became the default',
    body: 'New tenants now start in free-only mode with a $0.00 cap. Paid provider fallback is available per task but has to be explicitly enabled   spend caps apply the moment it is.',
  },
  {
    date: 'Mar 2026',
    tags: ['fix'],
    title: 'Resumable runs after a crash mid-render',
    body: 'Every stage now persists its result before the pipeline advances, so a run that fails on render or mux resumes from the last completed stage instead of restarting the whole episode.',
  },
  {
    date: 'Feb 2026',
    tags: ['feature'],
    title: 'Admin: tenant creation and webhooks',
    body: 'Admins can mint new tenants with a one-time API key, set cost and job caps per plan, and register signed webhooks for run.done and run.failed events.',
  },
  {
    date: 'Jan 2026',
    tags: ['feature', 'improvement'],
    title: 'Kids-content moderation gate',
    body: 'The kids_cartoon genre now routes script, dialogue, and music generation exclusively through providers flagged moderation_ok, enforced by the routing policy rather than left to a prompt.',
  },
]

const tagClass = {
  feature: 'timeline-tag timeline-tag--feature',
  improvement: 'timeline-tag timeline-tag--improvement',
  fix: 'timeline-tag timeline-tag--fix',
}

export default function Changelog({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Changelog</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">What shipped, when</span>
        </p>
        <h1>Release notes for the pipeline, the leads funnel, and everything governing them.</h1>
        <p className="page-hero__lead">
          We ship in small, reviewable increments. Anything that changes routing behavior, approval
          gates, or cost defaults gets called out explicitly below   not buried in a &quot; misc fixes&quot; line.
        </p>
      </section>

      <section className="page-section page-section--mb section-reveal">
        <div className="timeline">
          {entries.map((entry) => (
            <article className="timeline-entry" key={entry.title}>
              <div className="timeline-entry__rail">
                <span className="timeline-entry__dot" aria-hidden="true" />
              </div>
              <span className="timeline-entry__date">{entry.date}</span>
              <div className="timeline-entry__main">
                <div className="timeline-entry__tags">
                  {entry.tags.map((t) => (
                    <span className={tagClass[t]} key={t}>{t}</span>
                  ))}
                </div>
                <h3>{entry.title}</h3>
                <p>{entry.body}</p>
                {entry.list && (
                  <ul>
                    {entry.list.map((li) => <li key={li}>{li}</li>)}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  )
}