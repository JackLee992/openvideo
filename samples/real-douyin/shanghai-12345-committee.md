# Sample: Shanghai 12345 Committee Election Dispute

## Source

- Short link: `https://v.douyin.com/HNHOupn_zYI/`
- Resolved page observed during the run: `https://www.douyin.com/video/7655269765358832923`
- Analysis date: 2026-06-26
- Category: `auto`

This report summarizes a real OpenVideo run. It analyzes the video's structure and style; it does not independently fact-check the underlying public-affairs claim.

## Reproduction Command

```bash
OPENVIDEO_AUTH=1 \
OPENVIDEO_SAMPLE_MIN_DURATION_SEC=90 \
OPENVIDEO_TRANSCRIBE_MODEL=small \
OPENVIDEO_TRANSCRIBE_LANGUAGE=zh \
OPENVIDEO_TRANSCRIBE_TIMEOUT_MS=600000 \
scripts/samples/analyze-real-douyin.sh \
  "https://v.douyin.com/HNHOupn_zYI/" \
  shanghai-12345-committee \
  auto
```

## Verified Media And Pipeline

- Captured media: full video, not preview.
- Duration: 121.49 seconds.
- Shape: vertical `9:16`, 1080 x 1920.
- Frame rate: 30 fps.
- Streams: H.264 video plus AAC audio.
- Scene detection: 14 scenes.
- Motion: subtle, low-intensity movement.
- OCR: available with `chi_sim+eng`, but Chinese caption recognition is noisy.
- ASR: HyperFrames `small`, language `zh`.
- ASR limitation: transcript is readable but returned as one long cue, with some homophone mistakes and missing punctuation.

## One-Sentence Read

This is a social-affairs commentary video built around a simple conflict: a person reportedly received the most votes in a residential committee election, but was blocked because they had used the public `12345` hotline.

## Content Structure

The opening goes straight to a counterintuitive result: the person with the strongest vote result does not become the winner. The video then reveals the reason, using the hotline detail as the main emotional trigger.

The middle section expands the case from a local dispute into a common-sense argument. It frames `12345` as a public service channel, so treating hotline use as a negative record feels contradictory to the audience.

The later section moves from common sense to governance boundaries. It argues that candidate eligibility should come from written rules and legal conditions, not from an extra local filter created around complaint history.

The ending turns the individual case into a public-value statement: public feedback channels should not become labels used to punish participation.

## Narrative Beats

- `0-20s`: hook, contradiction, and key reason.
- `20-45s`: absurdity is amplified through commentary language.
- `45-70s`: common-sense rebuttal around the purpose of the hotline.
- `70-100s`: rules and authority boundary argument.
- `100-121s`: value conclusion and call for proper handling.

## Visual And Editing Notes

The video mainly uses a host-facing commentary setup. The speaker is centered in a bright indoor environment, with office-like background details that support a news-commentary tone.

Evidence and context are inserted through residential-area footage, notices, tables, and phone-like graphic layouts. These inserts break the monotony of a two-minute talk while keeping the viewer anchored to the reported case.

The pacing is not extremely fast. It uses longer holds on the host, then inserts proof-like visuals at moments where the argument changes from claim to explanation.

## Caption System

Captions are part of the video's information architecture:

- top text keeps the core conflict visible;
- lower captions track the spoken explanation;
- highlighted phrases emphasize the hotline, eligibility, and rights-related points.

The result is a video that remains understandable even when watched with low volume.

## Why It Is Shareable

- The conflict is immediately legible.
- The public-service hotline is familiar to ordinary viewers.
- The story creates a strong fairness reaction.
- The video turns a local case into a broader question about whether feedback and participation can be penalized.

## Reusable Creative Pattern

1. Start with an unexpected outcome.
2. Reveal the small rule or reason that caused it.
3. Explain why the reason conflicts with common sense.
4. Add rule or institutional context.
5. End with a broader public-value statement.

## OpenVideo Evaluation

This sample proves that the local pipeline can capture a real Douyin video, extract frames, detect scenes, read audio, run HyperFrames ASR, and produce reusable style artifacts. The main remaining quality gap is Chinese transcript segmentation: ASR text is good enough for analysis, but not yet good enough for precise timestamp-level editing without a post-processing step.
