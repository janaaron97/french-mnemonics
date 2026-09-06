# Écho — French sound palace

A React vocabulary trainer ready for Netlify, backed by Supabase for accounts and sync. Includes 5,500 unique French entries with IPA, meanings, example sentences, source-estimated A1–C1 levels, reusable pronunciation mnemonics, a typed cloze game, swipe triage across the whole A1–C1 range, a personal word library, personal scene editing, spaced repetition that syncs across your devices, vocabulary search, a sound reference atlas, and JSON progress export/import.

## Run

Use Node 22 or newer:

```sh
npm ci
npm run dev
```

## Deploy to Netlify

Import this repository into Netlify. The included `netlify.toml` sets the build command to `npm run build` and the publish directory to `dist`.

No environment variables are required: the Supabase project URL and its **publishable** key are committed in `src/cloud.js`, which is how Supabase intends browser clients to ship — that key grants nothing on its own, and row-level security is what actually protects the data. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` at build time to point a deploy at a different project.

Alternatively run `npm run build` and drag the **dist** folder into Netlify's manual deploy interface. Deploy the build output, not the source directory.

```sh
npm test
npm run build
```

## Accounts and sync

Signing in is required. Every word, review interval, personal scene, and counter lives on your account and follows you to any device you sign in on, so the app is no longer tied to one browser's storage.

Three tables hold it, each keyed by the bundled corpus id and each protected by row-level security that restricts every read and write to `auth.uid() = user_id`:

- `echo_library` — one row per word you have met. `known_at` is null while you are studying it and set once you mark it known, so marking a word known moves the row rather than deleting it. Personal scenes live here too, in `note`.
- `echo_reviews` — one row per scheduled word: due date, interval, and review count.
- `echo_state` — one row per person: XP, rounds, best streak, the discover cursor, the level range, and the sound toggle.

Writes are debounced by about a second and sent as a row-level diff, so a round of play sends only the words it actually touched. The sidebar and the Progress tab show whether the last write landed; if it failed, the app says so rather than pretending your work is saved. If you already had progress in this browser from before accounts existed, it is uploaded once on first sign-in.

Auth is email and password, with a reset-by-email flow. Two notes on the Supabase side: if **Confirm email** is enabled on the project, a new account has to click the confirmation link before it can sign in — the sign-up screen says so. And **leaked password protection** is worth turning on in Auth settings; it is off by default.

## Play, sort, collect

**Play** is a cloze round. A sentence appears with one word blanked and you type the missing word; the sentence fills in as you type. `Enter` checks, `Enter` again moves on, `Esc` leaves. Where the entry's lemma does not appear verbatim in its own example sentence (about 16% of the corpus, mostly conjugated verbs), the card asks you to spell the word from its English meaning instead, and the sentence is revealed after you answer.

Answers are compared case-insensitively and with surrounding whitespace ignored, but **accents count**: a spelling that is right apart from its diacritics scores half and is graded Hard rather than Good, with the correct spelling shown. An accent row sits under the input for keyboards that cannot reach `é è ê à â î ï ô û ù ç œ`. Each card also shows the answer's letter count, an optional sound-cue hint, and a reveal button that counts the card as missed. A clean answer scores 100 plus 25 per streak step, capped at eight steps.

Answering a card puts **every word of that sentence** into your library, not just the target. Sentence words are matched back to corpus entries with a rule-based inflection table — regular `-er`/`-ir`/`-re` endings, noun and adjective agreement, elisions such as `j'`/`l'`/`qu'`, and about fifty hand-written irregular verbs. Canonical entries always win over generated forms, so a real headword is never shadowed by another word's inflection. It is a heuristic, not a parser: rare forms are missed, and a look-alike form can attach to the wrong lemma.

Three decks feed a round:

- **Discover** walks the corpus in frequency order across the selected levels, resuming from where the last round left off. This is the way to progress through the language without first curating a library.
- **My library** draws only from words you have collected, due ones first.
- **Due reviews** draws whatever the spaced-repetition schedule has brought back around.

Every deck skips words marked known. You can mark a word known mid-round with **I know this**, which drops it from the current deck and the library, or from the round summary.

