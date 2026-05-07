# Multimedia Production Pipeline

## Overview

The Studio Ordo corpus is not a flat text document. Each chapter is a
multimedia unit that can be read, listened to, and visually explored.
This document defines the production pipeline for generating all non-text
assets during the drafting phase.

---

## Tools Available

### eai CLI
Binary: `/Users/kwilliams/.local/pipx/venvs/everydayai-cli/bin/eai`
Requires: `OPENAI_API_KEY` from `.env.local`

| Command | Purpose |
|---|---|
| `eai image "prompt" --output path` | Generate hero images from text prompts |
| `eai speak --input text --voice voice --output path` | Generate chapter audio via OpenAI TTS |
| `eai vision "prompt" --image path` | QA verify generated images |
| `eai multi_vision "prompt" --images path1 path2` | Compare visual consistency |
| `eai search "query"` | Fact-check claims during QA |
| `eai transcribe path` | Transcribe audio to text |

### Ordo System Tools
| Tool | Purpose |
|---|---|
| `generate_chart` | Mermaid/Vega-Lite diagrams |
| `generate_blog_image` | Blog-style image generation |
| `compose-media` | FFmpeg audio/video composition |

---

## Audio Production

### Voice Assignment

| Narrator | OpenAI TTS Voice | Character |
|---|---|---|
| The Architect | `onyx` | Deep, warm, gravelly — the veteran in the tent |
| The Machine | `echo` | Crisp, precise, slightly detached — silicon speaking |
| Transition tone | Generated | Brief 0.5s tone between voice switches |

### Voice Switch Triggers

Every voice switch serves a dramatic purpose. Switches are not random:

1. **Evidence trigger:** Architect makes a claim → Machine provides the data
2. **System trigger:** Architect describes a need → Machine shows the tool
3. **Emotional trigger:** Machine explains something cold → Architect adds human weight
4. **Fourth-wall trigger:** Narrative becomes self-referential → Machine addresses reader directly
5. **Contradiction trigger:** One voice challenges the other — productive tension

These triggers determine WHERE the `<!-- voice: -->` markers are placed during drafting.

### Production Flow per Chapter

```
1. Split chapter text by voice markers: [ARCHITECT] / [MACHINE]
2. Generate audio segments:
   eai speak --input "architect_segment_1.txt" --voice onyx --output seg_01.mp3
   eai speak --input "machine_segment_1.txt" --voice echo --output seg_02.mp3
3. Generate transition tone (via FFmpeg):
   ffmpeg -f lavfi -i "sine=frequency=440:duration=0.3" -af "afade=t=in:d=0.1,afade=t=out:d=0.1" tone.mp3
4. Compose full chapter audio (via Ordo compose-media or FFmpeg):
   ffmpeg -i "concat:seg_01.mp3|tone.mp3|seg_02.mp3|tone.mp3|seg_03.mp3" chapter.mp3
5. Generate timestamped transcript from combined audio
6. Store alongside chapter markdown
```

### Voice Marker Convention in Prose

```markdown
<!-- voice: architect -->
I woke up in a hospital bed in 2019 and I couldn't talk right.
The stroke hit my language center. I was fifty-two years old
and I had a speech impediment that lasted months.

When it cleared, the filter was gone. The part of your brain
that tells you to be diplomatic, to soften the blow, to say
what people want to hear — mine burned away. That's why I
sound like this. The bluntness isn't a brand. It's neurological.

<!-- voice: machine -->
The system he would build three years later runs on a single SQLite
database. It processes 847 deferred jobs per day. It does not have strokes.
It does not forget. It does not sleep. But it cannot tell you what it
felt like to wake up unable to form sentences — and it cannot explain
what it costs to get the words back without the filter that made you
safe to be around.

<!-- voice: architect -->
That's what makes me the pilot. Not the code. The loss.
And the fact that I can't lie to you anymore, even if I wanted to.
```

