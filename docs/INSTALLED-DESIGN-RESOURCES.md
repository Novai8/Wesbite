# Installed Design Resources

Record of third-party design skills and UI component libraries used by this project, with sources, installation methods, licences and intended use. Verify licences before redistributing any of these resources on their own.

## Design skills (project-local, `.claude/skills/`)

| Skill | Source repository | Installed via | Licence | Intended use |
| --- | --- | --- | --- | --- |
| `frontend-design` | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) (plugin `frontend-design`) | Copied from local plugin marketplace into `.claude/skills/frontend-design` | Apache-2.0 | Distinctive, non-templated visual direction during implementation |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `npx ui-ux-pro-max-cli init --ai claude` | MIT | Design-system search: styles, palettes, typography pairings, UX guidelines |
| `vercel-react-best-practices`, `web-design-guidelines`, `vercel-composition-patterns`, `vercel-optimize` (+ other Vercel skills) | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `npx skills@latest add vercel-labs/agent-skills --agent claude-code` | MIT (per repo) | React performance rules; web interface / accessibility audits |
| `emil-design-eng`, `apple-design`, `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `remove-animations`, `pick-ui-library`, `choreograph`, `learn-taste` (+ others) | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `npx skills@latest add emilkowalski/skills --agent claude-code` | MIT (per repo) | Interaction polish, restrained animation timing, press/hover states |
| `ui-init`, `design-grill`, `uiux`, `uicolor`, `tokens`, `animate`, `copy`, `a11y`, `landing` | [dawitlabs/ui-skills](https://github.com/dawitlabs/ui-skills) | `npx skills@latest add dawitlabs/ui-skills --agent claude-code` | MIT (per repo) | Token enforcement, color audit, accessibility audits, landing conversion review |

Notes:

- All skills are installed project-local under `.claude/skills/` so they travel with the repository and do not overwrite any user-global skills.
- `python` 3.14 is available for the `ui-ux-pro-max` search scripts (run with `python -I` and the script directory on `sys.path`).
- The `frontend-design` skill was obtained from the already-configured official Anthropic plugin marketplace (`claude-plugins-official`), then copied into the project. The marketplace commands `/plugin marketplace add anthropics/claude-plugins-official` and `/plugin install frontend-design@claude-plugins-official` were not required because the marketplace was already present.

## UI component libraries (evaluation)

| Library | Repository | Licence | Decision |
| --- | --- | --- | --- |
| shadcn/ui | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | MIT (code copied into project, no runtime dependency) | **Used** — principal component foundation. Components are vendored, so licence obligations are the repo's own. |
| Kokonut UI | [kokonut-labs/kokonutui](https://github.com/kokonut-labs/kokonutui) | MIT | **Evaluated / selective use** — advanced controls where they fit without conflicting with the design system. |
| Magic UI | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) | MIT | **Evaluated / selective use** — a small number of visual components for homepage/promotional sections. |
| Motion Primitives | [ibelick/motion-primitives](https://github.com/ibelick/motion-primitives) | MIT | **Used / selective** — motion components for reveals, transitions and interaction feedback (uses `motion`, already a dependency family). |
| React Bits | [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits) | MIT + **Commons Clause v1.0** | **Not used.** The Commons Clause restricts selling/sub-licensing/redistributing the components themselves. Use inside this application would likely be permitted, but the directive prefers permissive-only when uncertain, and fully MIT alternatives (Magic UI, Motion Primitives, shadcn/ui) cover the same needs. |
| Lucide | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) (npm `lucide-react`, ISC) | ISC | **Used** — all icons throughout the application. Already a dependency. |

## Rules observed

- No component was installed wholesale; each adopted component's implementation and dependencies are inspected and vendored.
- Duplicate animation libraries are avoided: the project standardises on `framer-motion`/`motion` plus CSS transitions; no GSAP or competing runtime was added.
- All third-party skill folders live in `.claude/skills/` and can be removed without affecting the application build.
