import QtQuick
import org.kde.kirigami as Kirigami

// Thin rounded progress bar; fill uses the provider branding color,
// track matches the original's tertiary label @ 22% alpha.
Rectangle {
    id: track

    property real expectedPercent: -1
    property string paceStage: "onTrack"
    property real percent: 0          // 0..100 (fill amount)
    property color fillColor: Kirigami.Theme.highlightColor

    implicitHeight: 5
    radius: height / 2
    color: Qt.alpha(Kirigami.Theme.textColor, 0.14)

    Rectangle {
        visible: track.percent > 0
        anchors.left: parent.left
        anchors.top: parent.top
        anchors.bottom: parent.bottom
        radius: parent.radius
        color: track.fillColor
        width: Math.max(parent.height * 1.4,
                        parent.width * Math.min(100, Math.max(0, track.percent)) / 100)
    }
    Rectangle {
        visible: track.expectedPercent >= 0
        width: 2
        height: parent.height + 4
        anchors.verticalCenter: parent.verticalCenter
        x: Math.max(0, Math.min(parent.width - width, parent.width * track.expectedPercent / 100))
        color: track.paceStage.toLowerCase().indexOf("ahead") >= 0 ? Kirigami.Theme.negativeTextColor : track.paceStage.toLowerCase().indexOf("behind") >= 0 ? Kirigami.Theme.positiveTextColor : Kirigami.Theme.textColor
    }
}
