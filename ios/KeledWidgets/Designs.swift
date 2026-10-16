import WidgetKit
import SwiftUI
import AppIntents

// The gallery widgets (Gallery.swift, generated): one entry per app in the add-widget list,
// every design of that app a style in its edit menu. A design is data, so a new style on the
// hub shows up in the menu without a build; a new group needs one.

protocol GalleryStyleIntent: WidgetConfigurationIntent {
    static var group: String { get }
    var style: String? { get }
}

struct DesignEntry: TimelineEntry {
    var date: Date
    let design: Design?
    let cards: [Card]
    let live: Bool
}

struct DesignProvider<I: GalleryStyleIntent>: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> DesignEntry {
        DesignEntry(date: .now, design: DesignCatalog.resolve(group: I.group, style: nil, family: context.family), cards: Card.previews, live: true)
    }

    func snapshot(for configuration: I, in context: Context) async -> DesignEntry {
        if context.isPreview {
            return DesignEntry(date: .now, design: DesignCatalog.resolve(group: I.group, style: configuration.style, family: context.family),
                               cards: Card.previews, live: true)
        }
        return await entry(for: configuration, family: context.family)
    }

    func timeline(for configuration: I, in context: Context) async -> Timeline<DesignEntry> {
        let entry = await entry(for: configuration, family: context.family)
        let refresh = Date().addingTimeInterval(refreshEvery(entry.design?.pick(entry.cards) ?? []))
        return Timeline(entries: [entry], policy: .after(refresh))
    }

    private func entry(for configuration: I, family: WidgetFamily) async -> DesignEntry {
        let result = await HubClient.cardsOrCache(source: "design:\(I.group)")
        let cards = KeledConfig.demo ? Card.previews : result.cards
        let design = DesignCatalog.resolve(group: I.group, style: configuration.style, family: family)
        if let design { await AssetStore.prefetch(design.assetNames) }
        return DesignEntry(date: .now, design: design, cards: cards, live: result.live)
    }
}

enum Gallery {
    static func configuration<I: GalleryStyleIntent>(kind: String, intent: I.Type, name: String, description: String,
                                                     families: [WidgetFamily]) -> some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: I.self, provider: DesignProvider<I>()) { entry in
            DesignWidgetView(entry: entry)
        }
        .configurationDisplayName(Text(verbatim: name))
        .description(Text(verbatim: description))
        .supportedFamilies(families)
        .contentMarginsDisabled()
    }
}

struct DesignWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DesignEntry

    private var primary: Card? { entry.design?.pick(entry.cards).first }

    var body: some View {
        Group {
            if let design = entry.design {
                DesignView(design: design, cards: entry.cards, live: entry.live, now: entry.date)
                    .widgetURL(primary?.openURL)
            } else {
                EmptyCardView(family: family)
            }
        }
        .containerBackground(for: .widget) {
            if entry.design?.isAccessory ?? false {
                Color.clear
            } else {
                Themed(theme: entry.design?.theme ?? primary?.theme) { palette in CardBackground(palette: palette) }
            }
        }
    }
}
