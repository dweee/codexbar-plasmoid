import QtQuick
import QtQuick.LocalStorage
import "code/parity.js" as Parity
import "code/hash.js" as Hash
import "code/sessionEquivalent.js" as Equivalent

QtObject {
    id: store
    property var options
    property var forecasts: ({})
    property string instance: Qt.md5(Date.now() + ":" + Math.random())
    property string databaseName: "codexbar-plasmoid"
    signal eventReady(var event)
    function owner(entry) { return Parity.owner(entry, Hash.sha256) }
    function process(provider, entry, error, now) {
        if (!entry) return
        var account = owner(entry), scoped = !!account
        // Anonymous series never accumulate history: a hidden account switch
        // cannot be proven safe with the Linux CLI contract.
        var key = provider + ":" + (account || "unknown")
        var events = [], forecast = null
        var opts = options
        var db = LocalStorage.openDatabaseSync(databaseName, "", "CodexBar parity state", 16000000)
        try {
            db.transaction(function (tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS parity (key TEXT PRIMARY KEY, value TEXT NOT NULL, touched REAL NOT NULL)")
                tx.executeSql("CREATE TABLE IF NOT EXISTS leases (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires REAL NOT NULL)")
                var lease = tx.executeSql("SELECT owner, expires FROM leases WHERE key = ?", [key])
                var leader = !lease.rows.length || lease.rows.item(0).owner === instance || lease.rows.item(0).expires <= now
                if (leader) tx.executeSql("INSERT OR REPLACE INTO leases VALUES (?, ?, ?)", [key, instance, now + 45000])
                var rows = tx.executeSql("SELECT value FROM parity WHERE key = ?", [key])
                var state = rows.rows.length ? JSON.parse(rows.rows.item(0).value) : { lanes: {} }
                var creditRows = tx.executeSql("SELECT value FROM parity WHERE key = 'credit-receipts'")
                if (creditRows.rows.length) state.credits = JSON.parse(creditRows.rows.item(0).value)
                var result = Parity.reduce(state, provider, entry, error, now, opts, Hash.sha256)
                state = result.state; events = result.events; forecast = result.forecast
                // Atomic read/reduce/write coalesces instances even when their
                // lease changes. The lease avoids redundant writes/side effects.
                if (leader) {
                    tx.executeSql("INSERT OR REPLACE INTO parity VALUES (?, ?, ?)", [key, JSON.stringify(state), now])
                    if (state.credits) tx.executeSql("INSERT OR REPLACE INTO parity VALUES ('credit-receipts', ?, ?)", [JSON.stringify(state.credits), now])
                }
                else events = []
                tx.executeSql("DELETE FROM parity WHERE key IN (SELECT key FROM parity ORDER BY touched DESC LIMIT -1 OFFSET 64)")
                tx.executeSql("DELETE FROM leases WHERE expires < ?", [now - 86400000])
            })
        } catch (e) { console.warn("CodexBar parity persistence failed:", e); return }
        var copy = Object.assign({}, forecasts); copy[key] = forecast; forecasts = copy
        events.forEach(function (event) { store.eventReady(event) })
    }
    function estimateText(provider, entry) {
        if (!entry || !owner(entry)) return ""
        var f = forecasts[provider + ":" + owner(entry)]
        var weekly = Parity.lanes(entry, provider).filter(function (x) { return x.lane === "weekly" })
        return weekly.length && Equivalent.applies(f, weekly[0].window, Date.now()) ? Equivalent.text(f) : ""
    }
}
