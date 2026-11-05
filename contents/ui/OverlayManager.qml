import QtQuick
import QtQuick.Window
import org.kde.kirigami as Kirigami
import "code/confettiPalettes.js" as Palettes

Item {
    id: manager
    property bool celebrating: false
    property var originItem
    property string provider: "codex"
    property string message: ""
    property bool respectReducedMotion: true
    property bool layerShellAvailable: true
    function show(providerId, text) {
        if (celebrating) return
        if (!text && respectReducedMotion && Kirigami.Units.longDuration === 0) return
        provider = providerId; message = text || ""
        celebrating = true
        dismiss.interval = text ? 4500 : 8500
        dismiss.start()
    }
    Timer { id: dismiss; onTriggered: manager.celebrating = false }
    Repeater {
        model: Qt.application.screens
        delegate: Loader {
            id: loader
            required property var modelData
            active: manager.celebrating
            source: active ? (Qt.platform.pluginName.indexOf("wayland") >= 0 && manager.layerShellAvailable ? "LayerOverlayWindow.qml" : "OverlayWindow.qml") : ""
            onStatusChanged: {
                if (status === Loader.Error && source.toString().indexOf("LayerOverlay") >= 0) {
                    console.warn("CodexBar: layer-shell unavailable; using frameless overlay")
                    manager.layerShellAvailable = false
                }
            }
            onLoaded: {
                item.screen = modelData
                item.particlePalette = Palettes.forProvider(manager.provider)
                item.message = manager.message
                var point = manager.originItem ? manager.originItem.mapToGlobal(manager.originItem.width / 2, manager.originItem.height / 2) : null
                item.origin = point && point.x >= modelData.virtualX && point.x <= modelData.virtualX + modelData.width
                    && point.y >= modelData.virtualY && point.y <= modelData.virtualY + modelData.height
                    ? Qt.point(point.x - modelData.virtualX, point.y - modelData.virtualY) : Qt.point(modelData.width - 28, 8)
                item.begin()
            }
        }
    }
}
