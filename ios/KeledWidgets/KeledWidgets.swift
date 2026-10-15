import WidgetKit
import SwiftUI
import AppIntents

// Two widgets cover everything. Adding a new card never needs a new build:
// a session writes it to the hub, and it shows up in "Choose a card".

@main
struct KeledWidgetBundle: WidgetBundle {
    var body: some Widget {
        KeledCardWidget()
        KeledBoardWidget()
    }
}

// MARK: Entities the widget editor lists

struct CardEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Keled card"
    static var defaultQuery = CardQuery()

    var id: String
    var title: String
    var app: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: "\(app)")
    }

    init(id: String, title: String, app: String) {
        self.id = id
        self.title = title
        self.app = app
    }

    init(card: Card) {
        self.init(id: card.id, title: card.title, app: card.app ?? "Keled")
    }
}

struct CardQuery: EntityQuery {
    func entities(for identifiers: [CardEntity.ID]) async throws -> [CardEntity] {
        let cards = await HubClient.cardsOrCache().cards
        return identifiers.map { id in
            if let card = cards.first(where: { $0.id == id }) { return CardEntity(card: card) }
            return CardEntity(id: id, title: id, app: "Keled")
        }
    }

    func suggestedEntities() async throws -> [CardEntity] {
        await HubClient.cardsOrCache().cards.map { CardEntity(card: $0) }
    }

    func defaultResult() async -> CardEntity? {
        await HubClient.cardsOrCache().cards.first.map { CardEntity(card: $0) }
    }
}

struct AppGroupEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Keled app"
    static var defaultQuery = AppGroupQuery()

    var id: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(id)")
    }
}

struct AppGroupQuery: EntityQuery {
    func entities(for identifiers: [AppGroupEntity.ID]) async throws -> [AppGroupEntity] {
        identifiers.map { AppGroupEntity(id: $0) }
    }

    func suggestedEntities() async throws -> [AppGroupEntity] {
        var seen = Set<String>()
        return await HubClient.cardsOrCache().cards
            .compactMap { $0.app }
            .filter { seen.insert($0).inserted }
            .map { AppGroupEntity(id: $0) }
    }
}

// MARK: Intents

struct SelectCardIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choose a card"
    static var description = IntentDescription("Pick which Keled card this widget shows.")

    @Parameter(title: "Card")
    var card: CardEntity?
}

struct BoardIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Board"
    static var description = IntentDescription("Several Keled cards at once. Pick one app, or leave it empty for all.")

    @Parameter(title: "Only from")
    var app: AppGroupEntity?
}

// MARK: Timeline

struct CardEntry: TimelineEntry {
    var date: Date
    let card: Card?
    let cards: [Card]
    let live: Bool
    var title = "Keled"
}

// iOS hands each widget its own budget of roughly 40-70 reloads a day and will not reload one
// sooner than about 5 minutes. Each card says how fast it changes (card.refresh, set on the hub);
// a widget asks again at the pace of its fastest card, 15 minutes when none says.
// Opening the app or tapping a widget button reloads them right away, outside the budget.
private func refreshEvery(_ cards: [Card]) -> TimeInterval {
    let asked = cards.compactMap(\.refresh).min() ?? 15 * 60
    return min(86400, max(5 * 60, asked))
}

/// The same data redrawn at each moment a card changes on its own (a "Tap again" falling back,
/// a done/failed note ending), so the widget never waits 15 minutes to clear it.
private func withTransitions(_ entry: CardEntry, until end: Date) -> [CardEntry] {
    let cards = entry.card.map { [$0] } ?? entry.cards
    let moments = Set(cards.flatMap { $0.transitions }).filter { $0 > entry.date && $0 < end }.sorted()
    return [entry] + moments.map { d in
        var next = entry
        next.date = d.addingTimeInterval(1)
        return next
    }
}

struct CardProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> CardEntry {
        CardEntry(date: .now, card: Card.samples.first, cards: Card.samples, live: true)
    }

    func snapshot(for configuration: SelectCardIntent, in context: Context) async -> CardEntry {
        if context.isPreview {
            let pick = Card.samples.first { $0.id == configuration.card?.id } ?? Card.samples.first
            return CardEntry(date: .now, card: pick, cards: Card.samples, live: true)
        }
        return await entry(for: configuration)
    }

    func timeline(for configuration: SelectCardIntent, in context: Context) async -> Timeline<CardEntry> {
        let entry = await entry(for: configuration)
        let refresh = Date().addingTimeInterval(refreshEvery(entry.card.map { [$0] } ?? []))
        return Timeline(entries: withTransitions(entry, until: refresh), policy: .after(refresh))
    }

    private func entry(for configuration: SelectCardIntent) async -> CardEntry {
        let result = await HubClient.cardsOrCache(source: "widget:\(configuration.card?.id ?? "first")")
        let wanted = configuration.card?.id
        let card = result.cards.first { $0.id == wanted } ?? (wanted == nil ? result.cards.first : nil)
        return CardEntry(date: .now, card: card, cards: result.cards, live: result.live)
    }
}

struct BoardProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> CardEntry {
        CardEntry(date: .now, card: nil, cards: Card.samples, live: true)
    }

    func snapshot(for configuration: BoardIntent, in context: Context) async -> CardEntry {
        if context.isPreview { return placeholder(in: context) }
        return await entry(for: configuration)
    }

    func timeline(for configuration: BoardIntent, in context: Context) async -> Timeline<CardEntry> {
        let entry = await entry(for: configuration)
        let refresh = Date().addingTimeInterval(refreshEvery(entry.cards))
        return Timeline(entries: withTransitions(entry, until: refresh), policy: .after(refresh))
    }

    private func entry(for configuration: BoardIntent) async -> CardEntry {
        let result = await HubClient.cardsOrCache(source: "board:\(configuration.app?.id ?? "all")")
        let app = configuration.app?.id
        let cards = app == nil ? result.cards : result.cards.filter { $0.app == app }
        return CardEntry(date: .now, card: nil, cards: cards, live: result.live, title: app ?? "Keled")
    }
}

// MARK: Widgets

struct KeledCardWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "KeledCard", intent: SelectCardIntent.self, provider: CardProvider()) { entry in
            CardWidgetView(entry: entry)
        }
        .configurationDisplayName("Keled card")
        .description("One card from any Keled app. Lock screen or home screen.")
        .supportedFamilies([
            .systemSmall, .systemMedium, .systemLarge, .systemExtraLarge,
            .accessoryCircular, .accessoryRectangular, .accessoryInline,
        ])
    }
}

struct CardWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CardEntry

    var body: some View {
        Group {
            if let card = entry.card {
                CardView(card: card, family: family, live: entry.live, now: entry.date)
                    .widgetURL(card.openURL)
            } else {
                EmptyCardView(family: family)
            }
        }
        .containerBackground(for: .widget) {
            Themed(card: entry.card) { palette in CardBackground(palette: palette) }
        }
    }
}

struct KeledBoardWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "KeledBoard", intent: BoardIntent.self, provider: BoardProvider()) { entry in
            BoardWidgetView(entry: entry)
        }
        .configurationDisplayName("Keled board")
        .description("Several cards in one widget. Made for the iPad.")
        .supportedFamilies([.systemMedium, .systemLarge, .systemExtraLarge])
    }
}

struct BoardWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CardEntry

    var body: some View {
        BoardView(cards: entry.cards, family: family, live: entry.live, title: entry.title)
            .containerBackground(for: .widget) {
                Color(uiColor: .systemBackground)
            }
    }
}
