# Écho — French sound palace

A client-side React vocabulary trainer ready for Netlify. Includes 5,500 unique French entries with IPA, meanings, example sentences, source-estimated A1–C1 levels, reusable pronunciation mnemonics, personal scene editing, device-local spaced repetition, vocabulary search, a sound reference atlas, and JSON progress export/import.

## Run

Use Node 22 or newer:

```sh
npm ci
npm run dev
```

## Deploy to Netlify

Import this repository into Netlify. The included `netlify.toml` sets the build command to `npm run build` and the publish directory to `dist`. No environment variables, server, API keys, or database are needed.

Alternatively run `npm run build` and drag the **dist** folder into Netlify's manual deploy interface. Deploy the build output, not the source directory.

```sh
npm test
npm run build
```

## The mnemonic system

IPA, rather than spelling, determines each scene. Consonants are a fixed cast of characters, vowels and nasal vowels are distinct locations, and glides are objects that move the scene. Read them in sound order and have them act out the meaning. Recurring sequences such as /sjɔ̃/ and /mɑ̃/ are reusable compressed props. These are mnemonic chunks, not claims about etymology or morphological segmentation. Gender is a golden key (masculine) or silver ribbon (feminine) when the source article identifies it. Elided articles do not determine gender.

The apostrophe-like aspirated-h marker is excluded from sound tokens: it indicates blocked liaison/elision, not a pronounced consonant. IPA may include only one of several valid pronunciations. Consult pronunciation references for liaison, regional variation, and context-sensitive words such as *plus*.

Each entry starts with a generated scene-building prompt. Personalize it by opening **Make this scene yours**; the text saves on blur. These prompts are not 5,500 individually authored stories. Browser French text-to-speech reads words and example sentences; voice quality and availability depend on the device. No pronunciation assessment is performed.

Review ratings schedule Again in one minute, Hard at 1.2× the previous interval (minimum one day), Good at 2.5× (minimum one day), and Easy at 3.5× (minimum four days). Intervals round to whole days. This is a simple interval scheduler, not FSRS. Progress is local to the browser; exporting backups is essential for moving devices or clearing browser data. Import replaces current progress.

## Content provenance and limitations

- Vocabulary: [Language-Learning-decks](https://github.com/vbvss199/Language-Learning-decks), MIT, © 2025 GENERAL NEURO. AI-assisted translations, examples, and CEFR estimates may contain errors. This is not a teacher-reviewed or official CEFR syllabus.
- Pronunciations: [ipa-dict](https://github.com/open-dict-data/ipa-dict), MIT, © 2016 dohliam.
- Upstream frequency data attribution: wordfreq, Robyn Speer / Luminoso, CC BY-SA 4.0. See `data/attributions.md`. The derived vocabulary data is distributed under CC BY-SA 4.0 with upstream MIT notices retained; app code is separate from that data.
- Source data downloaded September 2026. `npm run data` rebuilds the bundled selection from the checked-in source files; no network is needed. Selection uses the first 5,500 frequency-ordered, unique, eligible entries with exact IPA matches. Counts: A1 463, A2 1,003, B1 2,158, B2 1,621, C1 255.
- Vocabulary knowledge alone does not constitute C1 proficiency. The dataset omits some function words and is not a complete language course.
- Fonts load from Google Fonts with local fallbacks. Audio uses the browser's speech service and may require internet. Learning data and progress need no backend.

Tests validate corpus size, required fields, pronunciation token coverage, longest-match chunking, gender markers, and review scheduling. A production build is also checked. Browser interaction tests are not included.
