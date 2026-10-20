# Kastit marketing site

The public website for Kastit (formerly Kanvas): one page that explains the product and collects
early-access requests. It is plain HTML, CSS and JavaScript with **no build step**.
Vercel serves the files as they are.

This repository holds only the marketing site. The Kastit app (frontend and backend)
lives in its own repository (still named `Kanvas`) and is not deployed from here.

## What's in it

| File | What it does |
|---|---|
| `index.html` | The whole page: hero, how it works, outputs, catalogue, FAQ, early-access form |
| `styles.css` | All styling (colours are CSS variables at the top) |
| `main.js` | Navigation, scroll animations, the self-typing brief, the form. **Contact email is set here.** |
| `ring.js` | The 3D ring in the hero, drawn with three.js (no model files) |
| `vendor/three-0.185.1/` | three.js, bundled locally (MIT licence included) |
| `404.html` | Shown by Vercel for any unknown URL |
| `vercel.json` | Clean URLs, caching for `vendor/`, basic security headers |
| `assets/` | Favicon, home-screen icon, social preview image (`og.png`) |

## Before going live

1. **Set the contact email.** In `main.js`, change `CONTACT_EMAIL` (top of the file).
   The early-access form opens the visitor's email app with their details filled in,
   addressed to this email.
2. **Point the social preview at your domain.** In `index.html`, change
   `<meta property="og:image" content="/assets/og.png">` to the full URL, for example
   `https://kastit.example/assets/og.png`. WhatsApp, LinkedIn and Facebook ignore
   relative paths.

## Preview locally

```bash
python3 serve.py
# open http://localhost:4173
```

`serve.py` behaves like Vercel: unknown URLs get the branded `404.html`. (Plain
`python3 -m http.server` shows Python's own error page instead.) Opening `index.html` straight from disk won't load the 3D
ring, because browsers block JavaScript modules on `file://`.

## Deploy on Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project**, import the repository.
3. Settings: Framework Preset **Other**, Build Command **empty**, Output Directory
   **empty** (the repository root). Leave Install Command empty too.
4. Deploy. Every push to `main` redeploys automatically.
5. **Settings → Domains**: add your domain and follow the DNS records Vercel shows.

## Collecting form submissions without email

The form currently composes an email, because a static site has no server. To store
submissions instead, sign up with a form service (Formspree, Tally, Basin and others
offer free tiers), then in `main.js` replace the `mailto:` part of the submit handler
with a `fetch()` POST to the service's endpoint.

## Keeping claims true

Every product fact on the page (8 ring styles, 7 stone cuts, 8 metals, 2 band profiles,
.3dm + .stl output, the checks run) comes from the engine's supported-features list
(`SupportedFeatures.md` in the app repository). When the engine gains or loses a capability, update the catalogue section and FAQ
to match.
