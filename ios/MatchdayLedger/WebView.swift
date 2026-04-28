import SwiftUI
import WebKit

@MainActor
final class WebViewModel: NSObject, ObservableObject {
  @Published var title: String = AppConfiguration.appName
  @Published var isLoading = true
  @Published var canGoBack = false
  @Published var canGoForward = false
  @Published var currentURL: URL?

  fileprivate weak var webView: WKWebView?

  func attach(_ webView: WKWebView) {
    self.webView = webView
    loadInitialPage()
  }

  func loadInitialPage() {
    guard let webView else { return }
    let url = AppConfiguration.launchURL()

    if url.isFileURL {
      webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    } else {
      webView.load(URLRequest(url: url))
    }
  }

  func reload() {
    webView?.reload()
  }

  func goBack() {
    webView?.goBack()
  }

  func goForward() {
    webView?.goForward()
  }

  func openCurrentPage(externalOpen: @escaping (URL) -> Void) {
    if let url = currentURL, ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
      externalOpen(url)
    } else {
      externalOpen(AppConfiguration.defaultRemoteURL)
    }
  }

  fileprivate func syncState(from webView: WKWebView) {
    isLoading = webView.isLoading
    canGoBack = webView.canGoBack
    canGoForward = webView.canGoForward
    currentURL = webView.url
    title = webView.title ?? AppConfiguration.appName
  }
}

struct WebView: UIViewRepresentable {
  @ObservedObject var model: WebViewModel
  let openExternalURL: (URL) -> Void

  func makeCoordinator() -> Coordinator {
    Coordinator(model: model, openExternalURL: openExternalURL)
  }

  func makeUIView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.allowsBackForwardNavigationGestures = true
    webView.navigationDelegate = context.coordinator
    context.coordinator.attach(webView)
    return webView
  }

  func updateUIView(_ webView: WKWebView, context: Context) {
    context.coordinator.openExternalURL = openExternalURL
  }

  @MainActor
  final class Coordinator: NSObject {
    var model: WebViewModel
    var openExternalURL: (URL) -> Void

    init(model: WebViewModel, openExternalURL: @escaping (URL) -> Void) {
      self.model = model
      self.openExternalURL = openExternalURL
    }

    func attach(_ webView: WKWebView) {
      model.attach(webView)
    }
  }
}

extension WebView.Coordinator: WKNavigationDelegate {
  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    model.isLoading = true
    model.syncState(from: webView)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    model.isLoading = false
    model.syncState(from: webView)
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    model.isLoading = false
    model.syncState(from: webView)
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    model.isLoading = false
    model.syncState(from: webView)
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.allow)
      return
    }

    if shouldOpenExternally(url, isTargetBlank: navigationAction.targetFrame == nil) {
      openExternalURL(url)
      decisionHandler(.cancel)
      return
    }

    decisionHandler(.allow)
  }

  private func shouldOpenExternally(_ url: URL, isTargetBlank: Bool) -> Bool {
    let scheme = url.scheme?.lowercased() ?? ""

    if scheme == "file" || scheme == "about" || scheme == "data" {
      return false
    }

    guard scheme == "http" || scheme == "https" else {
      return true
    }

    guard let host = url.host?.lowercased() else {
      return true
    }

    let allowedHosts = [
      "samwarb.github.io",
      "localhost",
      "127.0.0.1"
    ]

    if allowedHosts.contains(where: { host == $0 || host.hasSuffix(".\($0)") }) {
      return false
    }

    return isTargetBlank || !allowedHosts.contains(host)
  }
}
