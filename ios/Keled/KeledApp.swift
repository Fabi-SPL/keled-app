import SwiftUI
import WidgetKit

@main
struct KeledApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        Group {
            // CI launches with -KeledScreen <name> -KeledDemo YES to screenshot one view per run.
            if let screen = UserDefaults.standard.string(forKey: "KeledScreen") {
                ScreenshotView(screen: screen)
            } else {
                HomeView()
            }
        }
        .onOpenURL { url in
            if let target = KeledLinks.target(of: url) { openURL(target) }
        }
    }
}
