import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Clapperboard, ChevronUp } from "lucide-react";
import { useTheme } from "../ThemeContext";
import SiteNav from "./SiteNav";
import "./landing.css";

/* Module scope, not state: the boot sequence belongs to the session, not
   to the component. Navigating between marketing pages must never replay
   it, and neither should a remount caused by a theme change. */
let bootPlayed = false;

export const footerColumns = [
  {
    heading: "XeliAI Ecosystem",
    links: [
      { label: "XeliAI Trivia", href: "https://trivia.xeliai.com/", external: true },
      { label: "XeliAI", href: "https://xeliai.com", external: true },
      { label: "XeliAI Blog", href: "https://xeliai.com/blog", external: true },
      { label: "Litesigma Tech", href: "https://litesigma.com", external: true },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Xeliai", href: "/about" },
      { label: "Contact Team", href: "/contact" },
      { label: "Trust & Governance", href: "/trust" },
      { label: "Changelog & Releases", href: "/changelog" },
    ],
  },
  {
    heading: "Product",
    links: [
      { label: "Studio Console", href: "/studio" },
      { label: "Lead Generation", href: "/leads" },
      { label: "Showcase Gallery", href: "/showcase" },
      { label: "Pricing & Tokens", href: "/pricing" },
      { label: "How It Works", href: "/how-it-works" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Architecture Tour", href: "/how-it-works" },
      { label: "Frequently Asked", href: "/faq" },
      { label: "Security Review", href: "/trust" },
      { label: "Technical Inquiries", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Tenancy & Compliance", href: "/trust" },
    ],
  },
];

function BootSequence() {
  const [done, setDone] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        if (sessionStorage.getItem("xeliai_boot_seen") === "1") return true;
      } catch {}
    }
    return bootPlayed;
  });
  const [gone, setGone] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        if (sessionStorage.getItem("xeliai_boot_seen") === "1") return true;
      } catch {}
    }
    return bootPlayed;
  });

  useEffect(() => {
    if (bootPlayed) {
      setDone(true);
      setGone(true);
      return undefined;
    }

    try {
      if (sessionStorage.getItem("xeliai_boot_seen") === "1") {
        bootPlayed = true;
        setDone(true);
        setGone(true);
        return undefined;
      }
    } catch {}

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      bootPlayed = true;
      setDone(true);
      setGone(true);
      return undefined;
    }

    /* Timers: fade begins at 450ms, removes at 750ms.
       Notice bootPlayed is only set when finished, ensuring React 18 StrictMode
       double-invoked effects don't cancel timers and leave bootPlayed permanently true. */
    const fade = window.setTimeout(() => setDone(true), 450);
    const remove = window.setTimeout(() => {
      bootPlayed = true;
      try {
        sessionStorage.setItem("xeliai_boot_seen", "1");
      } catch {}
      setGone(true);
    }, 750);

    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className="lp-boot"
      data-done={done ? "true" : "false"}
      aria-hidden="true"
      onClick={() => {
        bootPlayed = true;
        setDone(true);
        setGone(true);
      }}
    >
      <div className="lp-boot__mark">
        <div className="lp-boot__lamps"><i /><i /><i /><i /></div>
        <span className="lp-boot__word">XELIAI</span>
      </div>
    </div>
  );
}

function FooterBrand() {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  const logoSrc = theme === "dark" ? "/studio_logo_darkmode.webp" : "/studio_logo_lightmode.webp";

  return (
    <Link className="landing-brand" to="/">
      {failed ? (
        <>
          <Clapperboard size={20} strokeWidth={2} />
          <span>Xeliai Studio</span>
        </>
      ) : (
        <img
          src={logoSrc}
          alt="Xeliai Studio"
          className="landing-brand__logo"
          onError={() => setFailed(true)}
        />
      )}
    </Link>
  );
}

/**
 * Layout — the shell for every marketing route.
 *
 * Owns four things:
 *   1. the scoped theme root, mirroring <html data-theme> so landing.css
 *      can target it without fighting the app shell for specificity;
 *   2. the single scroll-reveal observer for the whole page;
 *   3. the route fade;
 *   4. the footer.
 *
 * `immersive` drops the footer and the fixed-nav offset, for full-bleed
 * pages such as the showcase gallery.
 */
export default function Layout({ children, onLoginRequest, immersive = false }) {
  const { theme } = useTheme();
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  /* One observer for the page rather than a hook per section. It covers
     both vocabularies: [data-reveal] on the landing page and
     .section-reveal on the inner pages. Each node unsubscribes the
     moment it lands, so nothing is still being watched after the
     visitor has scrolled past it. */
  useEffect(() => {
    const root = mainRef.current;
    if (!root) return undefined;

    const nodes = root.querySelectorAll("[data-reveal], .section-reveal");
    if (!nodes.length) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      nodes.forEach((n) => n.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [pathname, children]);

  const scrollToTop = (e) => {
    e.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="landing-page" data-theme={theme} data-immersive={immersive ? "true" : "false"}>
      <BootSequence />
      <SiteNav onLoginRequest={onLoginRequest} immersive={immersive} />

      <main key={pathname} ref={mainRef} className="lp-page lp-shell" id="top">
        {children}
      </main>

      {!immersive && (
        <footer className="landing-footer">
          <div className="landing-footer__container">
            <div className="landing-footer__brand-col">
              <FooterBrand />
              <p className="landing-footer__tagline">
                World-class AI education for learners at every level, research programs, and business solutions.
              </p>
            </div>

            <div className="landing-footer__grid">
              {footerColumns.map((col) => (
                <div className="landing-footer__col" key={col.heading}>
                  <span className="landing-footer__heading">{col.heading}</span>
                  <ul className="landing-footer__links">
                    {col.links.map((item) => (
                      <li key={item.href}>
                        {item.external ? (
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            {item.label}
                          </a>
                        ) : (
                          <Link to={item.href}>{item.label}</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-footer__bottom">
            <span>Xeliai Studio &copy; {new Date().getFullYear()}. All rights reserved.</span>
            <a href="#top" onClick={scrollToTop} className="landing-footer__back-to-top">
              Back to top <ChevronUp size={14} aria-hidden="true" />
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}