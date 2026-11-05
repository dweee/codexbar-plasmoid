import QtQuick
import QtQuick.Window
import org.kde.kirigami as Kirigami

Window {
    id: overlay
    color: "transparent"
    flags: Qt.WindowTransparentForInput | Qt.WindowDoesNotAcceptFocus | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
    property var palette: []
    property point origin: Qt.point(width - 28, 8)
    property string message: ""
    width: screen ? screen.width : 1920
    height: screen ? screen.height : 1080
    x: screen ? screen.virtualX : 0
    y: screen ? screen.virtualY : 0
    function begin() { visible = true; if (!message) fireworks.begin() }
    ConfettiCanvas {
        id: fireworks
        anchors.fill: parent
        palette: overlay.palette
        origin: overlay.origin
        visible: !overlay.message
    }
    Rectangle {
        visible: overlay.message !== ""
        anchors.centerIn: parent
        width: Math.min(480, overlay.width - 40)
        height: text.implicitHeight + 48
        radius: 16
        color: Kirigami.Theme.backgroundColor
        border.color: Kirigami.Theme.highlightColor
        Text {
            id: text
            anchors.fill: parent
            anchors.margins: 24
            text: overlay.message
            wrapMode: Text.WordWrap
            color: Kirigami.Theme.textColor
            font.pixelSize: 20
            horizontalAlignment: Text.AlignHCenter
        }
    }
}
