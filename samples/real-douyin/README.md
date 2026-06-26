# Real Douyin Samples

These samples document real end-to-end runs:

1. QR-code login through `openvideo auth douyin`.
2. Browser-backed Douyin download with cookies and Playwright storage state.
3. Duration validation to reject short preview media.
4. Full OpenVideo analysis with HyperFrames ASR.

The repository stores only source links, commands, metrics, and human-readable analysis. Raw videos, cookies, Playwright storage, and signed media URLs stay under `.openvideo/` and are intentionally not committed.

## Reproduce On A New Machine

```bash
npm install
npm run doctor
```

For the first run on a machine, let the script open Douyin login and scan the QR code:

```bash
OPENVIDEO_AUTH=1 \
OPENVIDEO_SAMPLE_MIN_DURATION_SEC=90 \
scripts/samples/analyze-real-douyin.sh \
  "https://v.douyin.com/HNHOupn_zYI/" \
  shanghai-12345-committee \
  auto
```

For the longer MSE/blob-backed sample:

```bash
OPENVIDEO_SAMPLE_MIN_DURATION_SEC=300 \
scripts/samples/analyze-real-douyin.sh \
  "https://v.douyin.com/qiNlGUJBFB8/" \
  longge-japan-visa-fee \
  knowledge
```

The script reuses `.openvideo/samples/<slug>/douyin-cookies.txt` and `.openvideo/samples/<slug>/douyin-storage.json` when present. Set `OPENVIDEO_AUTH=1` to refresh the login state. During auth, it opens the target video URL so the saved browser storage matches the page that will be downloaded.

Recommended ASR defaults:

```bash
export OPENVIDEO_TRANSCRIBE_MODEL=small
export OPENVIDEO_TRANSCRIBE_LANGUAGE=zh
export OPENVIDEO_TRANSCRIBE_TIMEOUT_MS=600000
```

## Sample Reports

- [Shanghai 12345 committee election dispute](./shanghai-12345-committee.md)
- [Longge Japan visa-fee commentary](./longge-japan-visa-fee.md)

## Known Behavior

- Douyin may serve a very short preview if login state or browser-generated page state is incomplete. The sample script fails fast when the captured duration is below `OPENVIDEO_SAMPLE_MIN_DURATION_SEC`.
- Some Douyin pages play through MSE/blob URLs. The browser downloader observes `media-video-*` and `media-audio-*` resources and muxes them with ffmpeg when the page exposes blob playback.
- HyperFrames ASR currently produces readable Chinese text, but Mandarin speech may arrive as one long cue with imperfect punctuation and some homophone errors. The reports below use ASR as evidence, then manually structure the analysis.