**Sort** is one-gesture triage over the whole selected range. Swipe or drag right to add a word to your library, left to mark it known, down to skip labelling so it returns in a later session. Arrow keys do the same on a keyboard, `U` undoes the last card, and buttons do the same for anyone not using gestures.

**Library** is the dedicated view of your own words: studying, known, or everything you have met, with search, an optional level filter, and per-word actions to mark known, restore to studying, or remove entirely. Removing a word also discards its review schedule.

The level range is a set, not a single level — pick any combination from A1 to C1, or the whole span at once. It is shared across Play, Sort, Learn, and Vocabulary, and persists between visits.

## The mnemonic system

IPA, rather than spelling, determines each scene. Consonants are a fixed cast of characters, vowels and nasal vowels are distinct locations, and glides are objects that move the scene. Read them in sound order and have them act out the meaning. Recurring sequences such as /sjɔ̃/ and /mɑ̃/ are reusable compressed props. These are mnemonic chunks, not claims about etymology or morphological segmentation. Gender is a golden key (masculine) or silver ribbon (feminine) when the source article identifies it. Elided articles do not determine gender.

The apostrophe-like aspirated-h marker is excluded from sound tokens: it indicates blocked liaison/elision, not a pronounced consonant. IPA may include only one of several valid pronunciations. Consult pronunciation references for liaison, regional variation, and context-sensitive words such as *plus*.

Each entry starts with a generated scene-building prompt. Personalize it by opening **Make this scene yours**; the text saves on blur. These prompts are not 5,500 individually authored stories. Browser French text-to-speech reads words and example sentences; voice quality and availability depend on the device. No pronunciation assessment is performed.

Game answers feed the same schedule as the Learn tab: a correct answer counts as Good, a wrong one as Again. Review ratings schedule Again in one minute, Hard at 1.2× the previous interval (minimum one day), Good at 2.5× (minimum one day), and Easy at 3.5× (minimum four days). Intervals round to whole days. This is a simple interval scheduler, not FSRS. Progress lives on your account, so moving devices just means signing in. Export still produces an offline JSON backup worth keeping; import replaces your current progress and syncs the result up. Backups written before the library existed are still accepted: every word they had a review card for becomes a library word.

## Content provenance and limitations

- Vocabulary: [Language-Learning-decks](https://github.com/vbvss199/Language-Learning-decks), MIT, © 2025 GENERAL NEURO. AI-assisted translations, examples, and CEFR estimates may contain errors. This is not a teacher-reviewed or official CEFR syllabus.
- Pronunciations: [ipa-dict](https://github.com/open-dict-data/ipa-dict), MIT, © 2016 dohliam.
- Upstream frequency data attribution: wordfreq, Robyn Speer / Luminoso, CC BY-SA 4.0. See `data/attributions.md`. The derived vocabulary data is distributed under CC BY-SA 4.0 with upstream MIT notices retained; app code is separate from that data.
- Source data downloaded September 2026. `npm run data` rebuilds the bundled selection from the checked-in source files; no network is needed. Selection uses the first 5,500 frequency-ordered, unique, eligible entries with exact IPA matches. Counts: A1 463, A2 1,003, B1 2,158, B2 1,621, C1 255.
- Vocabulary knowledge alone does not constitute C1 proficiency. The dataset omits some function words and is not a complete language course.
- Fonts load from Google Fonts with local fallbacks. Audio uses the browser's speech service and may require internet. The vocabulary, mnemonics, and clozes are all generated in the browser from bundled data; Supabase stores only your account and your progress.

Tests validate corpus size, required fields, pronunciation token coverage, longest-match chunking, gender markers, review scheduling, inflected sentence-word matching, cloze construction and its corpus-wide coverage, accepted answers and letter counts, typed-answer checking and its accent tolerance, session queue filtering, and backup migration and rejection. A separate suite covers the sync layer: the state-to-row mapping in both directions, and the diff that decides what gets written, including that an unchanged state writes nothing and that removing a word deletes from both tables. A production build is also checked. Browser interaction tests are not included.
