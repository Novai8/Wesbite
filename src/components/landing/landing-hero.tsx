"use client";

import Link from "next/link";
import { useState } from "react";
import { site } from "@/lib/site";

const navItems = [
  { href: "/discover", label: "Discover" },
  { href: "/categories", label: "Categories" },
  { href: "/problem-solver", label: "Find a fix" },
  { href: "/guides", label: "Guides" },
];

type CategoryLink = {
  name: string;
  href: string;
  count: number;
  description: string;
};

type Props = {
  categories: CategoryLink[];
};

function Mark() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none">
      <circle cx="10.4" cy="10.4" r="6.6" stroke="currentColor" strokeWidth="2.2" />
      <path d="M15.4 15.4 20.8 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="10.4" cy="10.4" r="2" fill="currentColor" />
    </svg>
  );
}

export function LandingHero({ categories }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section className="fyndra-story" aria-labelledby="fyndra-heading">
      <header className="story-nav-wrap">
        <div className="story-nav container-story">
          <Link href="/" className="story-brand" aria-label={`${site.name} home`}>
            <Mark />
            <span>{site.name}</span>
          </Link>

          <nav className="story-nav-links" aria-label="Primary">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="story-nav-actions">
            <Link href="/discover" className="story-nav-cta">
              Browse catalogue
              <span aria-hidden="true">↗</span>
            </Link>
            <button
              type="button"
              className="story-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="story-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="sr-only">Toggle menu</span>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                {menuOpen ? (
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div id="story-mobile-nav" className="story-mobile-nav">
            <div className="container-story">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <Link href="/discover" onClick={() => setMenuOpen(false)}>
                Browse catalogue
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <div className="story-rooms container-story">
        <section className="story-room story-room-hero" aria-labelledby="fyndra-heading">
          <div className="story-hero-copy">
            <p className="story-kicker">Shopping, with a point of view</p>
            <div className="story-hero-lockup">
              <h1 id="fyndra-heading" className="story-hero-wordmark">
                Fyndra
                <span className="sr-only"> — find the good stuff.</span>
              </h1>
              <p className="story-hero-tagline" aria-hidden="true">
                Find the good <em>stuff.</em>
              </p>
            </div>
            <p className="story-lede">
              Fyndra turns a vague problem into a short, honest list of things
              worth buying. No infinite feed. No sponsored fog.
            </p>
            <div className="story-actions">
              <Link href="/categories" className="story-button story-button-primary choose-category">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <rect x="3" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="14" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="3" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
                  <rect x="14" y="14" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                Choose category
              </Link>
              <Link href="/discover" className="story-button story-button-quiet">
                Explore the catalogue
              </Link>
              <Link href="/problem-solver" className="story-button story-button-quiet">
                Describe a problem
              </Link>
            </div>
          </div>

          <div className="story-hero-foot">
            <p className="story-hero-note">
              A curated catalogue of <strong>real products</strong> with
              transparent reasons.
            </p>
            <p className="story-hero-manifesto">
              <span>Real records</span>
              <span>No paid placement</span>
              <span>Verified prices</span>
            </p>
          </div>
        </section>

        <section id="story-discovery" className="story-room story-room-discovery" aria-labelledby="story-discovery-title">
          <div className="story-section-number" aria-hidden="true">
            02
          </div>
          <div className="story-copy-block">
            <p className="story-kicker story-kicker-light">The starting point</p>
            <h2 id="story-discovery-title">
              A good list starts with
              <br />
              <em>a better question.</em>
            </h2>
            <p>
              Tell Fyndra what is actually going wrong: a desk that hurts, a
              bag that swallows everything, a kitchen with no room left. The
              catalogue is the answer, not the beginning.
            </p>
            <Link href="/assistant" className="story-inline-link">
              Try the assistant
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="story-note-card">
            <span className="story-note-label">For example</span>
            <p>“I work from a small desk and my neck aches by 3pm.”</p>
            <hr />
            <p>
              A stand lifts the laptop without taking over the desk. A monitor
              arm gives the screen back its height. Two useful fixes, not a
              catalogue dump.
            </p>
          </div>
        </section>

        <section className="story-room story-room-catalogue" aria-labelledby="story-catalogue-title">
          <div className="story-catalogue-heading">
            <p className="story-kicker story-kicker-light">The shortlist</p>
            <h2 id="story-catalogue-title">
              Fewer things.
              <br />
              <em>Better chosen.</em>
            </h2>
          </div>

          <div className="story-product-strip">
            {categories.map((item, index) => (
              <Link key={item.href} href={item.href} className="story-category-card">
                <span className="story-category-index">0{index + 1}</span>
                <span className="story-category-name">{item.name}</span>
                <span className="story-category-count">
                  {item.count} product{item.count === 1 ? "" : "s"}
                </span>
                <span className="story-category-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="story-room story-room-method" aria-labelledby="story-method-title">
          <div className="story-method-graphic" aria-hidden="true">
            <span className="story-orbit story-orbit-one" />
            <span className="story-orbit story-orbit-two" />
            <span className="story-orbit story-orbit-three" />
            <span className="story-orbit-dot" />
          </div>
          <div className="story-method-copy">
            <p className="story-kicker story-kicker-light">Why it holds up</p>
            <h2 id="story-method-title">
              The reasoning is
              <br />
              <em>part of the product.</em>
            </h2>
            <ol>
              <li>
                <span>01</span>
                <p>Every price is traceable to its source record.</p>
              </li>
              <li>
                <span>02</span>
                <p>Every recommendation explains the trade-off, not just the win.</p>
              </li>
              <li>
                <span>03</span>
                <p>Affiliate links are labelled. The commission never changes the ranking.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="story-room story-room-final" aria-labelledby="story-final-title">
          <p className="story-kicker story-kicker-light">Your turn</p>
          <h2 id="story-final-title">
            What are you
            <br />
            <em>actually looking for?</em>
          </h2>
          <div className="story-final-actions">
            <Link href="/discover" className="story-button story-button-primary">
              Get the good list
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/guides/how-scoring-works" className="story-button story-button-dark-quiet">
              Read how scoring works
            </Link>
          </div>
          <p className="story-final-disclosure">
            Links marked Affiliate earn Fyndra a commission. It never changes
            what gets recommended.
          </p>
        </section>
      </div>
    </section>
  );
}
