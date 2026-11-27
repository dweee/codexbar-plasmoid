#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
function load(name) {
    const context = {}
    let source = fs.readFileSync(`contents/ui/code/${name}.js`, 'utf8')
    source = source.replace(/^\.import "([^"]+)\.js" as (\w+)$/mg, (_, dependency, alias) => {
        context[alias] = load(dependency); return ''
    })
    vm.createContext(context)
    vm.runInContext(source.replace(/^\.pragma library$/m, ''), context)
    return context
}
const S = load('summaryPace'), C = load('catalog')
const now = Date.parse('2026-11-18T12:00:00Z')
function win(used, minutes, left) {
    return { usedPercent: used, windowMinutes: minutes, resetsAt: new Date(now + left * 60000).toISOString() }
}
const session = win(30, 300, 150), weekly = win(40, 10080, 5040)
const entry = { usage: { primary: session, secondary: weekly } }
const p = S.resolve(entry, 'codex', session, now, 0)
assert.equal(p.expectedUsedPercent, 50)
assert.equal(S.expectedPercent(p, true), 50)
const later = S.resolve(entry, 'codex', session, now + 30 * 60000, 0)
assert.equal(S.expectedPercent(later, true), 60)
assert.equal(S.expectedPercent(later, false), 40)
assert.equal(S.expectedPercent(null, false), -1)

// CLI pace belongs to the transport slot, even when the cadence is inverted.
const cli = { stage: 'ahead', deltaPercent: 10, expectedUsedPercent: 30 }
const kimi = { usage: { primary: { ...weekly, windowMinutes: null }, secondary: session }, pace: { primary: cli } }
assert.equal(S.resolve(kimi, 'kimi', C.windowFor(kimi.usage, 'kimi', 10080), now, 0).expectedUsedPercent, 30)
assert.equal(S.resolve(kimi, 'kimi', C.windowFor(kimi.usage, 'kimi', 300), now, 0), null)

// A weekly-only provider's tab falls back to weekly; use its matching pace.
const weeklyOnly = { usage: { secondary: weekly } }
const pick = C.panelWindow(weeklyOnly.usage, 'codex', 'session')
assert.equal(S.resolve(weeklyOnly, 'codex', pick.window, now, 0).expectedUsedPercent, 50)

// Named Antigravity quotas must not borrow a representative slot's CLI pace.
const ag = { usage: { primary: session, extraRateWindows: [
    { id: 'antigravity-quota-summary-gemini-weekly', window: weekly }
] }, pace: { primary: cli } }
assert.equal(S.resolve(ag, 'antigravity', C.windowFor(ag.usage, 'antigravity', 10080), now, 0).expectedUsedPercent, 50)
for (const invalid of [null, { ...weekly, usageKnown: false }, { ...weekly, isSyntheticPlaceholder: true },
    { ...weekly, usedPercent: 100 }, { ...weekly, resetsAt: null }, { ...weekly, usedPercent: NaN }]) {
    assert.equal(S.resolve(entry, 'codex', invalid, now, 0), null)
}
assert.equal(S.resolve(null, 'codex', weekly, now, 0), null)
assert.equal(S.resolve(entry, 'codex', weekly, now + 8 * 86400000, 0), null)
console.log('summary pace: window selection, CLI slots, display mode, clock and unavailable data passed')
