# Écho — French sound palace

A React vocabulary trainer ready for Netlify, backed by Supabase for accounts and sync. Includes 5,500 unique French entries with IPA, meanings, example sentences, source-estimated A1–C1 levels, reusable pronunciation mnemonics, a typed cloze game, an English recall game, an AI-marked sentence-writing game, swipe triage across the whole A1–C1 range, a personal word library, personal scene editing, spaced repetition that syncs across your devices, vocabulary search, a sound reference atlas, and JSON progress export/import.

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

- `echo_library` — one row per word you have met, including any generated mnemonic (`note` plus `note_ai`) and generated sentence (`sentence`, `sentence_en`). `known_at` is null while you are studying it and set once you mark it known, so marking a word known moves the row rather than deleting it. Personal scenes live here too, in `note`.
- `echo_reviews` — one row per scheduled word: due date, interval, total answers, and the clean / close / missed split that mastery is computed from.
- `echo_state` — one row per person: XP, rounds, best streak, the discover cursor, the level range, and the sound toggle.

Writes are debounced by about a second and sent as a row-level diff, so a round of play sends only the words it actually touched. The sidebar and the Progress tab show whether the last write landed; if it failed, the app says so rather than pretending your work is saved. If you already had progress in this browser from before accounts existed, it is uploaded once on first sign-in.

A day counts toward the streak once you have answered at least one card in it; the played days are stored and the current and longest streaks are derived from them, so the two cannot drift apart. Progress shows both plus the last thirteen weeks as a dot grid.

The schema lives in `supabase/migrations/`, applied in filename order. Note the second file: enabling row-level security and writing policies is not sufficient on its own, because RLS decides *which rows* a request may touch and says nothing about whether the role may touch the table at all. Without the matching `grant`, every call fails with `permission denied for table echo_library`.

The account menu sits in the header on every page — it shows the sync state, offers a retry if a write failed, and signs you out.

Auth is email and password, with a reset-by-email flow. Two notes on the Supabase side: if **Confirm email** is enabled on the project, a new account has to click the confirmation link before it can sign in — the sign-up screen says so. And **leaked password protection** is worth turning on in Auth settings; it is off by default.

## Play, sort, collect

The interface is dark throughout, driven by a small token palette at the top of `src/style.css` — background, surface, raise, line, text, muted, dim, and the green/gold/red accents. Colours are referenced through those variables rather than literals, so retuning the theme is a dozen edits rather than two hundred.

**Play** is a cloze round. A sentence appears with one word blanked and you type the missing word; the sentence fills in as you type. `Enter` checks, `Enter` again moves on, `Esc` leaves. Where the entry's lemma does not appear verbatim in its own example sentence (about 16% of the corpus, mostly conjugated verbs), the card asks you to spell the word from its English meaning instead, and the sentence is revealed after you answer.

Answers are compared case-insensitively and with surrounding whitespace ignored, but **accents count**: a spelling that is right apart from its diacritics scores half and is graded Hard rather than Good, with the correct spelling shown. An accent row sits under the input for keyboards that cannot reach `é è ê à â î ï ô û ù ç œ`. A round is a sentence with the blank as an inline input, the translation beneath it, mastery dots above, three tools bottom-left (reveal a letter, sound hint, mark known) and one action bottom-right. That action is **TEACH ME** while the box is empty, **CHECK** once you have typed, and **NEXT** once answered. Teach me puts the answer into the box as faded placeholder text and you type over it — it still counts as a miss, because being shown a word is not recalling it, and the miss is what brings the word back soon.

A round never advances on its own: every answer waits on NEXT, right or wrong, so a correct answer can be read before it disappears.

Answering reveals an audio row (normal and half speed) and **EXPLAIN**, which writes a line-by-line breakdown of the sentence and saves it to the word; it reappears on the word's page and in the round summary, labelled with the sentence it was written for. The round then ends on a summary: streak and collection cheers, points, time, clean/not-clean, teach-me count and accuracy, and every sentence you played — each expandable to its audio, mark-known, open-word and explain controls — with **KEEP PLAYING** pinned to the bottom.

