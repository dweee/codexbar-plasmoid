.pragma library

// Keep hourly segment peaks and both sides of resets. Both series retain the
// union of their peak capture times, preserving exact-time burn pairing.
var MAX_ENTRIES = 17520
function compact(entries) {
    var keep = {}, peak = null, bucket = null
    entries.forEach(function (e, i) {
        var hour = Math.floor(e.capturedAt / 3600000)
        var boundary = peak && peak.resetsAt !== null && e.resetsAt !== null && Math.abs(peak.resetsAt - e.resetsAt) >= 120000
        if (bucket !== hour || boundary || (peak && e.usedPercent < peak.usedPercent)) {
            if (peak) keep[peak.capturedAt] = true
            if (boundary || (peak && e.usedPercent < peak.usedPercent)) keep[e.capturedAt] = true
            peak = e; bucket = hour
        } else if (!peak || e.usedPercent >= peak.usedPercent) peak = e
        if (i === entries.length - 1) { keep[e.capturedAt] = true; if (peak) keep[peak.capturedAt] = true }
    })
    return keep
}
function record(previous, session, weekly, capturedAt) {
    var h = previous ? JSON.parse(JSON.stringify(previous)) : { session: [], weekly: [] }
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
