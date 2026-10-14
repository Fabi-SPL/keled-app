import AppIntents
import SwiftUI
import WidgetKit

// One intent runs every widget button. Sessions add actions as data on the hub; the phone only
// ever sends { card, action, on }, so a new action never needs a new build.

struct HubActionIntent: AppIntent {
    static var title: LocalizedStringResource = "Run a Keled card action"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Card") var card: String
    @Parameter(title: "Action") var action: String
    @Parameter(title: "On", default: false) var on: Bool

    init() {}

    init(card: String, action: String, on: Bool) {
        self.card = card
        self.action = action
        self.on = on
    }

    func perform() async throws -> some IntentResult {
        try await HubClient.act(card: card, action: action, on: on)
        WidgetCenter.shared.reloadAllTimelines()
        await MainActor.run { NotificationCenter.default.post(name: .keledCardsChanged, object: nil) }
        return .result()
    }
}

/// Same intent for actions marked confirm: a locked phone asks for Face ID first, so nobody can
/// fire them from the lock screen of a phone lying on a table.
struct GuardedHubActionIntent: AppIntent {
    static var title: LocalizedStringResource = "Run a guarded Keled card action"
    static var isDiscoverable: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Parameter(title: "Card") var card: String
    @Parameter(title: "Action") var action: String
    @Parameter(title: "On", default: false) var on: Bool

    init() {}

    init(card: String, action: String, on: Bool) {
        self.card = card
        self.action = action
        self.on = on
    }

    func perform() async throws -> some IntentResult {
        try await HubClient.act(card: card, action: action, on: on)
        WidgetCenter.shared.reloadAllTimelines()
        await MainActor.run { NotificationCenter.default.post(name: .keledCardsChanged, object: nil) }
        return .result()
    }
}

/// Every widget button that runs a hub action. Guarded refs go through Face ID on a locked phone.
struct HubButton<Label: View>: View {
    let card: String
    let action: String
    let on: Bool
    let guarded: Bool
    @ViewBuilder let label: () -> Label

    var body: some View {
        if guarded {
            Button(intent: GuardedHubActionIntent(card: card, action: action, on: on), label: label).buttonStyle(.plain)
        } else {
            Button(intent: HubActionIntent(card: card, action: action, on: on), label: label).buttonStyle(.plain)
        }
    }
}
