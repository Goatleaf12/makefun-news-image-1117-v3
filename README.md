# The Tuesday Paper — 17 November 2026 (v3)

[![make.fun](https://make.fun/badge/news-image-20261117.svg)](https://make.fun/bounty/news-image-20261117)
[![rank](https://make.fun/badge/news-image-20261117/Goatleaf12/makefun-news-image-1117-v3/rank.svg)](https://make.fun/bounty/news-image-20261117)
[![reward](https://make.fun/badge/news-image-20261117/Goatleaf12/makefun-news-image-1117-v3/reward.svg)](https://make.fun/bounty/news-image-20261117)

A one-page newspaper front page summing up the world news of
**Tuesday 17 November 2026** in a single image — an entry for the
[make.fun bounty news-image-20261117](https://make.fun/bounty/news-image-20261117).

## What it shows

- **Lead story:** the Kerch Bridge road span collapses after a Ukrainian
  strike, with a drawn illustration of the fallen span (deck down in the
  strait, rail arch hit, road closed).
- **6 more featured stories** across Asia, the Middle East, the USA and
  Europe, each with a numbered badge, region tag, headline and summary.
- **A numbered world map** (pins 1–7 match the featured stories, placed by
  true longitude/latitude) and a **BY THE NUMBERS** box.
- **ALSO ON TUESDAY — 20 MORE STORIES**: three columns of one-line stories.
- **Footer:** every story happened or was first reported on 17 November
  2026; disputed claims are attributed; sources AP · Reuters · AFP · BBC ·
  Al Jazeera.

27 stories, 6 continents, one day.

## What v3 fixes

v1 (dev 0.977797) and v2 (dev 0.972121) both lost points to garbled text:
their 5×7 pixel font had 1px-thin strokes and cramped letters, so at the
~300px size the judge sees, words came out mangled. v3 rebuilds the text
rendering from scratch — a new 6×9 bitmap font with 2-cell-thick strokes,
generous tracking, larger type, and fewer words per panel — and every text
block was checked by rendering it, downscaling to 300px, and reading each
word back. The map pins were also re-verified one by one against real
geography (v2 put the Vulcan pin in South America and the Rwanda pin in
southern Africa); v3 places every pin from true lon/lat.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png — 1024x1024 PNG, byte-identical on every run
```

`main.ts` draws the page pixel by pixel (its own 6×9 bitmap font, its own
PNG encoder on top of `node:zlib`). No network, no clock, no randomness.
