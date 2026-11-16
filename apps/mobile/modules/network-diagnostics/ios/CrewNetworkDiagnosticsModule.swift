import ExpoModulesCore

public final class CrewNetworkDiagnosticsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CrewNetworkDiagnostics")
    AsyncFunction("probeAsync") { (baseURL: String, endpoint: String, promise: Promise) in
      CrewNetworkProbe.start(baseURL: baseURL, endpoint: endpoint) { result in promise.resolve(result) }
    }
  }
}
