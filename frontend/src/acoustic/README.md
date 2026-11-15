# Experimental Live Acoustic Check — isolated handoff

Status: **Implemented, not mounted in the application; human review required.**
Branch: `feature/live-acoustic-check`, based on approved main `3a6cc7d`.
All changes are new files in `frontend/src/acoustic/`. No shared layout, panels,
locale dictionaries, global styles, API contract, backend or dependency files change.
This directory was implemented in a separate Git worktree while Claude owns the redesign.

## Mount after the redesign

From a component in `frontend/src/`:

```tsx
import { LiveAcousticCheck } from './acoustic';

// Prefer conditional mounting: leaving the view unmounts and releases capture.
{isAcousticVisible && <LiveAcousticCheck />}
```

`isAcousticVisible` above is a placeholder for Claude's own view-selection state;
this module does not add a tab or assume a particular router. If a hidden panel
stays mounted, pass `active={isAcousticVisible}` instead. CSS `display:none` alone
does not notify React that a capture should stop. Do not mount two instances at once.
Never start capture automatically, and retain the consent checkbox and Start action.

For localization, use the parent's selected language and translated messages:

```tsx
import { LiveAcousticCheck, type AcousticMessages } from './acoustic';

// Supply every key from messages.ts using Claude's own localization system.
// A complete AcousticMessages object gives a compile-time checklist.
const ruAcousticMessages: AcousticMessages = /* translated messages */;

<LiveAcousticCheck
  active={isAcousticVisible}
  locale="ru-RU"
  messages={ruAcousticMessages}
/>
```

`messages` accepts partial overrides and falls back to English. Prefer a complete
object for the Russian presentation so scientific/privacy notices are also translated.
`locale` controls number formatting only; use a valid BCP 47 locale. The component
imports its own `.orbita-acoustic`-scoped CSS. No export callback is provided: do not
feed these readings into Evidence Navigator, CognitiveGuard, or AI Companion APIs.

## Complete string inventory

[`messages.ts`](./messages.ts) is the authoritative list of **every user-facing
string and its English default**, including errors, accessibility labels, units,
privacy/scientific notices, controls and comparison text. Its keys are:

```text
title notice privacy limits processing consent start stop clear
idle requesting measuring done stopped unsupported denied missingDevice unavailable
results previous latest rms dbfs silence rate secondsUnit dbfsUnit differenceUnit
echo noise gain on off unknown compare compareNote different silentComparison waitingComparison
```

The isolated preview HTML's document title repeats `title`; it is a developer-only
preview, not a shared app title. All other rendered text comes from this inventory
or localized numerical results, with punctuation and the fixed duration of 10.
Preserve the meaning of the required notice:

> Real local microphone measurement — uncalibrated. Not ISS telemetry, not a medical or occupational noise assessment.

## Calculation and limitations

- Consent and Start precede `getUserMedia`; the browser may additionally prompt.
  The default microphone is requested first. Subsequent attempts request its exact
  reported device ID where supported. No enumeration or device fingerprinting.
- An AudioWorklet processes consecutive mono audio blocks. The graph requests mono
  input and explicitly downmixes to one channel. It aggregates exactly
  `AudioContext.sampleRate * 10` sample frames; setup/permission time is excluded.
  UI progress is sample-based, not an animation-frame/window approximation.
- RMS = `sqrt(sum(sample²) / frameCount)`. Displayed dBFS = `20 * log10(RMS)`,
  using digital amplitude 1.0 as the reference (a peak-1 sine is about −3.01 dBFS
  under this convention). No A weighting, calibration, dBA, SPL conversion or
  comparison against exposure limits. No stress/health inference or medical rules.
- All-zero samples are valid digital silence: RMS 0, dBFS shown as −infinity.
  Internally `null` represents that logarithmic result; missing input blocks or an
  interrupted graph produce an error, not invented zero measurements.
- Echo cancellation, noise suppression and automatic gain control are requested
  false when the browser advertises those constraints. The displayed settings are
  what the track reports, not proof that OS/hardware gain or processing is disabled.
- Compare only the last two completed readings with the same nonempty device ID
  and reported capture signature (context/track sample rate, channel count and the
  three processing settings). Unknown device identity or changed settings disables
  comparison. Unknown processing is displayed explicitly. Input gain/position must
  be held constant manually; unreported changes cannot be detected or corrected.