Each card also shows the answer's letter count, its running mastery, an optional sound-cue hint, a **reveal-a-letter** button that uncovers one more letter each press, and a reveal-the-answer button that counts the card as missed. Uncovered letters are not free: they downgrade a correct answer from clean to close, so mastery only ever advances on a word you produced yourself. A clean answer scores 100 plus 25 per streak step, capped at eight steps.

Answering a card puts **every word of that sentence** into your library, not just the target. Sentence words are matched back to corpus entries with a rule-based inflection table — regular `-er`/`-ir`/`-re` endings, noun and adjective agreement, elisions such as `j'`/`l'`/`qu'`, and about fifty hand-written irregular verbs. Canonical entries always win over generated forms, so a real headword is never shadowed by another word's inflection. It is a heuristic, not a parser: rare forms are missed, and a look-alike form can attach to the wrong lemma.

Five decks feed a round:

- **Discover** is the progression. It walks the entire corpus **A1 → C1**, and inside a level in frequency order. The level range does not narrow it — that range is a filter for sorting and browsing, not a cap on what you learn.
- **My library** draws only from words you have collected, due ones first. This is where a curated list belongs.
- **Due reviews** draws whatever the schedule has brought back around, oldest first.
- **Meaning check** runs the other direction: it shows a word you are studying and asks for the English.
- **Write a sentence** asks you to use a word you are studying in a sentence of your own, and has the model mark it.

Discover also **weaves in anything due for review**, spread through the round rather than blocked at one end, taking at most half the cards so progression never stalls behind a review backlog. A consequence worth knowing: words already in your schedule come back regardless of level, so if higher-level words got into the schedule earlier they will keep appearing until they are learned, and the mix settles back to the ladder as they clear.

There is no stored resume point. The next new word is simply the first one on the ladder you have neither met nor retired, so answering a card or marking one known moves progression on by itself — nothing to drift out of step and nothing to migrate. Every deck skips words marked known. You can mark a word known mid-round with **I know this**, which drops it from the current deck and the library, or from the round summary.

**Sort** is one-gesture triage over the whole selected range. Swipe or drag right to add a word to your library, left to mark it known, down to skip labelling so it returns in a later session. Arrow keys do the same on a keyboard, `U` undoes the last card, and buttons do the same for anyone not using gestures.

## Mastery, and what the numbers mean

Every answer is filed as exactly one of three outcomes, in the game and on the Learn card alike:

| Outcome | What counts | Score | Schedules as |
|---|---|---|---|
| **Clean** | spelled exactly, unaided | full | Good |
| **Close** | an accent slip, or right with letters uncovered | half, streak survives | Hard |
| **Missed** | wrong, or you revealed the answer | none | Again |

**Mastery is the count of clean answers, out of ten.** Reach ten and the word retires itself into your known words, leaves your library, and stops appearing in rounds. Only clean answers move it: an accent slip or a letter hint still scores and still schedules the word, but the counter holds where it is, and the card says so. Mastery never falls — a bad answer costs you the schedule, not your progress.

Alongside mastery each word carries an SRS **stage** read off its interval: New, Learning (interval 0, just missed or just started), Familiar (1–6 days), Strong (7–20), Locked in (21+), and Known.

### The two modes that use your own words

**Meaning check** and **Write a sentence** both draw from your library, due words first, and both grade into the same schedule and the same mastery counter as a cloze round.

Meaning check shows the French and asks for the English. Corpus meanings pack their alternatives into one string — `to know (facts · how to do something)` — so any alternative counts, with or without the parenthetical and with or without a leading `to`/`the`/`a`. A single-character slip, transpositions included, scores as **close**: you keep the points and the schedule moves, but mastery holds, and the card says so. There is no letter-by-letter reveal here, because the answer is a phrase rather than a spelling; **teach me** shows the whole thing to copy out instead.

