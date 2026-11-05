.pragma library

// Keep hourly segment peaks and both sides of resets. Both series retain the
// union of their peak capture times, preserving exact-time burn pairing.
var MAX_ENTRIES = 17520
function compact(entries) {
    var keep = {}, peak = null, preReset = null, bucket = null
    function flush() {
        if (peak) keep[peak.capturedAt] = true
        if (preReset) keep[preReset.capturedAt] = true
    }
    entries.forEach(function (e) {
        var hour = Math.floor(e.capturedAt / 3600000)
        if (hour !== bucket) {
            flush(); bucket = hour; peak = e; preReset = null; return
        }
        var boundary = peak.resetsAt !== null && e.resetsAt !== null && Math.abs(peak.resetsAt - e.resetsAt) >= 120000
        if (boundary) {
            if (!preReset) preReset = peak
            peak = e
        } else if ((peak.resetsAt === null && e.resetsAt !== null) || e.usedPercent >= peak.usedPercent) peak = e
    })
    flush()
    return keep
}

function record(previous, session, weekly, capturedAt) {
    var h = previous ? JSON.parse(JSON.stringify(previous)) : { session: [], weekly: [] }
    if (h.observedAt !== undefined && capturedAt <= h.observedAt) return h
    h.observedAt = capturedAt
    ;[["session", session], ["weekly", weekly]].forEach(function (pair) {
        var w = pair[1], es = h[pair[0]]
        if (!w || w.isSyntheticPlaceholder || typeof w.usedPercent !== "number" || !isFinite(w.usedPercent) || w.usedPercent < 0 || w.usedPercent > 100) return
        if (es.length && es[es.length - 1].capturedAt >= capturedAt) return
        es.push({ capturedAt: capturedAt, usedPercent: w.usedPercent, resetsAt: w.resetsAt ? Date.parse(w.resetsAt) : null })
    })
    var keep = Object.assign(compact(h.session), compact(h.weekly))
    h.session = h.session.filter(function (e) { return keep[e.capturedAt] }).slice(-MAX_ENTRIES)
    h.weekly = h.weekly.filter(function (e) { return keep[e.capturedAt] }).slice(-MAX_ENTRIES)
    return h
}
