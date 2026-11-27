import QtQuick
import QtQuick.Layouts
import org.kde.plasma.plasmoid
import org.kde.plasma.components as PlasmaComponents3
import org.kde.kirigami as Kirigami
import "code/catalog.js" as Catalog
import "code/summaryPace.js" as SummaryPace

// The "Overview" tab: one compact row per provider.
ColumnLayout {
    id: overview

    required property var plasmoidRoot

    signal providerClicked(string providerId)

    spacing: Kirigami.Units.smallSpacing

    PlasmaComponents3.Label {
        visible: overview.plasmoidRoot.enabledProviders.length === 0
        text: i18n("No overview data available.")
        opacity: 0.5
        Layout.fillWidth: true
    }

    Repeater {
        model: overview.plasmoidRoot.enabledProviders

        Rectangle {
            id: overviewRow
            required property string modelData
            readonly property string providerId: modelData
            readonly property var meta: Catalog.meta(providerId)
            readonly property var d: {
                overview.plasmoidRoot.rev
                var x = overview.plasmoidRoot.usageData[providerId]
                return x ? Object.assign({}, x) : null
            }
            readonly property var usage: d && d.entry && d.entry.usage ? d.entry.usage : null
            readonly property var windows: Catalog.overviewWindows(usage, providerId)
            readonly property var monthlyBlocker: Catalog.monthlyBlocker(usage, providerId, overview.plasmoidRoot.nowMs)

            readonly property int verticalInset: Math.ceil(Kirigami.Units.smallSpacing / 2)

            Layout.fillWidth: true
            implicitHeight: rowContent.implicitHeight + verticalInset * 2
            radius: Kirigami.Units.cornerRadius
            color: rowMouse.containsMouse ? Qt.alpha(Kirigami.Theme.textColor, 0.07) : "transparent"

            RowLayout {
                id: rowContent
                anchors.fill: parent
                anchors.leftMargin: Kirigami.Units.smallSpacing
                anchors.rightMargin: Kirigami.Units.smallSpacing
                anchors.topMargin: overviewRow.verticalInset
                anchors.bottomMargin: overviewRow.verticalInset
                spacing: Kirigami.Units.smallSpacing * 2

                ProviderIconImage {
                    iconFile: overviewRow.meta.icon
                    Layout.preferredWidth: Kirigami.Units.iconSizes.smallMedium
                    Layout.preferredHeight: Kirigami.Units.iconSizes.smallMedium
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: Math.floor(Kirigami.Units.smallSpacing / 3)

                    RowLayout {
                        Layout.fillWidth: true

                        PlasmaComponents3.Label {
                            text: overviewRow.meta.name
                            font.weight: Font.DemiBold
                            Layout.fillWidth: true
                            elide: Text.ElideRight
                        }

                        PlasmaComponents3.Label {
                            visible: text !== ""
                            text: {
                                if (overviewRow.d && overviewRow.d.loading)
                                    return i18n("refreshing…")
                                if (!overviewRow.usage)
                                    return i18n("no data")
                                if (!overviewRow.windows.length)
                                    return i18n("no quota data")
                                return ""
                            }
                            opacity: 0.6
                            font: Kirigami.Theme.smallFont
                        }
                    }

                    PlasmaComponents3.Label {
                        Layout.fillWidth: true
                        visible: overviewRow.monthlyBlocker !== null
                        text: i18n("Monthly exhausted · 5-hour and weekly blocked")
                        color: Kirigami.Theme.negativeTextColor
                        font: Kirigami.Theme.smallFont
                        wrapMode: Text.WordWrap
                    }

                    Repeater {
                        model: overviewRow.windows

                        RowLayout {
                            id: quotaRow
                            required property var modelData
                            readonly property var win: modelData.window
                            readonly property var minutes: Catalog.effectiveWindowMinutes(win, overviewRow.providerId, "")
                            readonly property bool blocked: overviewRow.monthlyBlocker !== null
                                && win !== overviewRow.monthlyBlocker && (minutes === 300 || minutes === 10080)
                            readonly property var pace: !blocked && Plasmoid.configuration.showPace
                                ? SummaryPace.resolve(overviewRow.d ? overviewRow.d.entry : null,
                                    overviewRow.providerId, win, overview.plasmoidRoot.nowMs,
                                    Plasmoid.configuration.paceWorkDays) : null
                            Layout.fillWidth: true
                            spacing: Kirigami.Units.smallSpacing * 2

                            PlasmaComponents3.Label {
                                text: quotaRow.modelData.title
                                Layout.preferredWidth: Kirigami.Units.gridUnit * (overviewRow.providerId === "antigravity" ? 7 : 5)
                                opacity: 0.6
                                font: Kirigami.Theme.smallFont
                            }

                            UsageBar {
                                Layout.fillWidth: true
                                implicitHeight: 4
                                percent: Catalog.windowBarFill(quotaRow.win, Plasmoid.configuration.usageBarsShowUsed)
                                expectedPercent: SummaryPace.expectedPercent(quotaRow.pace, Plasmoid.configuration.usageBarsShowUsed)
                                paceStage: quotaRow.pace ? quotaRow.pace.stage : "onTrack"
                                fillColor: quotaRow.blocked || quotaRow.win === overviewRow.monthlyBlocker
                                    ? Kirigami.Theme.negativeTextColor : overviewRow.meta.color
                                opacity: quotaRow.blocked || !quotaRow.win ? 0.35 : 1
                            }

                            PlasmaComponents3.Label {
                                text: {
                                    if (quotaRow.blocked) return i18n("Blocked")
                                    if (!quotaRow.win) return "–"
                                    if (Plasmoid.configuration.usageBarsShowUsed)
                                        return Catalog.windowUsedText(quotaRow.win) + i18n("% used")
                                    return Catalog.windowRemainingText(quotaRow.win) + i18n("% left")
                                }
                                color: quotaRow.blocked || quotaRow.win === overviewRow.monthlyBlocker
                                    ? Kirigami.Theme.negativeTextColor : Kirigami.Theme.textColor
                                opacity: 0.6
                                font: Kirigami.Theme.smallFont
                                horizontalAlignment: Text.AlignRight
                                Layout.minimumWidth: Kirigami.Units.gridUnit * 3
                            }
                        }
                    }
                }
            }

            MouseArea {
                id: rowMouse
                anchors.fill: parent
                hoverEnabled: true
                onClicked: overview.providerClicked(overviewRow.providerId)
            }
        }
    }
}
