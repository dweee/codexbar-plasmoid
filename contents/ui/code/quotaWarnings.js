.pragma library

function sanitize(raw) {
    var values = Array.isArray(raw) ? raw : String(raw || "").split(",")
    var out = []
    values.forEach(function (v) { if (String(v).trim() === "") return; var n = Number(v); if (isFinite(n)) { n = Math.max(0, Math.min(99, Math.round(n))); if (out.indexOf(n) < 0) out.push(n) } })
    return out.length ? out.sort(function (a, b) { return b - a }) : [50, 20]
}
function threshold(previous, o, thresholds) {
    var p = previous || {}, fired = (p.fired || []).filter(function (t) { return o.remaining <= t })
    if (previous && o.observedAt <= p.observedAt) return { state: previous, threshold: null }
    var sourceChanged = previous && p.source !== o.source
    var eligible = sanitize(thresholds).filter(function (t) { return t > 0 && o.remaining <= t && fired.indexOf(t) < 0 && (!previous || p.remaining > t) })
    var hit = !sourceChanged && eligible.length ? Math.min.apply(null, eligible) : null
    if (hit !== null) sanitize(thresholds).forEach(function (t) { if (t >= hit && fired.indexOf(t) < 0) fired.push(t) })
    return { state: { remaining: o.remaining, observedAt: o.observedAt, fired: sourceChanged ? [] : fired, source: o.source }, threshold: hit }
}
function session(previous, o, enabled) {
    var p = previous, depleted = o.remaining <= 0.0001
    var validBoundary = o.resetBoundary > Math.max(o.observedAt, o.now) ? o.resetBoundary : null
    var s = { remaining: o.remaining, source: o.source, observedAt: o.observedAt, trustedResetBoundary: validBoundary, pending: null }
    if (!p) return { state: s, kind: enabled && depleted ? "depleted" : null }
    if (p.source !== o.source) return { state: s, kind: null }
    if (o.provider === "codex" && o.observedAt <= p.observedAt) return { state: p, kind: null }
    var wasDepleted = p.remaining <= 0.0001
    var kind = !wasDepleted && depleted ? "depleted" : wasDepleted && !depleted ? "restored" : null
    if (o.provider === "codex") {
        if (p.trustedResetBoundary != null && !(validBoundary != null && validBoundary - p.trustedResetBoundary >= 120000)) s.trustedResetBoundary = p.trustedResetBoundary
        if ((wasDepleted && depleted) || (p.trustedResetBoundary != null && (o.now < p.trustedResetBoundary || o.observedAt < p.trustedResetBoundary))) s.trustedResetBoundary = p.trustedResetBoundary
        if (enabled && kind === "restored") {
            var tooSoon = p.trustedResetBoundary != null && (o.now < p.trustedResetBoundary || o.observedAt < p.trustedResetBoundary)
            var advanced = p.trustedResetBoundary != null && validBoundary != null && validBoundary - p.trustedResetBoundary >= 120000
            if (tooSoon || (!advanced && !(p.pending != null && o.observedAt > p.pending))) {
                s.remaining = p.remaining; s.trustedResetBoundary = p.trustedResetBoundary
                s.pending = tooSoon ? p.pending : o.observedAt; kind = null
            }
        }
    }
    return { state: s, kind: enabled ? kind : null }
}
