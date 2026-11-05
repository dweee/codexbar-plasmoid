.pragma library

function upcoming(previous, boundary, now) {
    if (!(boundary > now)) return { state: previous, fire: false }
    var stage = boundary - now <= 3600000 ? 1 : boundary - now <= 86400000 ? 0 : -1
    var p = previous && previous.boundary === boundary ? previous : { boundary: boundary, stage: -1 }
    return stage > p.stage ? { state: { boundary: boundary, stage: stage }, fire: true } : { state: p, fire: false }
}
function predictive(previous, pace, boundary, minutes) {
    var same = previous && previous.minutes === minutes && Math.abs(previous.boundary - boundary) < (minutes ? Math.max(minutes * 30000, 300000) : 300000)
    var warned = same && previous.warned
    if (pace && pace.willLastToReset) warned = false
    var fire = !!(pace && !pace.willLastToReset && pace.etaSeconds > 0 && (pace.runOutProbability == null || pace.runOutProbability >= 0.5) && !warned)
    return { state: { boundary: boundary, minutes: minutes, warned: warned || fire }, fire: fire }
}
function authenticationFailure(error) {
    if (!error) return false
    var code = String(error.code || "").toLowerCase(), message = String(error.message || error).toLowerCase()
    return /^(unauthorized|authentication_failed|token_expired|invalid_token|auth_expired)$/.test(code)
        || /(?:access|refresh|authentication|oauth) token (?:has )?expired|invalid (?:access|refresh|oauth) token|authentication (?:has )?failed|not (?:logged|signed) in|please (?:log|sign) in/.test(message)
}
function credential(previous, error, freshSuccess, enabled) {
    var active = !!previous
    if (freshSuccess) active = false
    var fire = enabled && authenticationFailure(error) && !active
    return { state: active || fire, fire: fire }
}
function creditExpiry(previous, credits, now) {
    var list = (credits || []).filter(function (c) { var t = Date.parse(c.expires_at); return c.status === "available" && t > now && t - now <= 259200000 })
    var fingerprint = list.map(function (c) { return c.id + ":" + c.expires_at }).sort().join("|")
    var receipts = (previous || []).slice(-64), fire = !!fingerprint && receipts.indexOf(fingerprint) < 0
    if (fire) receipts.push(fingerprint)
    return { state: receipts.slice(-64), fire: fire, expiries: list.map(function (c) { return c.expires_at }).sort() }
}