Write a sentence gives you one of your words and a **bonus word** — the next card in the round, so it is always something you are studying — and sends what you write to the model for marking. It comes back as a score out of five, one line naming what decided it, a line per problem, the smallest correction that makes the sentence right with its English, and up to two more idiomatic ways to say the same thing. Four or five is clean, three is close, below that is a miss, and a sentence that never uses the target word is a miss whatever the score. Whether the two words are actually present is decided locally first, off the same inflection index the cloze rounds use, and only upgraded by the model, which can see conjugations the index does not carry. Each sentence costs one generation call, so the round is capped at five regardless of the round-length setting. The marking is not stored — it lives in the round and its summary.

**Library** is the dedicated view of your own words: studying, known, or everything you have met, sortable by weakest first, due, recently added, or alphabetically, with search, an optional level filter, and per-word actions to mark known, restore to studying, or remove entirely. Removing a word also discards its review schedule.

Every row shows its mastery out of ten as pips and its stage as a chip; expanding one gives the full activity for that word — times seen, clean, close and missed with a proportional bar, clean rate, when it is next due, when you last saw it, its current interval, and its example sentence.

The level range is a set, not a single level — pick any combination from A1 to C1, or the whole span at once. It is shared across Play, Sort, Learn, and Vocabulary, and persists between visits.

## The mnemonic system

IPA, rather than spelling, determines each scene. Consonants are a fixed cast of characters, vowels and nasal vowels are distinct locations, and glides are objects that move the scene. Read them in sound order and have them act out the meaning. Recurring sequences such as /sjɔ̃/ and /mɑ̃/ are reusable compressed props. These are mnemonic chunks, not claims about etymology or morphological segmentation. Gender is a golden key (masculine) or silver ribbon (feminine) when the source article identifies it. Elided articles do not determine gender.

The apostrophe-like aspirated-h marker is excluded from sound tokens: it indicates blocked liaison/elision, not a pronounced consonant. IPA may include only one of several valid pronunciations. Consult pronunciation references for liaison, regional variation, and context-sensitive words such as *plus*.

Opening a word gives you its full page: mastery and stage, the outcome split, when it is next due and when you last saw it, the sound cast, the mnemonic, and a sentence.

The mnemonic is a staged scene, not a set of instructions to build one. Every character in the sound cast has actions it performs on whoever comes next, every vowel is a place the action can land in, and the closing sentence is the meaning — phrased by part of speech, so a noun is the thing left standing and a verb is what they are all doing. Eight variants come from two verb sets, two payoff phrasings, and two layouts; **Generate another** cycles them, **keep this one** freezes the current wording as your own, and **Write my own** replaces it (emptying the box falls back to generated text).

English grammar cannot always place a location between two linked clauses, so the arrow chain above the prose stays authoritative for strict sound order while the prose reads naturally.

**Write one with AI** replaces the template with a real one. It is never automatic: nothing calls the model on render, on navigation, or in the background — only that button and its counterpart in the sentence panel do, one word at a time. The result is saved to the word, labelled as generated, and read back from then on. A generated mnemonic gets the ordered sound cast, the meaning, the part of speech, and the gender line, and is required to use every cast member in order and land on the meaning; the server checks the returned scene actually names them all and asks for one rewrite if it does not. The same button in the sentence panel writes a fresh French example for the word, which then sits ahead of the corpus ones.

The key stays on the server. `netlify/functions/generate.js` reads `OPENAI_API_KEY` from the site environment (`OPENAI_KEY` also works), verifies the caller's Supabase access token before spending anything, and enforces a per-user daily cap in `echo_generation_usage` — so the endpoint is not an open proxy to the account's credit. `OPENAI_MODEL` overrides the model (default `gpt-4o-mini`) and `ECHO_DAILY_GENERATIONS` the cap. If the key is missing the app says exactly that rather than failing quietly.

**Another sentence** does not generate French. It borrows other corpus entries whose own example sentence happens to use this word, so every alternate is real, human-written French rather than something invented. That is a hard limit of the bundled data: about 39% of entries have at least one alternate, rising to 81% at A1, and the button says plainly when the corpus has nothing else. Browser French text-to-speech reads words and example sentences; voice quality and availability depend on the device. No pronunciation assessment is performed.

