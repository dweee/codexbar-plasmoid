.pragma library

// UsagePace.swift / UsagePaceText.swift. Times in milliseconds at the JS boundary.
function slices(start, end, days) {
    var out = []
    for (var cursor = start; cursor < end;) {
        var date = new Date(cursor)
        var next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
        var stop = Math.min(next, end)
        var iso = date.getDay() || 7
        if (!(days >= 2 && days < 7) || iso <= days)
            out.push({ start: cursor, end: stop })
        cursor = stop
    }
    return out
}
function workSeconds(start, end, days) {
    return slices(start, end, days).reduce(function (sum, s) { return sum + (s.end - s.start) / 1000 }, 0)
}
function duration(seconds) {
    if (seconds < 1) return "now"
    var m = Math.ceil(seconds / 60), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60)
    m %= 60
    if (d) return d + "d" + (h ? " " + h + "h" : m ? " " + m + "m" : "")
    return h ? h + "h" + (m ? " " + m + "m" : "") : m + "m"
}
function calculate(win, minutes, now, days) {
    if (!win || win.isSyntheticPlaceholder || typeof win.usedPercent !== "number" || !isFinite(win.usedPercent)) return null
    var reset = Date.parse(win.resetsAt), total = minutes * 60, remaining = (reset - now) / 1000
    if (!(total > 0 && remaining > 0 && remaining <= total)) return null
    var elapsed = total - remaining
    if (minutes === 10080 && days >= 2 && days < 7) {
        total = workSeconds(reset - minutes * 60000, reset, days)
        remaining = workSeconds(now, reset, days)
        elapsed = total - remaining
    }
    var actual = Math.max(0, Math.min(100, win.usedPercent))
    if (!(total > 0) || (elapsed === 0 && actual > 0)) return null
    var expected = 100 * elapsed / total, delta = actual - expected, abs = Math.abs(delta)
    var stage = abs <= 2 ? "onTrack" : (abs <= 6 ? "slightly" : abs <= 12 ? "" : "far") + (delta > 0 ? "Ahead" : "Behind")
    if (stage === "Ahead") stage = "ahead"
    if (stage === "Behind") stage = "behind"
    var eta = null, lasts = false
    if (actual >= 100) eta = 0
    else if (elapsed > 0 && actual === 0) lasts = true
    else if (elapsed > 0) {
        var workingEta = (100 - actual) / (actual / elapsed)
        lasts = workingEta >= remaining
        if (!lasts) {
            eta = workingEta
            if (minutes === 10080 && days >= 2 && days < 7) {
                var parts = slices(now, reset, days), left = workingEta
                for (var i = 0; i < parts.length; i++) {
                    var length = (parts[i].end - parts[i].start) / 1000
                    if (left <= length) { eta = (parts[i].start - now) / 1000 + left; break }
                    left -= length
                }
            }
        }
    }
    var projected = elapsed > 0 ? actual * remaining / elapsed : 0
    return { stage: stage, deltaPercent: delta, expectedUsedPercent: expected, willLastToReset: lasts,
        etaSeconds: eta, speedMultiplierToReset: projected > 0 && actual < 100 ? (100 - actual) / projected : null }
}
function resolve(cli, win, minutes, now, days, provider) {
    if (!win || win.isSyntheticPlaceholder || win.usedPercent >= 100) return null
    var fallback = calculate(win, minutes, now, days)
    var p = cli && typeof cli.deltaPercent === "number" ? Object.assign({}, cli) : fallback
    // Preserve CLI eligibility/provider semantics. Fallback covers the existing
    // Kimi weekly path and the known Codex/Claude session/weekly capabilities.
    if (!cli && !(minutes === 10080 || ((provider === "codex" || provider === "claude") && minutes === 300))) return null
    if (!p || p.expectedUsedPercent < 3) return null
    if (p.speedMultiplierToReset == null && fallback) p.speedMultiplierToReset = fallback.speedMultiplierToReset
    return p
}
function text(p, session, provider) {
    if (!p) return ""
    var rounded = Math.round(Math.abs(p.deltaPercent))
    var left = p.stage === "onTrack" || rounded === 0 ? "On pace" : rounded + "% in " + (p.deltaPercent > 0 ? "deficit" : "reserve")
    var right = ""
    if (p.willLastToReset) {
        right = "Lasts until reset"
        if (provider === "codex" && p.deltaPercent < -15 && p.speedMultiplierToReset >= 1.5) right += " · 1.5× headroom"
    } else if (typeof p.etaSeconds === "number") {
        var eta = duration(p.etaSeconds)
        right = (session ? "Projected empty" : "Runs out") + (eta === "now" ? " now" : " in " + eta)
    }
    if (typeof p.runOutProbability === "number") right += (right ? " " : "") + "(" + Math.round(Math.max(0, Math.min(1, p.runOutProbability)) * 20) * 5 + "% risk)"
    return "Pace: " + left + (right ? " · " + right : "")
}
