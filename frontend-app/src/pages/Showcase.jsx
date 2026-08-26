import Layout from '../landing/Layout'
import { ImagePlaceholder } from '../landing/SharedComponents'

const showcaseItems = [
  {
    title: 'Cyberpunk Explainer Series',
    category: 'Full Production',
    desc: 'Rendered in 11 stages: concept, voice casting, stylized keyframes, and final audio mix.',
    aspect: '16:9',
  },
  {
    title: 'Saas Product Demo Reel',
    category: 'Product & Growth',
    desc: 'Automated script-to-video workflow with lead capture gates integrated directly into outreach.',
    aspect: '16:9',
  },
  {
    title: 'Animated Kids Storybook',
    category: 'Moderation Vetted',
    desc: 'Script, voice, and soundtrack processed strictly through moderation-approved model providers.',
    aspect: '16:9',
  },
  {
    title: 'Automated Daily News Recap',
    category: 'Pipeline Automation',
    desc: 'Batch render of daily micro-episodes built and published within a 10-minute turnaround.',
    aspect: '16:9',
  },
]

export default function Showcase({ onLoginRequest }) {
  return (
    <Layout onLoginRequest={onLoginRequest}>
      <section className="page-hero section-reveal">
        <p className="landing-kicker">
          <span className="landing-kicker__badge">Showcase</span>
          <span className="landing-kicker__separator" aria-hidden="true" />
          <span className="landing-kicker__text">Output Gallery</span>
        </p>
        <h1>Sample episodes generated entirely by the pipeline.</h1>
        <p className="page-hero__lead">
          Explore rendered assets, storyboards, and audio mixes produced across different genres and pipeline configurations.
        </p>
      </section>

      <section className="page-section page-section--mb  section-reveal">
        <div className="showcase-grid">
          {showcaseItems.map((item) => (
            <article className="showcase-card" key={item.title}>
              <div className="showcase-card__visual">
                <ImagePlaceholder label={item.title} aspect={item.aspect} />
              </div>
              <div className="showcase-card__body">
                <span className="showcase-card__tag">{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  )
}