import { DiscoveryScene } from "./discovery-scene";
import { HeroActions } from "./hero-actions";
import { HeroCopy } from "./hero-copy";
import { HeroQuote } from "./hero-quote";
import { HeroNavigation } from "./hero-navigation";
import { ScrollIndicator } from "./scroll-indicator";

export function LandingHero() {
  return (
    <section className="landing-hero" aria-labelledby="landing-hero-heading">
      <HeroNavigation />

      <div className="container-page">
        <div className="hero-grid">
          <div className="hero-column">
            <div id="landing-hero-heading">
              <HeroCopy />
            </div>
            <HeroActions />
            <HeroQuote />
          </div>

          <div className="hero-scene">
            <DiscoveryScene />
          </div>
        </div>

        <div className="hero-footer">
          <p className="hero-statement">
            Thoughtful discoveries. Better choices. Shopping made simpler.
          </p>
          <ScrollIndicator />
        </div>
      </div>
    </section>
  );
}
