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
    @StateObject private var router = WebRouter()

    var body: some View {
        Group {
            // CI launches with -KeledScreen <name> -KeledDemo YES to screenshot one view per run.
            if let screen = UserDefaults.standard.string(forKey: "KeledScreen") {
                ScreenshotView(screen: screen)
            } else {
                HomeView()
            }
        }
        .environmentObject(router)
        .fullScreenCover(item: $router.target) { target in
            WebHostView(target: target)
        }
        .onOpenURL { url in router.handle(url, system: openURL) }
    }
}
