import SwiftUI
import WidgetKit

/// CI-only screens: each one lays the sample cards out at real widget point sizes
/// (iPhone 15/16 Pro class) on a wallpaper-grey page, so one simulator screenshot shows
/// how every size renders. Writes Documents/keled-screen-<name>.ok once drawn.
struct ScreenshotView: View {
    let screen: String
    private let cards = Card.samples
    private let wallpaper = Color(red: 0.35, green: 0.37, blue: 0.42)

    var body: some View {
        Group {
            switch screen {
            case "small": small
            case "medium": medium
            case "large": large
            case "lock": lock
            case "board": board
            case "themed": themed
            case "themed2": themed2
            case "preview-small": previewSmall
            case "preview-medium": previewMedium
            case "preview-large": previewLarge
            case "designs": DesignShotsView()
            default: HomeView()
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { markRendered() }
        }
    }

    private var small: some View {
        page {
            LazyVGrid(columns: [GridItem(.fixed(170), spacing: 18), GridItem(.fixed(170), spacing: 18)], spacing: 18) {
                ForEach(cards.prefix(6)) { card in
                    WidgetFrame(width: 170, height: 170) { CardView(card: card, family: .systemSmall) }
                }
            }
        }
    }

    private var medium: some View {
        page {
            ForEach(cards.prefix(4)) { card in
                WidgetFrame(width: 364, height: 170) { CardView(card: card, family: .systemMedium) }
            }
        }
    }

    private var large: some View {
        page {
            WidgetFrame(width: 364, height: 382) { CardView(card: cards[0], family: .systemLarge) }
            WidgetFrame(width: 364, height: 382) { CardView(card: cards[2], family: .systemLarge) }
        }
    }

    private var lock: some View {
        page(background: .black) {
            Text("9:41")
                .font(.system(size: 84, weight: .semibold, design: .rounded))
                .foregroundStyle(.white.opacity(0.9))
            HStack(spacing: 10) {
                ForEach(cards.filter { $0.id == "mail" || $0.id == "build" || $0.id == "office-asks" }) { card in
                    CardView(card: card, family: .accessoryCircular).frame(width: 76, height: 76)
                }
            }
            ForEach(cards.prefix(3)) { card in
                CardView(card: card, family: .accessoryRectangular).frame(width: 172, height: 76)
            }
            ForEach(cards.prefix(2)) { card in
                CardView(card: card, family: .accessoryInline)
            }
        }
        .foregroundStyle(.white)
        .environment(\.colorScheme, .dark)
    }

    private var board: some View {
        page {
            WidgetFrame(width: 364, height: 170, padding: 12) { BoardView(cards: cards, family: .systemMedium, live: true) }
            WidgetFrame(width: 364, height: 382, padding: 14) { BoardView(cards: cards, family: .systemLarge, live: false) }
        }
    }

    // Theme, free layout and actions, from the samples, on every build.
    private var designed: [Card] { ["habits", "taxes", "alarm"].compactMap { id in cards.first { $0.id == id } } }

    private var themed: some View {
        page {
            LazyVGrid(columns: [GridItem(.fixed(170), spacing: 18), GridItem(.fixed(170), spacing: 18)], spacing: 18) {
                ForEach(designed) { card in
                    WidgetFrame(width: 170, height: 170, card: card) { CardView(card: card, family: .systemSmall) }
                }
            }
            ForEach(designed.prefix(2)) { card in
                WidgetFrame(width: 364, height: 170, card: card) { CardView(card: card, family: .systemMedium) }
            }
        }
    }

    private var themed2: some View {
        page {
            ForEach(designed.suffix(1)) { card in
                WidgetFrame(width: 364, height: 170, card: card) { CardView(card: card, family: .systemMedium) }
            }
            ForEach(designed.prefix(1)) { card in
                WidgetFrame(width: 364, height: 382, card: card) { CardView(card: card, family: .systemLarge) }
            }
        }
    }

    // A session's own cards, dropped in by `widget.mjs preview` through CI, so it can look at a
    // design before it reaches the phone. Documents/preview-cards.json, same shape as GET /v1/cards.
    private var preview: [Card] {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        guard let data = try? Data(contentsOf: dir.appendingPathComponent("preview-cards.json")) else { return [] }
        if let r = try? JSONDecoder().decode(CardsResponse.self, from: data), !r.cards.isEmpty { return r.cards }
        return (try? JSONDecoder().decode([Card].self, from: data)) ?? []
    }

    private var previewSmall: some View {
        page {
            LazyVGrid(columns: [GridItem(.fixed(170), spacing: 18), GridItem(.fixed(170), spacing: 18)], spacing: 18) {
                ForEach(preview.prefix(6)) { card in
                    WidgetFrame(width: 170, height: 170, card: card) { CardView(card: card, family: .systemSmall) }
                }
            }
        }
    }

    private var previewMedium: some View {
        page {
            ForEach(preview.prefix(4)) { card in
                WidgetFrame(width: 364, height: 170, card: card) { CardView(card: card, family: .systemMedium) }
            }
        }
    }

    private var previewLarge: some View {
        page {
            ForEach(preview.prefix(1)) { card in
                WidgetFrame(width: 364, height: 382, card: card) { CardView(card: card, family: .systemLarge) }
                HStack(spacing: 14) {
                    CardView(card: card, family: .accessoryCircular).frame(width: 76, height: 76)
                    CardView(card: card, family: .accessoryRectangular).frame(width: 172, height: 76)
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.black))
                .foregroundStyle(.white)
                .environment(\.colorScheme, .dark)
            }
        }
    }

    private func page<Content: View>(background: Color? = nil, @ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            VStack(spacing: 18) { content() }
                .padding(.top, 70)
                .frame(maxWidth: .infinity)
        }
        .background(background ?? wallpaper)
        .ignoresSafeArea()
    }

    private func markRendered() {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? Data().write(to: dir.appendingPathComponent("keled-screen-\(screen).ok"))
    }
}