- Difference = latest dBFS minus previous dBFS. No finite difference is shown if
  either sample is digital silence. No causal improvement or environmental claim.

## Privacy and cleanup

No MediaRecorder, waveform history, storage, API call, upload or microphone playback.
Audio blocks are consumed transiently by the worklet; only aggregate counts/energy
leave it. Its output is silence. The last two results and opaque device identifiers
exist in component memory only; Clear or unmount discards them.

Stop, completion, setup/processor/device failure, tab hiding, page exit, inactive
panel and unmount stop microphone tracks, disconnect nodes, close the message port
and request AudioContext closure. No partial results are saved. A 30-second setup
watchdog includes unanswered permission prompts, and a 15-second graph watchdog
bounds absent/stalled input. An OS/browser permission dialog cannot be dismissed by
the component; a stream granted after Stop/timeout/unmount is immediately stopped.

## Verification and manual acceptance

- `npm run typecheck`: passed.
- `npm test`: **254 passed**, including **24 acoustic tests**. They cover arithmetic,
  silence, exact worklet frame count/final-block handling, consent, permission denial,
  missing/unreadable devices, success, cleanup, late permission after Stop/unmount,
  setup failure, stalled graph, interrupted input, tab hiding, inactive panel,
  comparison, localization override and unsupported-browser fallback.
- `npm run build`: passed; existing large-chunk warning remains. Since the feature
  is intentionally unmounted, the standard app does not include it yet. A separate
  Vite production build of `src/acoustic/preview.html` also passed and emitted a
  hashed standalone worklet JS asset; no shared Vite configuration was changed.
- Actual Chrome browser checks (automated through DevTools, **synthetic test input**):
  a generated 1 kHz, peak-0.25 waveform supplied through Chrome's fake microphone
  traversed the actual getUserMedia/Web Audio/worklet path. Two 10-second captures,
  comparison and Stop passed on the development and production preview. Production
  results were about RMS **0.176468**, **−15.07 dBFS**, difference **0 dB**. The small
  departure from ideal full-window RMS reflects the browser capture startup path.
  Browser-reported tracks were ended and contexts closed after each operation.
  A separate browser with denied permission showed the correct error and closed
  the context. Removing worklet support showed the disabled fallback without
  microphone acquisition. No module API requests/uploads or JavaScript exceptions
  were seen. A rendered screenshot was visually inspected for notices/controls/results.
- **Manual physical-laptop-microphone verification has not been performed.** The
  browser checks use a synthetic source, not real environmental measurements; they
  do not establish physical microphone accuracy or cross-browser reliability.
  Permission-dialog behavior and hardware/OS processing still need a human check.

Before including this optional feature in the presentation, a human should:

1. Run `npm run dev` in `frontend/` on the feature branch and open
   `http://localhost:5173/src/acoustic/preview.html` (or the selected dev port).
2. Confirm no microphone indicator before consent + Start; allow the browser prompt.
3. Complete a quiet-room measurement and another with a changed sound, using the
   same microphone/gain/position. Confirm relative results only, never dBA/health claims.
4. Verify Stop, completion and leaving the view release the microphone indicator;
   test denying permission and disconnecting the microphone if practical.
5. Review the English/Russian notices after Claude mounts the component, including
   `active={false}` when retaining hidden panels. If verification fails, leave it
   unmounted and preserve the existing demo. No merge is performed by this work.

Implementation references: [Web Audio processor blocks](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process),
[microphone permission and failures](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia),
and [Vite worklet asset URLs](https://vite.dev/guide/assets).

## Files

`LiveAcousticCheck.tsx` — isolated consent/UI/lifecycle and last-two-results state.
`capture.ts` — microphone acquisition, settings, worklet wiring, failure/cleanup.
`rms.worklet.js` — continuous sample aggregation without recording or playback.
`levels.ts` — pure RMS/dBFS and same-device comparison.
`messages.ts` — full localization inventory; `acoustic.css` — scoped styles.
`index.ts` — public component/types; `assets.d.ts` — local worklet URL import typing.
`acoustic.test.tsx` — focused tests; `preview.html`/`preview.tsx` — isolated manual page.
`README.md` — this handoff and verification record.
