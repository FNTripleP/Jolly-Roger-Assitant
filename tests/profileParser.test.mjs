import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProfileText } from '../src/profileParser.js'

test('preserves a fragmented project description as one complete item', () => {
  const result = parseProfileText('## Projects\nTry experimenting with\nRaspberry Pi')

  assert.deepEqual(result.profile.projects.activeProjects, ['Try experimenting with Raspberry Pi'])
  assert.ok(result.profile.extractedItems.some((item) => item.text === 'Try experimenting with Raspberry Pi'))
})
