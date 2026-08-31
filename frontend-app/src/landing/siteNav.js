// Single source of truth for the marketing nav + footer links.
// Layout.jsx uses these as its defaults. Don't pass a custom `navLinks` /
// `footerColumns` prop from individual pages unless a page genuinely needs
// a different nav — that's how the landing page and the rest of the site
// ended up with two different nav bars before.

export const navLinks = [
  { label: 'Showcase', href: '/showcase' },
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

export const footerColumns = [
  {
    heading: 'Product',
    links: [
      { label: 'Studio', href: '/studio' },
      { label: 'Leads', href: '/leads' },
      { label: 'Showcase', href: '/showcase' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Trust & Security', href: '/trust' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
]
