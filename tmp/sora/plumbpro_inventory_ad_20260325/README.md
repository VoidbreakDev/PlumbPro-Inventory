# PlumbPro Inventory Sora Ad Batch

This directory contains a six-shot Sora batch for the investor/influencer-style PlumbPro Inventory ad.

## Notes

- Model: `sora-2-pro`
- Size: `1920x1080`
- Total runtime target: `36s` across six stitched shots
- Guardrails: no real people, no copyrighted music, no third-party logos

## Required

Load `OPENAI_API_KEY` into the shell before running live commands.

Example:

```bash
export OPENAI_API_KEY=...
export UV_CACHE_DIR=/tmp/uv-cache
export SORA_CLI=/Users/ryan_sinclair/.codex/skills/sora/scripts/sora.py
```

## 1. Submit the batch

```bash
mkdir -p tmp/sora/plumbpro_inventory_ad_20260325/jobs
uv run --with openai python3 "$SORA_CLI" create-batch \
  --input tmp/sora/plumbpro_inventory_ad_20260325/prompts.jsonl \
  --out-dir tmp/sora/plumbpro_inventory_ad_20260325/jobs \
  --concurrency 2
```

## 2. Poll and download each completed shot

Run from `PlumbPro-Inventory/`:

```bash
mkdir -p tmp/sora/plumbpro_inventory_ad_20260325/renders
for file in tmp/sora/plumbpro_inventory_ad_20260325/jobs/*.json; do
  id="$(jq -r '.id // .video.id // .data[0].id // empty' "$file")"
  base="$(basename "$file" .json)"
  uv run --with openai python3 "$SORA_CLI" poll \
    --id "$id" \
    --download \
    --out "tmp/sora/plumbpro_inventory_ad_20260325/renders/${base}.mp4"
done
```

## 3. Stitch the shots

Create the concat file:

```bash
cat > tmp/sora/plumbpro_inventory_ad_20260325/concat.txt <<'EOF'
file 'renders/01-opener.mp4'
file 'renders/02-hero.mp4'
file 'renders/03-workflow-scope.mp4'
file 'renders/04-ai.mp4'
file 'renders/05-mobile.mp4'
file 'renders/06-cta.mp4'
EOF
```

Then stitch:

```bash
ffmpeg -y \
  -f concat \
  -safe 0 \
  -i tmp/sora/plumbpro_inventory_ad_20260325/concat.txt \
  -c copy \
  tmp/sora/plumbpro_inventory_ad_20260325/plumbpro_inventory_ad.mp4
```
