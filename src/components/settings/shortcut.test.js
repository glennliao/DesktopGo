import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildShortcutFromKeyDown, formatShortcutForInput } from './shortcut.ts'

const key = (code, modifiers = {}) => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...modifiers,
})

test('records space, letters and symbol keys as physical shortcut codes', () => {
  for (const [event, expected, display] of [
    [key('Space', { ctrlKey: true }), 'Ctrl+Space', 'Ctrl+Space'],
    [key('KeyK', { ctrlKey: true, altKey: true }), 'Ctrl+Alt+KeyK', 'Ctrl+Alt+K'],
    [key('Equal', { ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+Equal', 'Ctrl+Shift+='],
    [key('ArrowUp', { altKey: true }), 'Alt+ArrowUp', 'Alt+Up'],
    [key('KeyP', { metaKey: true }), 'Super+KeyP', 'Super+P'],
  ]) {
    const result = buildShortcutFromKeyDown(event)
    assert.equal(result.shortcut, expected)
    assert.equal(formatShortcutForInput(result.shortcut), display)
  }
})

test('waits silently while only a modifier is pressed', () => {
  for (const code of ['ControlLeft', 'AltRight', 'ShiftLeft', 'MetaRight']) {
    assert.equal(buildShortcutFromKeyDown(key(code)).ignore, true)
  }
})

test('rejects bare keys and unidentified primary keys', () => {
  for (const event of [
    key('Space'),
    key('Unidentified', { ctrlKey: true }),
    key('', { altKey: true }),
  ]) {
    const result = buildShortcutFromKeyDown(event)
    assert.equal(result.shortcut, undefined)
    assert.ok(result.error)
  }
})
