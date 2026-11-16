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
  private var displayStartedAt: TimeInterval?
  private var started = false
  private var finished = false
  private var timer: Timer?
  private var overlay: UIWindow?
  private var controller: CrewStartupViewController?
  private var events: [String] = []
  private var states: [String: String] = [:]
  private var previousReport: String?
  private var testingNoJavaScript = false
  private var testDiagnosticShown = false
  private let steps = ["entry", "router", "root", "fonts", "storage", "session", "layout", "curtain", "crash"]
  private let values: Set<String> = ["waiting", "ready", "fallback", "failed"]

  func begin() {
    guard !started else { return }
    started = true
    if !defaults.bool(forKey: "CrewStartupComplete") {
      previousReport = defaults.string(forKey: "CrewStartupLastReport").map { String($0.prefix(8000)) }
      if let previousReport { defaults.set(previousReport, forKey: "CrewStartupPreviousIncomplete") }
    } else {
      previousReport = defaults.string(forKey: "CrewStartupPreviousIncomplete").map { String($0.prefix(8000)) }
    }
    defaults.removeObject(forKey: "CrewStartupState")
    defaults.set(false, forKey: "CrewStartupComplete")
    record("SC01 native-app")
    let timer = Timer(timeInterval: 0.5, target: self, selector: #selector(tick), userInfo: nil, repeats: true)
    self.timer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  func connect(_ scene: UIWindowScene) {
    guard !finished, overlay == nil else { return }
    record("SC02 native-scene")
    displayStartedAt = ProcessInfo.processInfo.systemUptime
    let controller = CrewStartupViewController()
    self.controller = controller
    let overlay = UIWindow(windowScene: scene)
    overlay.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.normal.rawValue + 1)
    overlay.rootViewController = controller
    // The application's React window remains the key window. This one only covers startup.
    overlay.isHidden = false
    self.overlay = overlay
    updateView()
  }

  func startingReact() { record("SC03 react-requested") }

  func testingWithoutJavaScript() { testingNoJavaScript = true }

  @objc private func tick() {
    guard !finished else { return }
    // Also works if UIKit connected a scene but did not call our scene delegate.
    if overlay == nil,
       let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.activationState == .foregroundActive }) {
      connect(scene)
    }
    if let raw = defaults.string(forKey: "CrewStartupState"),
       let bytes = raw.data(using: .utf8), bytes.count < 2048,
       let snapshot = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: String] {
      for (index, step) in steps.enumerated() {
        guard let value = snapshot[step], values.contains(value), states[step] != value else { continue }
        states[step] = value
        record(String(format: "SC%02d %@=%@", index + 4, step, value))
      }
    }
    // The crash boundary already provides its own recovery buttons. Never cover that screen.
    if states["crash"] == "failed" { finish(success: false); return }
    if states["layout"] == "ready" && states["curtain"] == "ready" {
      record("SC13 interface-visible")
      finish(success: true)
      return
    }
    updateView()
  }

  private func record(_ event: String) {
    guard events.count < 40 else { return }
    let ms = Int((ProcessInfo.processInfo.systemUptime - startedAt) * 1000)
    events.append("+\(ms)ms \(event)")
    defaults.set(report(), forKey: "CrewStartupLastReport")
    logger.notice("SC_STARTUP \(event, privacy: .public)")
  }

  private func finish(success: Bool) {
    if success && ProcessInfo.processInfo.arguments.contains("-crewStartupTestRecovery") { record("SC_TEST_RECOVERED") }
    finished = true
    defaults.set(success, forKey: "CrewStartupComplete")
    defaults.set(report(), forKey: "CrewStartupLastReport")
    timer?.invalidate()
    timer = nil
    overlay?.isHidden = true
    overlay = nil
    controller = nil
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

  private func updateView() {
    let elapsed = Int(ProcessInfo.processInfo.systemUptime - (displayStartedAt ?? startedAt))
    let slow = elapsed >= 8 || states.values.contains("failed")
    let waiting = [
      ("entry", "JavaScript", "JavaScript"),
      ("root", "Interface React", "React interface"),
      ("fonts", "Polices", "Fonts"),
      ("storage", "Données locales", "Local data"),
      ("session", "Trousseau et compte", "Keychain and account"),
      ("layout", "Premier écran", "First screen"),
      ("curtain", "Écran de lancement masqué", "Launch curtain hidden"),
    ].map { step, fr, en in
      let status: String
      switch states[step] {
      case "ready": status = "OK"
      case "fallback": status = text("secours", "fallback")
      case "failed": status = text("échec", "failed")
      default: status = text("en attente", "waiting")
      }
      return "\(text(fr, en)) : \(status)"
    }.joined(separator: "\n")
    controller?.render(elapsed: elapsed, slow: slow, steps: waiting, report: report())
    if slow && testingNoJavaScript && !testDiagnosticShown && controller?.diagnosticIsVisible == true {
      testDiagnosticShown = true
      record("SC_TEST_NO_JS_DIAGNOSTIC_VISIBLE")
    }
  }

  func copyReport() {
    var copy = report()
    if let previousReport { copy += "\n\nPrevious incomplete launch:\n" + previousReport }
    UIPasteboard.general.string = copy
  }

  func text(_ fr: String, _ en: String) -> String {
    Locale.preferredLanguages.first?.hasPrefix("fr") == true ? fr : en
  }
}