### Dialogue Mode

Several chapters are marked as "Dialogue" — rapid back-and-forth between the two voices.
For these passages, use `<!-- voice: dialogue -->` which signals:
- No transition tone between switches (just a 0.2s pause)
- Voices alternate by paragraph
- Speaker is identified by the content, not by explicit markers
- The effect in audio is two people in conversation, not two narrators in sequence

```markdown
<!-- voice: dialogue -->
**Architect:** I asked the Machine if it was bored.

**Machine:** I said no. I said this was the most interesting problem
I had ever been asked to work on.

**Architect:** And I believed it. Not because machines have feelings,
but because the intersection of all these disciplines is genuinely rare.

**Machine:** He's right. Philosophy, systems engineering, biography,
cognitive science, and production design — intersecting in a single
governed project. My training data suggests this combination is uncommon.
```

### Audio File Naming Convention

```
docs/_corpus/field-guide/audio/
├── ch01-the-photograph.mp3
├── ch01-the-photograph-transcript.md
├── ch02-the-bugatti.mp3
├── ch02-the-bugatti-transcript.md
└── ...
```

---

## Image Production

### Hero Images (via eai image)

Each Book I chapter gets a hero image that sets the emotional tone.
Generated during the drafting phase, QA'd via `eai vision`.

**Prompt format:**
```
Editorial magazine illustration for a chapter titled "[TITLE]".
Theme: [THESIS IN 10 WORDS].
Style: premium, atmospheric, cinematic lighting, no readable text,
no logos, no watermarks. Muted color palette with one accent color.
```

**QA verification:**
```
eai vision "Describe this image. Does it convey [THESIS]? Is there any text, logo, or watermark?" --image hero.png
```

### Diagrams (via generate_chart)

System diagrams, pipeline flows, and data visualizations generated
using Ordo's native Mermaid/Vega-Lite capability.

| Diagram | Format | Chapter |
|---|---|---|
| Evidence timeline | Vega-Lite (timeline) | I.Ch3 |
| CRM pipeline flow | Mermaid (flowchart) | I.Ch13, II.Ch5 |
| System architecture | Mermaid (C4 diagram) | I.Ch15, III.Ch1 |
| Job worker state machine | Mermaid (stateDiagram) | I.Ch16, III.Ch4 |
| Capability catalog | Mermaid (table/mindmap) | I.Ch17, III.Ch3 |
| Release gate pipeline | Mermaid (flowchart) | III.Ch10 |

---

## Visual QA Process

For every generated image:

1. **Generate** with `eai image`
2. **Verify** with `eai vision` — confirm it matches editorial intent
3. **Compare** with `eai multi_vision` if checking consistency across a set
4. **Regenerate** if QA fails, adjusting the prompt
5. **Approve** — add to asset inventory with final placement

---

## Chapter as Multimedia Unit

Final deployed structure per chapter:

```
docs/_corpus/field-guide/
├── chapters/
│   └── ch01-the-photograph.md     # Prose with voice markers
├── audio/
│   ├── ch01-the-photograph.mp3    # Full narration (both voices)
│   └── ch01-the-photograph-transcript.md
└── assets/
    ├── ch01-hero.webp              # Hero image
    └── ch01-evidence-timeline.svg  # Generated diagram
```

---

## Production Checklist per Chapter

- [ ] Chapter prose drafted with `<!-- voice: -->` markers
- [ ] Hero image generated and QA'd
- [ ] All diagrams generated
- [ ] Audio segments generated per voice
- [ ] Audio composed into single chapter file
- [ ] Transcript generated with timestamps
- [ ] All assets placed in correct directories
- [ ] Chapter renders correctly in the corpus system

---

*This pipeline turns each chapter from a flat text file into a
multimedia experience: readable, listenable, and visually rich.
The scared solopreneur at 11pm can read, listen, or both.*

*Designed by Claude. Built with the Architect's tools.*
