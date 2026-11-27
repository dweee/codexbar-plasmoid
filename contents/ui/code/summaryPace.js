.pragma library
.import "catalog.js" as Catalog
.import "pace.js" as Pace

// Resolve pace for the actual window displayed by a summary bar. Transport
// slots can be inverted (Kimi) or replaced by named model windows (Antigravity).
function resolve(entry, provider, win, now, days) {
    if (!entry || !entry.usage || !Catalog.windowUsageKnown(win)) return null
    var slots = ["primary", "secondary", "tertiary"]
    var slot = "extra"
    for (var i = 0; i < slots.length; i++) {
        if (entry.usage[slots[i]] === win) { slot = slots[i]; break }
    }
    var minutes = Catalog.effectiveWindowMinutes(win, provider, slot)
    var cli = slot !== "extra" && entry.pace ? entry.pace[slot] : null
    return Pace.resolve(cli, win, minutes, now, days, provider)
}

function expectedPercent(pace, showUsed) {
    return pace ? (showUsed ? pace.expectedUsedPercent : 100 - pace.expectedUsedPercent) : -1
}