iOS silences web audio whenever the ringer switch is off — Web Audio and speech alike, with no error raised anywhere. Declaring `navigator.audioSession.type = 'playback'` covers Safari 16.4 and later, but on its own it did not hold, so the app also keeps a looping, near-silent `<audio>` element playing from the first interaction. That moves the page from the ambient audio session into playback, which the switch does not mute; the waveform has to be genuinely non-zero, since a muted or truly silent element stays ambient and changes nothing. The trade is that it can interrupt music or a podcast, so **Progress → Sound check** carries a per-device toggle for it alongside a beep test, a speech test, and a readout of the audio context state, the session type, and the voices available.

Safari needs more care than the other browsers on both audio paths. It reports an empty voice list until it has loaded voices, so the list is cached and refreshed on `voiceschanged` rather than read once. It can also be left in a paused speech state by a backgrounded tab, and cancelling when nothing is speaking can swallow the next utterance outright — so speech resumes if paused and only cancels when something is actually speaking. For the game's own blips, an `AudioContext` starts suspended and Safari only unlocks it once a buffer has genuinely played inside a user gesture, so the first pointer or key event anywhere in the app plays a silent one-frame buffer to unlock it.

Game answers feed the same schedule as the Learn tab: a correct answer counts as Good, a wrong one as Again. Review ratings schedule Again in one minute, Hard at 1.2× the previous interval (minimum one day), Good at 2.5× (minimum one day), and Easy at 3.5× (minimum four days). Intervals round to whole days. This is a simple interval scheduler, not FSRS. Progress lives on your account, so moving devices just means signing in. Export still produces an offline JSON backup worth keeping; import replaces your current progress and syncs the result up. Backups written before the library existed are still accepted: every word they had a review card for becomes a library word.

## Content provenance and limitations

- Vocabulary: [Language-Learning-decks](https://github.com/vbvss199/Language-Learning-decks), MIT, © 2025 GENERAL NEURO. AI-assisted translations, examples, and CEFR estimates may contain errors. This is not a teacher-reviewed or official CEFR syllabus.
- Pronunciations: [ipa-dict](https://github.com/open-dict-data/ipa-dict), MIT, © 2016 dohliam.
- Upstream frequency data attribution: wordfreq, Robyn Speer / Luminoso, CC BY-SA 4.0. See `data/attributions.md`. The derived vocabulary data is distributed under CC BY-SA 4.0 with upstream MIT notices retained; app code is separate from that data.
- Source data downloaded September 2026. `npm run data` rebuilds the bundled selection from the checked-in source files; no network is needed. Selection uses the first 5,500 frequency-ordered, unique, eligible entries with exact IPA matches. Counts: A1 463, A2 1,003, B1 2,158, B2 1,621, C1 255.
- Vocabulary knowledge alone does not constitute C1 proficiency. The dataset omits some function words and is not a complete language course.
- Fonts load from Google Fonts with local fallbacks. Audio uses the browser's speech service and may require internet. The vocabulary, mnemonics, and clozes are all generated in the browser from bundled data; Supabase stores only your account and your progress.

Tests validate corpus size, required fields, pronunciation token coverage, longest-match chunking, gender markers, review scheduling, inflected sentence-word matching, cloze construction and its corpus-wide coverage, accepted answers and letter counts, typed-answer checking and its accent tolerance, English answer matching against every alternative a corpus meaning packs in — including that all 5,500 entries yield at least one accepted answer — per-mode card construction, session queue filtering, and backup migration and rejection. Mastery has its own coverage: that each grade lands in exactly one outcome bucket, that ten clean answers retire a word while accent slips and misses do not, that a graded word joins the library unless already known, and that stages follow the interval. A separate suite covers the sync layer: the state-to-row mapping in both directions, and the diff that decides what gets written, including that an unchanged state writes nothing and that removing a word deletes from both tables. A production build is also checked. Browser interaction tests are not included.
