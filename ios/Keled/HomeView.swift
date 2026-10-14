import SwiftUI
import WidgetKit

/// Every card on the hub, grouped by app, drawn with the medium widget layout.
/// Tapping a card opens its web app inside Keled. Pull to refresh also reloads every widget.
struct HomeView: View {
    @State private var cards: [Card] = []
    @State private var live = true
    @State private var loadedAt: Date?
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var phase
    @EnvironmentObject private var router: WebRouter

    private struct AppGroup: Identifiable {
        let app: String
        let cards: [Card]
        var id: String { app }
    }

    private var groups: [AppGroup] {
        var order: [String] = []
        var byApp: [String: [Card]] = [:]
        for card in cards {
            let app = card.app ?? "Other"
            if byApp[app] == nil { order.append(app) }
            byApp[app, default: []].append(card)
        }
        return order.map { AppGroup(app: $0, cards: byApp[$0] ?? []) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    StatusLine(live: live, count: cards.count, loadedAt: loadedAt)
                    ForEach(groups) { group in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(group.app.uppercased())
                                .font(.system(size: 12, weight: .semibold))
                                .tracking(0.6)
                                .foregroundStyle(.secondary)
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 330), spacing: 14)], spacing: 14) {
                                ForEach(group.cards) { card in
                                    Button {
                                        if let link = card.openURL { router.handle(link, system: openURL) }
                                    } label: {
                                        WidgetFrame(height: 170, card: card) {
                                            CardView(card: card, family: .systemMedium, live: live)
                                        }
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    if cards.isEmpty { EmptyHub() }
                    AddWidgetHint()
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .refreshable { await load(reloadWidgets: true) }
            .navigationTitle("Keled")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    KeledK7Shape().fill(Color.primary).frame(width: 15, height: 20)
                }
            }
        }
        .task { await load(reloadWidgets: true) }
        .onReceive(NotificationCenter.default.publisher(for: .keledCardsChanged)) { _ in
            Task { await load(reloadWidgets: false) }
        }
        .onChange(of: phase) { _, now in
            if now == .active { Task { await load(reloadWidgets: true) } }
        }
    }

    private func load(reloadWidgets: Bool) async {
        let result = await HubClient.cardsOrCache()
        cards = result.cards
        live = result.live
        loadedAt = Date()
        if reloadWidgets { WidgetCenter.shared.reloadAllTimelines() }
    }
}

/// A widget-sized tile: the card's own background (system background when unthemed),
/// continuous corners, fixed height.
struct WidgetFrame<Content: View>: View {
    var width: CGFloat? = nil
    var height: CGFloat
    var card: Card? = nil
    var radius: CGFloat = 22
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil)
            .background(Themed(card: card) { palette in CardBackground(palette: palette) })
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

struct StatusLine: View {
    let live: Bool
    let count: Int
    let loadedAt: Date?

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(live ? KeledPalette.ok : KeledPalette.bad).frame(width: 7, height: 7)
            Text(live ? "Hub live" : "Hub unreachable, showing the last copy")
                .font(.system(size: 13, weight: .medium))
            Spacer()
            Text("\(count) cards").font(.system(size: 13)).foregroundStyle(.secondary)
            if let loadedAt {
                Text(loadedAt, style: .time).font(.system(size: 13)).foregroundStyle(.secondary)
            }
        }
        .padding(.top, 4)
    }
}

struct EmptyHub: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("No cards yet").font(.system(size: 17, weight: .semibold))
            Text("The hub runs on the PC. Your phone needs Tailscale on to reach it.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
        }
    }
}

struct AddWidgetHint: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ADD A WIDGET")
                .font(.system(size: 12, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(.secondary)
            Text("Home screen: hold an empty spot, tap Edit, Add Widget, Keled. Lock screen: hold the lock screen, Customize, tap the widget row. Then hold the widget and pick a card.")
                .font(.system(size: 14))
                .foregroundStyle(.secondary)
        }
    }
}
