// Isolated real-Qt smoke test. Never touches plasmashell or its configuration.
import QtQuick
import QtQuick.Window
import "../contents/ui" as Widget

Window {
    id: harness
    visible: true
    width: 360
    height: 180
    title: "CodexBar isolated parity smoke test"
    property int eventCount: 0
    property var settings: ({ quotaWarningNotificationsEnabled: true, quotaWarningSessionEnabled: true,
        quotaWarningWeeklyEnabled: true, quotaWarningSessionThresholds: "50,20", quotaWarningWeeklyThresholds: "50,20",
        sessionQuotaNotificationsEnabled: true, limitResetNotificationsEnabled: true,
        predictivePaceWarningNotificationsEnabled: false, upcomingResetNotificationsEnabled: true,
        credentialExpiryNotificationsEnabled: false, codexResetCreditExpiryNotificationsEnabled: true, confettiMode: "off", paceWorkDays: 0 })
    function entry(now, used) {
        return { provider: "claude", source: "oauth", usage: { updatedAt: new Date(now).toISOString(),
            identity: { accountID: "smoke-fixture-account" }, primary: { usedPercent: used, windowMinutes: 300, resetsAt: new Date(now + 3600000).toISOString() },
            secondary: { usedPercent: 40, windowMinutes: 10080, resetsAt: new Date(now + 86400000).toISOString() } } }
    }
    Widget.ParityStore {
        id: first
        databaseName: "codexbar-parity-smoke-" + harness.objectName
        options: harness.settings
        onEventReady: function (event) { harness.eventCount++; console.log("PARITY EVENT", event.kind, event.lane) }
    }
    Widget.ParityStore {
        id: second
        databaseName: first.databaseName
        options: harness.settings
        onEventReady: function (event) { harness.eventCount++; console.log("DUPLICATE EVENT", event.kind) }
    }
    Widget.OverlayManager { id: overlay; originItem: target }
    Rectangle {
        id: target
        anchors.centerIn: parent
        width: 260; height: 80; color: "#736bd4"
        Text { anchors.centerIn: parent; text: "Isolated confetti test"; color: "white" }
    }
    Timer {
        interval: 1000; running: true
        onTriggered: {
            var now = Date.now()
            first.process("claude", harness.entry(now, 90), null, now)
            second.process("claude", harness.entry(now, 90), null, now)
            if (harness.eventCount !== 2) { console.error("FAIL lease/threshold expected 2, got", harness.eventCount); Qt.exit(1); return }
            first.process("claude", harness.entry(now + 1000, 90), null, now + 1000)
            if (harness.eventCount !== 2) { console.error("FAIL repeat dedup"); Qt.exit(1); return }
            overlay.show("codex", "")
            console.log("PARITY SMOKE: reducers/persistence/lease passed; overlay requested on", Qt.application.screens.length, "screens")
        }
    }
    Timer {
        interval: 2500; running: true
        onTriggered: {
            // Walk the manager's own objects; capture only its transparent
            // windows, never the user's desktop or other applications.
            var found = 0
            function visit(object) {
                if (object.item && object.item.contentItem) {
                    var window = object.item
                    console.log("OVERLAY", window.visible, window.width, window.height, window.flags, window.screen.name)
                    window.contentItem.grabToImage(function (result) { result.saveToFile("/tmp/cbp-notes/confetti-overlay.png") })
                    found++
                }
                if (object.children) for (var i = 0; i < object.children.length; i++) visit(object.children[i])
            }
            visit(overlay)
            console.log("OVERLAY WINDOWS", found)
            if (found !== Qt.application.screens.length) { console.error("FAIL screen overlays"); Qt.exit(1) }
        }
    }
    Timer {
        interval: 11000; running: true
        onTriggered: {
            if (overlay.celebrating) { console.error("FAIL overlay did not dismiss"); Qt.exit(1); return }
            console.log("PARITY SMOKE PASSED; overlay dismissed")
            Qt.quit()
        }
    }
    Component.onCompleted: objectName = String(Date.now())
}
