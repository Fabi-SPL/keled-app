import SwiftUI
import UIKit
import WebKit

// iOS gives a widget no way to open an installed home-screen web app: every https link lands in
// Safari. So Keled hosts the web app itself, full screen, one kept-alive web view per site, so
// coming back from a widget resumes where it was instead of reloading.
// Logins live in Keled's own cookie jar (the home-screen PWA has a separate one): log in once here.

struct WebTarget: Identifiable, Equatable {
    let url: URL
    var title: String?
    var id: String { url.absoluteString }
}

@MainActor
final class WebRouter: ObservableObject {
    @Published var target: WebTarget?

    /// Takes a keled://open link. Web pages open inside Keled unless the card asked for Safari;
    /// anything that is not a web page (tel:, shortcuts:, another app) goes to the system.
    func handle(_ link: URL, system: OpenURLAction) {
        guard let url = KeledLinks.target(of: link) else { return }
        let web = url.scheme == "https" || url.scheme == "http"
        if !web || KeledLinks.wantsSafari(link) {
            system(url)
            return
        }
        target = WebTarget(url: url, title: KeledLinks.title(of: link))
    }
}

@MainActor
final class WebPool {
    static let shared = WebPool()

    private var views: [String: WKWebView] = [:]
    private var requested: [String: URL] = [:]
    private var order: [String] = []
    private let delegate = WebDelegate()
    private let keep = 4

    private func key(_ url: URL) -> String {
        "\(url.scheme ?? "")://\(url.host ?? "")\(url.port.map { ":\($0)" } ?? "")"
    }

    /// The live web view for this site. Reloads only when a different page was asked for than
    /// last time, so tapping the same widget twice keeps the app where it was.
    func view(for url: URL) -> WKWebView {
        let k = key(url)
        order.removeAll { $0 == k }
        order.append(k)
        if let web = views[k] {
            if requested[k] != url {
                requested[k] = url
                web.load(URLRequest(url: url))
            }
            return web
        }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let web = WKWebView(frame: .zero, configuration: config)
        web.allowsBackForwardNavigationGestures = true
        web.isInspectable = true
        web.uiDelegate = delegate
        web.navigationDelegate = delegate
        web.load(URLRequest(url: url))
        views[k] = web
        requested[k] = url
        while order.count > keep {
            let old = order.removeFirst()
            views[old] = nil
            requested[old] = nil
        }
        return web
    }

    func reload(_ url: URL) { views[key(url)]?.reload() }

    func current(_ url: URL) -> URL? { views[key(url)]?.url }
}

@MainActor
final class WebDelegate: NSObject, WKUIDelegate, WKNavigationDelegate {
    private func sameSite(_ a: URL?, _ b: URL?) -> Bool {
        guard let a, let b else { return false }
        return a.host == b.host && a.port == b.port
    }

    // target=_blank and window.open: same site stays here, anything else goes to Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            if sameSite(url, webView.url) { webView.load(navigationAction.request) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.allow) }
        let web = url.scheme == "https" || url.scheme == "http" || url.scheme == "about" || url.scheme == "blob" || url.scheme == "data"
        if !web {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        // A link he taps to another site leaves for Safari; redirects (logins) stay inside.
        if navigationAction.navigationType == .linkActivated, navigationAction.targetFrame?.isMainFrame == true,
           !sameSite(url, webView.url) {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        // His own apps on the tailnet (voice notes, Cura) get the mic without a second prompt.
        decisionHandler(origin.host.hasSuffix(".ts.net") ? .grant : .prompt)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, from: webView) { completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, from: webView) { completionHandler(false) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        present(alert, from: webView) { completionHandler(nil) }
    }

    /// Presents on top of whatever is showing; if nothing can present, answers the page anyway so
    /// its JavaScript never hangs waiting on a dialog nobody sees.
    private func present(_ alert: UIAlertController, from webView: WKWebView, otherwise: () -> Void) {
        var top = webView.window?.rootViewController
        while let next = top?.presentedViewController { top = next }
        guard let top else { return otherwise() }
        top.present(alert, animated: true)
    }
}

struct WebContainer: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> UIView {
        let host = UIView()
        attach(to: host)
        return host
    }

    func updateUIView(_ host: UIView, context: Context) { attach(to: host) }

    private func attach(to host: UIView) {
        let web = WebPool.shared.view(for: url)
        guard web.superview !== host else { return }
        host.subviews.forEach { $0.removeFromSuperview() }
        web.removeFromSuperview()
        web.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            web.topAnchor.constraint(equalTo: host.topAnchor),
            web.bottomAnchor.constraint(equalTo: host.bottomAnchor),
        ])
    }
}

/// The web app, full screen, with one thin bar: close, reload, open in Safari.
struct WebHostView: View {
    let target: WebTarget
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 18) {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.down").font(.system(size: 16, weight: .semibold))
                }
                .accessibilityLabel("Close")
                Text(target.title ?? target.url.host ?? "")
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                Spacer(minLength: 0)
                Button { WebPool.shared.reload(target.url) } label: {
                    Image(systemName: "arrow.clockwise").font(.system(size: 15, weight: .medium))
                }
                .accessibilityLabel("Reload")
                Button { openURL(WebPool.shared.current(target.url) ?? target.url) } label: {
                    Image(systemName: "safari").font(.system(size: 16, weight: .medium))
                }
                .accessibilityLabel("Open in Safari")
            }
            .padding(.horizontal, 18)
            .frame(height: 42)
            .tint(.primary)
            .background(Color(uiColor: .systemBackground))
            WebContainer(url: target.url)
                .ignoresSafeArea(edges: .bottom)
        }
        .background(Color(uiColor: .systemBackground))
    }
}
