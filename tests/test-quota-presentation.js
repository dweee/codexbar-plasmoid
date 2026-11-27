#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const C = {}
vm.createContext(C)
vm.runInContext(fs.readFileSync('contents/ui/code/catalog.js', 'utf8').replace(/^\.pragma library$/m, ''), C)
const now = Date.parse('2026-11-24T12:00:00Z')
const win = (usedPercent, windowMinutes, resetsAt = '2026-11-26T08:00:00Z') => ({usedPercent, windowMinutes, resetsAt})
const usage = {primary: win(0, 300), secondary: win(4, 10080), tertiary: win(100, 43200)}
assert.equal(C.monthlyBlocker(usage, 'opencodego', now), usage.tertiary)
for (const source of ['session', 'weekly', 'lowest']) {
    const pick = C.panelWindow(usage, 'opencodego', source, now)
    assert.equal(pick.remaining, 0)
    assert.equal(pick.window, usage.tertiary)
    assert.equal(C.panelCountdown(pick, now), '1d 20h')
}
assert.deepEqual(Array.from(C.overviewWindows(usage, 'opencodego'), r => r.title), ['5-hour', 'Weekly', 'Monthly'])
assert.equal(C.windowRemainingText(usage.primary), '100') // preserve the raw reading
assert.equal(C.windowRemainingText(usage.secondary), '96')
assert.equal(C.monthlyBlocker(usage, 'codex', now), null)
assert.equal(C.panelWindow(usage, 'codex', 'session', now).remaining, 100)
for (const tertiary of [null, win(99.6, 43200), win(100, 10080), win(100, 43200, '2026-11-24T12:00:00Z'),
    {...usage.tertiary, usageKnown: false}, {...usage.tertiary, isSyntheticPlaceholder: true},
    {...usage.tertiary, usedPercent: NaN}, {...usage.tertiary, usedPercent: '100'}]) {
    const u = {...usage, tertiary}
    assert.equal(C.monthlyBlocker(u, 'opencodego', now), null)
    assert.equal(C.panelWindow(u, 'opencodego', 'session', now).window, usage.primary)
}
assert.equal(C.monthlyBlocker({...usage, tertiary: win(101, 43200)}, 'opencodego', now).usedPercent, 101)
assert.equal(C.monthlyBlocker({...usage, tertiary: win(100, 43200, null)}, 'opencodego', now).usedPercent, 100)
assert.equal(C.monthlyBlocker(null, 'opencodego', now), null)
const cursor = {primary: win(85, 43200), secondary: win(84, 43200), tertiary: win(100, 43200)}
assert.deepEqual(Array.from(C.overviewWindows(cursor, 'cursor'), r => r.title), ['Total', 'Cursor', 'Third Party'])
assert.deepEqual(Array.from(C.notificationWindows(cursor, 'cursor'), r => r.label), ['Total', 'Cursor', 'Third Party'])
assert.equal(C.slotTitle('cursor', 'primary', 10080), 'Weekly') // unified weekly plan
assert.equal(C.slotTitle('codex', 'primary', 300), 'Session')
assert.equal(C.monthlyBlocker(cursor, 'cursor', now), null) // third party does not gate all Cursor usage
assert.deepEqual(Array.from(C.overviewWindows(null, 'opencodego')), [])
console.log('quota presentation: monthly gating, raw readings, resets and Cursor lane names passed')

// The screenshot has 95% Gemini weekly left, versus 77% Claude/GPT left.
// Every summary source must keep Gemini, including the "lowest" panel mode.
const ag = {extraRateWindows: [
    {id: 'antigravity-quota-summary-gemini-5h', title: 'Gemini 5-hour', window: win(0, 300)},
    {id: 'antigravity-quota-summary-gemini-weekly', title: 'Gemini weekly', window: win(5, 10080)},
    {id: 'antigravity-quota-summary-3p-5h', title: 'Claude/GPT 5-hour', window: win(80, 300)},
    {id: 'antigravity-quota-summary-3p-weekly', title: 'Claude/GPT weekly', window: win(23, 10080)}
]}
assert.equal(C.panelWindow(ag, 'antigravity', 'session', now).remaining, 100)
assert.equal(C.panelWindow(ag, 'antigravity', 'weekly', now).remaining, 95)
assert.equal(C.panelWindow(ag, 'antigravity', 'lowest', now).remaining, 95)
assert.deepEqual(Array.from(C.overviewWindows(ag, 'antigravity'), r => r.title), ['Gemini 5-hour', 'Gemini weekly', 'Claude/GPT 5-hour', 'Claude/GPT weekly'])
assert.equal(C.overviewWindows(ag, 'antigravity')[1].window, ag.extraRateWindows[1].window)
assert.equal(C.overviewWindows(ag, 'antigravity')[3].window, ag.extraRateWindows[3].window)
// Unknown or synthetic Gemini falls back independently for that cadence.
for (const invalid of [
    {...ag.extraRateWindows[1], usageKnown: false},
    {...ag.extraRateWindows[1], window: {...ag.extraRateWindows[1].window, isSyntheticPlaceholder: true}},
    {...ag.extraRateWindows[1], window: {...ag.extraRateWindows[1].window, usedPercent: NaN}}
]) {
    const fallback = {extraRateWindows: [ag.extraRateWindows[0], invalid, ...ag.extraRateWindows.slice(2)]}
    assert.equal(C.panelWindow(fallback, 'antigravity', 'session', now).remaining, 100)
    assert.equal(C.panelWindow(fallback, 'antigravity', 'weekly', now).remaining, 77)
    assert.equal(C.overviewWindows(fallback, 'antigravity')[1].title, 'Claude/GPT weekly')
}
// Exhausted Gemini is a valid reading, not a reason to switch families.
const exhausted = {extraRateWindows: [{...ag.extraRateWindows[1], window: win(100, 10080)}, ag.extraRateWindows[3]]}
assert.equal(C.panelWindow(exhausted, 'antigravity', 'weekly', now).remaining, 0)
assert.equal(C.antigravitySummaryPick(null, 10080), null)
console.log('Antigravity summary: Gemini priority, lowest mode, fallback labels and exhaustion passed')

// A weekly-only Codex plan does not acquire a Session row from an absent,
// synthetic or unreadable primary window, regardless of its transport slot.
const weekly = win(84, 10080)
for (const primary of [undefined, {...win(0, 300), isSyntheticPlaceholder: true},
    {...win(0, 300), usageKnown: false}, win(null, 300)]) {
    const weeklyOnly = {primary, secondary: weekly}
    assert.deepEqual(Array.from(C.overviewWindows(weeklyOnly, 'codex'), r => r.title), ['Weekly'])
    assert.equal(C.overviewWindows(weeklyOnly, 'codex')[0].window, weekly)
}
assert.deepEqual(Array.from(C.overviewWindows({primary: weekly}, 'codex'), r => r.title), ['Weekly'])
assert.equal(C.windowFor({primary: weekly}, 'codex', 300), null)

const exhaustedWeekly = win(100, 10080)
const extra = {id: 'claude-weekly-scoped-opus', title: 'Opus weekly', window: exhaustedWeekly}
const claude = {primary: win(0, 300), secondary: weekly, extraRateWindows: [
    extra, {title: 'Unread', window: weekly, usageKnown: false}
]}
assert.deepEqual(Array.from(C.overviewWindows(claude, 'claude'), r => r.title),
    ['Session', 'Weekly', 'Opus weekly'])
assert.equal(C.overviewWindows(claude, 'claude')[2].window, exhaustedWeekly)
assert.deepEqual(Array.from(C.overviewWindows({}, 'codex')), [])
