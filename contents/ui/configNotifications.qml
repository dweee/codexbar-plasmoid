import QtQuick
import QtQuick.Controls as QQC2
import QtQuick.Layouts
import org.kde.kirigami as Kirigami
import org.kde.kcmutils as KCM

KCM.SimpleKCM {
    id: page
    property alias cfg_credentialExpiryNotificationsEnabled: credentialExpiryNotificationsEnabled.checked
    property alias cfg_sessionQuotaNotificationsEnabled: sessionQuotaNotificationsEnabled.checked
    property alias cfg_quotaWarningNotificationsEnabled: quotaWarningNotificationsEnabled.checked
    property alias cfg_predictivePaceWarningNotificationsEnabled: predictivePaceWarningNotificationsEnabled.checked
    property alias cfg_limitResetNotificationsEnabled: limitResetNotificationsEnabled.checked
    property alias cfg_codexResetCreditExpiryNotificationsEnabled: codexResetCreditExpiryNotificationsEnabled.checked
    property alias cfg_upcomingResetNotificationsEnabled: upcomingResetNotificationsEnabled.checked
    property alias cfg_quotaWarningSessionEnabled: quotaWarningSessionEnabled.checked
    property alias cfg_quotaWarningWeeklyEnabled: quotaWarningWeeklyEnabled.checked
    property alias cfg_quotaWarningSoundEnabled: quotaWarningSoundEnabled.checked
    property alias cfg_quotaWarningOnScreenAlertEnabled: quotaWarningOnScreenAlertEnabled.checked
    property alias cfg_notifyStatus: notifyStatus.checked
    property alias cfg_respectReducedMotion: respectReducedMotion.checked
    property alias cfg_quotaWarningSessionThresholds: thresholdsSession.text
    property alias cfg_quotaWarningWeeklyThresholds: thresholdsWeekly.text
    property string cfg_confettiMode
    property int cfg_testConfettiSerial
    property int cfg_testNotificationSerial
    Kirigami.FormLayout {
        QQC2.CheckBox { id: credentialExpiryNotificationsEnabled; text: i18n("Credential expiry") }
        QQC2.CheckBox { id: sessionQuotaNotificationsEnabled; text: i18n("Quota depleted & restored") }
        QQC2.CheckBox { id: quotaWarningNotificationsEnabled; text: i18n("Threshold warnings") }
        QQC2.CheckBox { id: predictivePaceWarningNotificationsEnabled; text: i18n("Pace warnings") }
        QQC2.CheckBox { id: limitResetNotificationsEnabled; text: i18n("Limit reset notifications") }
        QQC2.CheckBox { id: codexResetCreditExpiryNotificationsEnabled; text: i18n("Codex reset credit expiry") }
        QQC2.CheckBox { id: upcomingResetNotificationsEnabled; text: i18n("Upcoming reset warnings") }
        QQC2.CheckBox { id: quotaWarningSessionEnabled; text: i18n("Session warnings") }
        QQC2.CheckBox { id: quotaWarningWeeklyEnabled; text: i18n("Weekly warnings") }
        QQC2.TextField {
            id: thresholdsSession
            Kirigami.FormData.label: i18n("Session thresholds (% remaining):")
            placeholderText: "50,20"
            validator: RegularExpressionValidator { regularExpression: /[0-9, ]*/ }
        }
        QQC2.TextField {
            id: thresholdsWeekly
            Kirigami.FormData.label: i18n("Weekly thresholds (% remaining):")
            placeholderText: "50,20"
            validator: RegularExpressionValidator { regularExpression: /[0-9, ]*/ }
        }
        QQC2.CheckBox { id: quotaWarningSoundEnabled; text: i18n("Play sound") }
        QQC2.CheckBox { id: quotaWarningOnScreenAlertEnabled; text: i18n("Show on-screen alert") }
        QQC2.CheckBox { id: notifyStatus; text: i18n("When the provider service status changes") }
        QQC2.CheckBox { id: respectReducedMotion; text: i18n("Respect reduced motion") }
        QQC2.ComboBox {
            Kirigami.FormData.label: i18n("Confetti on reset:")
            model: [i18n("Off"), i18n("Session resets"), i18n("Weekly resets"), i18n("Both")]
            currentIndex: Math.max(0, ["off", "session", "weekly", "both"].indexOf(page.cfg_confettiMode))
            onActivated: page.cfg_confettiMode = ["off", "session", "weekly", "both"][currentIndex]
        }
        QQC2.Button {
            text: i18n("Test confetti")
            onClicked: page.cfg_testConfettiSerial++
        }
        QQC2.Button {
            text: i18n("Send test notification")
            onClicked: page.cfg_testNotificationSerial++
        }
        QQC2.Label {
            text: i18n("Apply settings to send the test requests. Thresholds are percentages remaining, separated by commas. Estimates appear after at least three observed session burns.")
            wrapMode: Text.WordWrap
            Layout.maximumWidth: Kirigami.Units.gridUnit * 26
        }
    }
}