@MainActor
private final class CrewStartupViewController: UIViewController {
  private let titleLabel = UILabel()
  private let timeLabel = UILabel()
  private let stepsLabel = UILabel()
  private let helpLabel = UILabel()
  private let detailsLabel = UILabel()
  private let copyButton = UIButton(type: .system)
  private var announced = false
  var diagnosticIsVisible: Bool { isViewLoaded && view.window != nil && !copyButton.isHidden && !detailsLabel.isHidden }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor(red: 30/255, green: 38/255, blue: 36/255, alpha: 1)
    let scroll = UIScrollView()
    scroll.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(scroll)
    let width = scroll.widthAnchor.constraint(equalTo: view.widthAnchor, constant: -48)
    width.priority = .defaultHigh
    NSLayoutConstraint.activate([
      scroll.centerXAnchor.constraint(equalTo: view.centerXAnchor), width,
      scroll.widthAnchor.constraint(lessThanOrEqualToConstant: 600),
      scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
      scroll.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
    ])
    let stack = UIStackView()
    stack.axis = .vertical
    stack.spacing = 16
    stack.translatesAutoresizingMaskIntoConstraints = false
    scroll.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
      stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
      stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor),
    ])
    let image = UIImageView(image: UIImage(named: "SplashScreenLogo"))
    image.contentMode = .scaleAspectFit
    image.heightAnchor.constraint(equalToConstant: 80).isActive = true
    image.isAccessibilityElement = false
    stack.addArrangedSubview(image)
    for (label, style) in [(titleLabel, UIFont.TextStyle.title2), (timeLabel, .subheadline), (stepsLabel, .body), (helpLabel, .body), (detailsLabel, .footnote)] {
      label.numberOfLines = 0
      label.font = .preferredFont(forTextStyle: style)
      label.adjustsFontForContentSizeCategory = true
      label.textColor = .white
      stack.addArrangedSubview(label)
    }
    titleLabel.accessibilityTraits = .header
    detailsLabel.textColor = UIColor(white: 0.8, alpha: 1)
    var configuration = UIButton.Configuration.filled()
    configuration.baseBackgroundColor = UIColor(red: 244/255, green: 179/255, blue: 61/255, alpha: 1)
    configuration.baseForegroundColor = UIColor(red: 30/255, green: 38/255, blue: 36/255, alpha: 1)
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)
    copyButton.configuration = configuration
    copyButton.titleLabel?.adjustsFontForContentSizeCategory = true
    copyButton.addTarget(self, action: #selector(copyDiagnostic), for: .touchUpInside)
    stack.insertArrangedSubview(copyButton, at: stack.arrangedSubviews.count - 1)
  }

  func render(elapsed: Int, slow: Bool, steps: String, report: String) {
    loadViewIfNeeded()
    let monitor = CrewStartupDiagnostics.shared
    titleLabel.text = monitor.text(slow ? "Le démarrage prend du temps." : "Ouverture de Soirée Crew…", slow ? "Startup is taking longer." : "Opening Soirée Crew…")
    timeLabel.text = "\(elapsed) s"
    stepsLabel.text = steps
    helpLabel.text = monitor.text("Copie le diagnostic pour identifier l’étape bloquée. Tu peux fermer puis rouvrir l’app. Ce diagnostic n’efface pas tes données et ne demande aucune connexion au serveur.", "Copy the diagnostic to identify the stalled step. You can close and reopen the app. This diagnostic does not erase your data or need a server connection.")
    helpLabel.isHidden = !slow
    copyButton.isHidden = !slow
    detailsLabel.isHidden = !slow
    detailsLabel.text = report
    if !announced {
      copyButton.setTitle(monitor.text("Copier le diagnostic", "Copy diagnostic"), for: .normal)
    }
    if slow && !announced {
      UIAccessibility.post(notification: .announcement, argument: titleLabel.text)
      announced = true
    }
  }

  @objc private func copyDiagnostic() {
    let monitor = CrewStartupDiagnostics.shared
    monitor.copyReport()
    copyButton.setTitle(monitor.text("Diagnostic copié", "Diagnostic copied"), for: .normal)
    UIAccessibility.post(notification: .announcement, argument: copyButton.title(for: .normal))
  }
}
