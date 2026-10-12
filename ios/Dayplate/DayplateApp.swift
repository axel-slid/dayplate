import SwiftUI
import WebKit

@main
struct DayplateApp: App {
    var body: some Scene {
        WindowGroup {
            DayplateWebView()
                .ignoresSafeArea()
                .preferredColorScheme(.light)
        }
    }
}

struct DayplateWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let bridge = """
        window.dayplateStore = {
          load: function() { return JSON.parse(window.prompt('dayplate.store', JSON.stringify({action:'load'}))); },
          save: function(state, revision) { return JSON.parse(window.prompt('dayplate.store', JSON.stringify({action:'save',state:state,revision:revision}))); },
          onChange: function() {}
        };
        """
        configuration.userContentController.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.uiDelegate = context.coordinator
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 253/255, green: 250/255, blue: 242/255, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.keyboardDismissMode = .interactive
        if let root = Bundle.main.url(forResource: "src", withExtension: nil) {
            web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        }
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKUIDelegate, WKNavigationDelegate {
        private let journalURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("journal.json")

        private func readJournal() throws -> [String: Any] {
            let source: URL
            if FileManager.default.fileExists(atPath: journalURL.path) {
                source = journalURL
            } else if let seed = Bundle.main.url(forResource: "seed", withExtension: "json") {
                source = seed
            } else {
                return ["revision": 0]
            }
            let data = try Data(contentsOf: source)
            guard let journal = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  journal["revision"] is NSNumber, journal["state"] is [String: Any] else {
                throw CocoaError(.fileReadCorruptFile)
            }
            return journal
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
            guard prompt == "dayplate.store", frame.isMainFrame, frame.request.url?.isFileURL == true else {
                completionHandler(nil)
                return
            }
            var result: [String: Any]
            do {
                guard let text = defaultText?.data(using: .utf8),
                      let request = try JSONSerialization.jsonObject(with: text) as? [String: Any] else {
                    throw CocoaError(.fileReadCorruptFile)
                }
                let current = try readJournal()
                if request["action"] as? String == "load" {
                    result = current
                } else if request["action"] as? String == "save" {
                    let revision = current["revision"] as? Int ?? 0
                    guard request["revision"] as? Int == revision else {
                        result = current
                        result["ok"] = false
                        result["error"] = "Journal changed. Review the latest entries and retry."
                        completionHandler(Self.encode(result))
                        return
                    }
                    guard let state = request["state"] as? [String: Any],
                          state["entries"] is [Any], state["meals"] is [Any], state["foods"] is [Any] else {
                        throw CocoaError(.fileWriteInapplicableStringEncoding)
                    }
                    result = ["revision": revision + 1, "state": state]
                    let data = try JSONSerialization.data(withJSONObject: result)
                    if FileManager.default.fileExists(atPath: journalURL.path) {
                        let backup = journalURL.appendingPathExtension("backup")
                        try Data(contentsOf: journalURL).write(to: backup, options: .atomic)
                    }
                    try data.write(to: journalURL, options: [.atomic, .completeFileProtectionUnlessOpen])
                    result["ok"] = true
                } else {
                    throw CocoaError(.fileReadCorruptFile)
                }
            } catch {
                result = ["ok": false, "error": "Unable to save or read your journal: \(error.localizedDescription)"]
            }
            completionHandler(Self.encode(result))
        }

        private static func encode(_ value: [String: Any]) -> String {
            guard let data = try? JSONSerialization.data(withJSONObject: value), let text = String(data: data, encoding: .utf8) else {
                return "{\"ok\":false,\"error\":\"Unable to read journal\"}"
            }
            return text
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
        }
    }
}
