import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProfileText } from './profileParser.js'

test('parses headings, paragraphs, and bullets into structured sections', () => {
  const input = `# Identity
My name is Maya and I am a product designer based in Seattle.

## Mission
I want to build calm systems for people and keep my work grounded in stewardship.
- Help teams move with more clarity
- Create tools that scale well

## Values
- Stewardship
- Calm systems
- Curiosity

## Goals
- Finish the new onboarding experience
- Launch the beta in September
- Grow the community cafe

## Career
I am aiming to become a principal designer over the next few years.

## Finances
I want to save 25% of my income and buy a home.

## Fitness
I train four times per week and eat mostly whole foods.

## People
- My partner Leo
- My mentor Nora

## Projects
- Build a personal dashboard
- Launch a side business

## Routines
- Morning planning before 8am
- Evening review before bed

## Challenges
- I struggle with overcommitting
- Context switching slows work down

## Assistant Preferences
Be thoughtful and direct. Prefer concise updates and clear priorities.`

  const result = parseProfileText(input)

  assert.ok(result.summary.detectedSections >= 10)
  assert.ok(result.summary.extractedFacts >= 15)
  assert.ok(result.summary.uncategorizedNotes === 0)
  assert.ok(result.profile.values.length >= 1)
  assert.ok(result.profile.goals.length >= 3)
  assert.ok(result.profile.people.length >= 2)
  assert.ok(result.profile.assistantPreferences.length >= 1)
})
