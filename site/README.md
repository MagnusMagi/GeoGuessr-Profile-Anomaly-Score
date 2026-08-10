# Landing page

Source for **[anomaly.magnusmagi.com](https://anomaly.magnusmagi.com)** — an interactive introduction to the userscript. Try the real detection formulas (stabilization, risk curve, smurf boost) against your own numbers, browse the measured division-cap table, and see the actual panel captured live on a real profile.

## What's here

- `index.html` — the entire site, self-contained (fonts and screenshots inlined as data URIs, no build step, no external requests).
- `favicon.png` (32×32) / `apple-icon.png` (180×180) — the site's icon: a bar chart with one bar spiking past a dashed threshold line, in the same dark/lime visual language as [magnusgeo.magnusmagi.com](https://magnusgeo.magnusmagi.com).

## Deploying

Deployed on Vercel, aliased to `anomaly.magnusmagi.com`. To ship an update:

```bash
cp site/index.html /path/to/your/vercel-linked/dir/index.html
cd /path/to/your/vercel-linked/dir
vercel deploy --prod --yes
```

This folder is a snapshot for version control — it isn't wired to Vercel's git integration, so pushing here does not auto-deploy.
