.pragma library

function advanced(previous, current, requiresPrevious) {
    if (previous === null || previous === undefined) return !requiresPrevious
    return current !== null && current !== undefined && current - previous >= 120000
}
function matches(a, b) { return a != null && b != null && Math.abs(a - b) < 1000 }
// Direct port of UsageStore.limitResetDetectorTransition. Pure; caller persists
// the result before dispatching celebration/notification events.
function transition(previous, o) {
    var p = previous || {}, above = o.usedPercent > 1, candidateAbove = o.usedPercent > 25
    if (previous && o.observedAt <= p.lastObservedAt) return { state: previous, shouldPost: false }
    var cw = o.provider === "codex" && o.lane === "weekly"
    var clw = o.provider === "claude" && o.lane === "weekly"
    var gw = o.provider === "grok" && o.lane === "weekly"
    var recovering = clw && p.recoveryAboveThresholdCount != null
    var plan = cw ? o.plan : null
    var planChanged = cw && p.planRawValue != null && p.planRawValue !== plan
    var planMatches = cw && plan != null && p.planRawValue === plan
    var sourceChanged = o.lane === "session" && p.sourceRawValue != null && p.sourceRawValue !== o.source
    var allows = o.lane === "session" ? advanced(p.resetBoundary, o.resetBoundary, false)
        : cw ? advanced(p.resetBoundary, o.resetBoundary, true)
        : gw ? p.resetBoundary != null && o.resetBoundary != null && o.observedAt >= p.resetBoundary
            && o.resetBoundary > p.resetBoundary && !matches(p.lastPostedResetBoundary, o.resetBoundary) : true
    var crossed = !sourceChanged && p.wasAboveThreshold === true && !above
    var confirming = !sourceChanged && p.pendingLowConfirmation === true && !above
    var age = p.pendingLowObservedAt == null ? null : o.observedAt - p.pendingLowObservedAt
    var compatible = cw && p.pendingLowConfirmation === true && planMatches && matches(p.resetBoundary, o.resetBoundary)
        && !matches(p.lastPostedResetBoundary, o.resetBoundary) && o.usedPercent <= 5 && o.observedAt < o.resetBoundary
        && age !== null && age >= 0 && age <= 1800000
    var confirmCandidate = compatible && age >= 60000, retainCandidate = compatible && !confirmCandidate
    var expired = cw && p.pendingLowConfirmation === true && !confirmCandidate && !retainCandidate && !allows
    var startCandidate = cw && p.pendingLowConfirmation !== true && planMatches && !sourceChanged
        && p.wasAboveCodexWeeklyCandidateThreshold === true && o.usedPercent <= 5 && !allows
        && matches(p.resetBoundary, o.resetBoundary) && !matches(p.lastPostedResetBoundary, o.resetBoundary) && o.observedAt < o.resetBoundary
    var post = o.requiresLowConfirmation ? confirming && !recovering
        : cw ? !planChanged && ((!sourceChanged && p.wasAboveThreshold === true && o.usedPercent <= 5 && allows) || confirmCandidate)
        : crossed && allows && !recovering
    var awaitLow = o.requiresLowConfirmation && crossed && !confirming && allows && !recovering
    var grokRebaseline = gw && !post && p.grokWeeklyBoundaryConfirmed !== true && p.resetBoundary != null
        && o.resetBoundary != null && o.resetBoundary < p.resetBoundary
    var preserveBoundary = !sourceChanged && !grokRebaseline && ((gw && !post && p.resetBoundary != null)
        || (!allows && (o.lane === "session" || p.resetBoundary != null)))
    var preserveBaseline = crossed && !allows && !planChanged && !expired
    var recoveryCount = recovering && above ? (p.recoveryAboveThresholdCount || 0) + 1 : 0
    var recovered = recovering && recoveryCount >= 2
    var state = {
        wasAboveThreshold: post ? false : recovering ? recovered : expired || planChanged ? (cw ? candidateAbove : above) : preserveBaseline || awaitLow ? true : above,
        wasAboveCodexWeeklyCandidateThreshold: cw && !post && (preserveBaseline ? p.wasAboveCodexWeeklyCandidateThreshold === true : candidateAbove),
        lastObservedAt: o.observedAt, sourceRawValue: o.source,
        resetBoundary: preserveBoundary ? p.resetBoundary : o.resetBoundary,
        recoveryAboveThresholdCount: post ? 0 : recovering && !recovered ? recoveryCount : null,
        pendingLowConfirmation: awaitLow || startCandidate || retainCandidate,
        pendingLowObservedAt: startCandidate ? o.observedAt : retainCandidate ? p.pendingLowObservedAt : null,
        lastPostedResetBoundary: planChanged ? null : post ? o.resetBoundary : p.lastPostedResetBoundary,
        notificationReceipt: p.notificationReceipt, lastNotifiedResetBoundary: p.lastNotifiedResetBoundary,
        planRawValue: plan, grokWeeklyBoundaryConfirmed: gw && post ? true : p.grokWeeklyBoundaryConfirmed
    }
    return { state: state, shouldPost: post }
}
// LimitResetNotifications.prepareLimitResetNotification: restored wins.
function notice(state, previous, o, confirmed, restored, options) {
    var p = previous || {}, receipt = state.notificationReceipt
    var covered = receipt && !advanced(receipt.resetBoundary, o.resetBoundary, true)
    var restoreEnabled = restored && options.sessionQuotaNotificationsEnabled && !covered
    if ((state.wasAboveThreshold && p.wasAboveThreshold === false) || 100 - o.usedPercent <= 0.0001) state.notificationReceipt = null
    if (o.resetBoundary != null) {
        var advance = advanced(state.lastNotifiedResetBoundary, o.resetBoundary, false)
        if (state.notificationReceipt && state.notificationReceipt.resetBoundary == null) {
            if (advance) state.lastNotifiedResetBoundary = o.resetBoundary
            state.notificationReceipt = { resetBoundary: o.resetBoundary }
            return null
        }
        if (!advance && !(restoreEnabled && !state.notificationReceipt)) {
            if (confirmed || restored) state.notificationReceipt = { resetBoundary: o.resetBoundary }
            return null
        }
    } else if (state.notificationReceipt) return null
    var kind = restoreEnabled ? "restored" : confirmed && options.limitResetNotificationsEnabled ? "reset" : null
    if (!kind) return null
    state.notificationReceipt = { resetBoundary: o.resetBoundary }
    if (o.resetBoundary != null) state.lastNotifiedResetBoundary = Math.max(state.lastNotifiedResetBoundary || o.resetBoundary, o.resetBoundary)
    return kind
}
