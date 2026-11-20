export const site = {
  name: "Fyndra",
  tagline: "Search by problem, not by product.",
  description:
    "Fyndra is an AI-powered shopping discovery engine. Describe what you need, set your budget, and get products selected around your actual requirements — with transparent reasons for every recommendation.",
  owner: "Fyndra",
  email: "hello@fyndra.app",
  github: "https://github.com/Novai8",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  contactMailto: "mailto:hello@fyndra.app",
  title: "Fyndra — Find the right products without the endless searching",
} as const;

export const navLinks = [
  { href: "/discover", label: "Discover" },
  { href: "/setup-builder", label: "Setup builder" },
  { href: "/problem-solver", label: "Problem solver" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
] as const;

export const affiliateDisclosure = {
  short:
    "Links marked Affiliate earn us a commission if you buy something. It doesn't change what we recommend or what you pay.",
};
