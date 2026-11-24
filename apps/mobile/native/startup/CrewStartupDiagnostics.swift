// Compiled into AppDelegate by withStartupDiagnostics, before React or JavaScript is needed.
import UIKit
import Darwin
import OSLog

@MainActor
final class CrewStartupDiagnostics: NSObject {
  static let shared = CrewStartupDiagnostics()
  private let defaults = UserDefaults.standard
  private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "app.soireecrew.mobile", category: "Startup")
  private let startedAt = ProcessInfo.processInfo.systemUptime
  private var started = false
  private var finished = false
  private var timer: Timer?
  private var recordedSlowLaunch = false
  private var events: [String] = []
  private var states: [String: String] = [:]
  private let steps = ["entry", "router", "root", "fonts", "storage", "session", "layout", "curtain", "crash"]
  private let values: Set<String> = ["waiting", "ready", "fallback", "failed"]

  func begin() {
    guard !started else { return }
    started = true
    if !defaults.bool(forKey: "CrewStartupComplete"),
       let lastReport = defaults.string(forKey: "CrewStartupLastReport") {
      defaults.set(String(lastReport.prefix(8000)), forKey: "CrewStartupPreviousIncomplete")
    }
    defaults.removeObject(forKey: "CrewStartupState")
    defaults.set(false, forKey: "CrewStartupComplete")
    record("SC01 native-app")
    let timer = Timer(timeInterval: 0.5, target: self, selector: #selector(tick), userInfo: nil, repeats: true)
    self.timer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  func connect(_: UIWindowScene) { record("SC02 native-scene") }

  func startingReact() { record("SC03 react-requested") }

  func testingWithoutJavaScript() { record("SC_TEST_NO_JS") }

  @objc private func tick() {
    guard !finished else { return }
    if let raw = defaults.string(forKey: "CrewStartupState"),
       let bytes = raw.data(using: .utf8), bytes.count < 2048,
       let snapshot = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: String] {
      for (index, step) in steps.enumerated() {
        guard let value = snapshot[step], values.contains(value), states[step] != value else { continue }
        states[step] = value
        record(String(format: "SC%02d %@=%@", index + 4, step, value))
      }
    }
    if states["crash"] == "failed" { finish(success: false); return }
    if states["layout"] == "ready" && states["curtain"] == "ready" {
      record("SC13 interface-visible")
      finish(success: true)
      return
    }
    if !recordedSlowLaunch && ProcessInfo.processInfo.systemUptime - startedAt >= 8 {
      recordedSlowLaunch = true
      let pending = steps.dropLast().filter { states[$0] == nil || states[$0] == "waiting" }
      record("SC_STARTUP_SLOW pending=\(pending.joined(separator: ","))")
    }
  }

  private func record(_ event: String) {
    guard events.count < 40 else { return }
    let ms = Int((ProcessInfo.processInfo.systemUptime - startedAt) * 1000)
    let line = "+\(ms)ms \(event)"
    events.append(line)
    defaults.set(report(), forKey: "CrewStartupLastReport")
    logger.notice("SC_STARTUP \(line, privacy: .public)")
  }

  private func finish(success: Bool) {
    if success && ProcessInfo.processInfo.arguments.contains("-crewStartupTestRecovery") { record("SC_TEST_RECOVERED") }
    finished = true
    defaults.set(success, forKey: "CrewStartupComplete")
    defaults.set(report(), forKey: "CrewStartupLastReport")
    timer?.invalidate()
    timer = nil
  }

  private func report() -> String {
    var system = utsname()
    uname(&system)
    let hardware = withUnsafeBytes(of: &system.machine) { String(decoding: $0.prefix { $0 != 0 }, as: UTF8.self) }
    let info = Bundle.main.infoDictionary ?? [:]
    let version = info["CFBundleShortVersionString"] as? String ?? "?"
    let build = info["CFBundleVersion"] as? String ?? "?"
    let bundle = Bundle.main.bundleIdentifier ?? "?"
    let minimum = info["MinimumOSVersion"] as? String ?? "?"
    let scene = NSClassFromString("SceneDelegate") == nil ? "missing" : "registered"
    let head = "SC_STARTUP v1\nApp: \(version) (\(build))\nBundle: \(bundle)\nDevice: \(hardware)\nOS: \(UIDevice.current.systemVersion) / minimum \(minimum)\nSceneDelegate: \(scene)\n"
    return String((head + events.joined(separator: "\n")).prefix(8000))
  }
}
