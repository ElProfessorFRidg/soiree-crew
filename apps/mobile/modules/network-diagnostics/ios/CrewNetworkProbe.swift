import Foundation
import OSLog

/** URLSession's serial delegate queue owns the mutable task state. No credentials are accepted. */
final class CrewNetworkProbe: NSObject, URLSessionDataDelegate, @unchecked Sendable {
  private let completion: ([String: Any]) -> Void
  private let endpoint: String
  private let started = ProcessInfo.processInfo.systemUptime
  private var session: URLSession?
  private var body = Data()
  private var response: HTTPURLResponse?
  private var tooLarge = false
  private var headersSufficient = false
  private var finished = false
  private var timings: [String: Int] = [:]
  private let limit = 64 * 1024

  private init(endpoint: String, completion: @escaping ([String: Any]) -> Void) {
    self.endpoint = endpoint
    self.completion = completion
  }

  static func errorCode(_ error: NSError) -> String {
    guard error.domain == NSURLErrorDomain else { return "SC_NET_04" }
    switch error.code {
    case NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed: return "SC_DNS_01"
    case NSURLErrorTimedOut: return "SC_TIMEOUT_01"
    case NSURLErrorNotConnectedToInternet: return "SC_NET_01"
    case NSURLErrorCannotConnectToHost: return "SC_NET_02"
    case NSURLErrorNetworkConnectionLost: return "SC_NET_03"
    case NSURLErrorDataNotAllowed: return "SC_NET_05"
    case NSURLErrorCancelled: return "SC_NET_06"
    case NSURLErrorAppTransportSecurityRequiresSecureConnection: return "SC_TLS_02"
    case NSURLErrorSecureConnectionFailed, NSURLErrorServerCertificateHasBadDate,
         NSURLErrorServerCertificateUntrusted, NSURLErrorServerCertificateHasUnknownRoot,
         NSURLErrorServerCertificateNotYetValid, NSURLErrorClientCertificateRejected,
         NSURLErrorClientCertificateRequired: return "SC_TLS_01"
    default: return "SC_NET_04"
    }
  }

  static func start(baseURL: String, endpoint: String, completion: @escaping ([String: Any]) -> Void) {
    guard ["/v1/health", "/v1/info", "/v1/ready"].contains(endpoint), baseURL.count <= 2048,
          var parts = URLComponents(string: baseURL), let host = parts.host?.lowercased(),
          parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
          parts.path.isEmpty || parts.path == "/" else {
      completion(["code": "SC_CFG_02", "httpStatus": 0, "native": true, "durationMs": 0, "contractValid": false]); return
    }
    let octets = host.split(separator: ".").compactMap { Int($0) }
    let pieces = host.split(separator: ".", omittingEmptySubsequences: false)
    let ipv4 = pieces.count == 4 && octets.count == 4 && pieces.allSatisfy { !$0.isEmpty && $0.allSatisfy { $0 >= "0" && $0 <= "9" } } && octets.allSatisfy { $0 >= 0 && $0 <= 255 }
    let local = host == "localhost" || host == "::1" || host == "[::1]" || host.hasSuffix(".local")
      || (ipv4 && (octets[0] == 10 || octets[0] == 127 || (octets[0] == 192 && octets[1] == 168) || (octets[0] == 172 && (16...31).contains(octets[1]))))
    guard parts.scheme == "https" || (parts.scheme == "http" && local) else {
      completion(["code": "SC_CFG_02", "httpStatus": 0, "native": true, "durationMs": 0, "contractValid": false]); return
    }
    parts.path = endpoint
    guard let url = parts.url else { completion(["code": "SC_CFG_02", "httpStatus": 0, "native": true, "durationMs": 0, "contractValid": false]); return }
    let probe = CrewNetworkProbe(endpoint: endpoint, completion: completion)
    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 6
    configuration.timeoutIntervalForResource = 8
    configuration.waitsForConnectivity = false
    configuration.httpCookieStorage = nil
    configuration.urlCredentialStorage = nil
    configuration.httpShouldSetCookies = false
    configuration.urlCache = nil
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    let session = URLSession(configuration: configuration, delegate: probe, delegateQueue: queue)
    probe.session = session
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    session.dataTask(with: request).resume()
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    // Show the redirect as a finding. Never follow it or send a token to a new origin.
    self.response = response
    headersSufficient = true
    completionHandler(nil)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    self.response = response as? HTTPURLResponse
    if let http = self.response, http.statusCode >= 300 { headersSufficient = true; completionHandler(.cancel) }
    else if response.expectedContentLength > Int64(limit) { tooLarge = true; completionHandler(.cancel) }
    else { completionHandler(.allow) }
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    if body.count + data.count > limit { tooLarge = true; dataTask.cancel(); return }
    body.append(data)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didFinishCollecting metrics: URLSessionTaskMetrics) {
    guard let metric = metrics.transactionMetrics.last else { return }
    for (key, start, end) in [
      ("dnsMs", metric.domainLookupStartDate, metric.domainLookupEndDate),
      ("tcpMs", metric.connectStartDate, metric.connectEndDate),
      ("tlsMs", metric.secureConnectionStartDate, metric.secureConnectionEndDate),
      ("firstByteMs", metric.requestStartDate, metric.responseStartDate),
    ] {
      if let start, let end { timings[key] = max(0, Int(end.timeIntervalSince(start) * 1000)) }
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard !finished else { return }
    finished = true
    let status = response?.statusCode ?? 0
    let json = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
    let valid = endpoint == "/v1/info" ? json?["name"] is String && json?["public"] is Bool : json?["ok"] as? Bool == true
    let code: String
    if headersSufficient && [300, 301, 302, 303, 307, 308].contains(status) { code = "SC_HTTP_REDIRECT" }
    else if headersSufficient && status >= 300 {
      let reported = response?.value(forHTTPHeaderField: "x-crew-diagnostic-code") ?? ""
      code = reported.range(of: "^SC_[A-Z0-9_]{1,60}$", options: .regularExpression) != nil ? reported : "SC_HTTP_\(status)"
    } else if tooLarge { code = "SC_API_06" }
    else if let error { code = Self.errorCode(error as NSError) }
    else { code = valid ? "SC_OK" : "SC_API_01" }
    var result: [String: Any] = ["code": code, "httpStatus": status, "durationMs": Int((ProcessInfo.processInfo.systemUptime - started) * 1000), "native": true, "contractValid": valid, "timings": timings]
    if !headersSufficient, let error, (error as NSError).domain == NSURLErrorDomain { result["nativeErrorCode"] = (error as NSError).code }
    if let reference = response?.value(forHTTPHeaderField: "x-crew-request-id"), reference.range(of: "^(sc_)?[a-fA-F0-9-]{36}$", options: .regularExpression) != nil { result["requestId"] = reference }
    if let raw = response?.value(forHTTPHeaderField: "retry-after") {
      let formatter = DateFormatter()
      formatter.locale = Locale(identifier: "en_US_POSIX")
      formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
      let seconds = Double(raw) ?? formatter.date(from: raw)?.timeIntervalSinceNow
      if let seconds, seconds.isFinite { result["retryAfterSeconds"] = min(86400, max(1, seconds)) }
    }
    Logger(subsystem: Bundle.main.bundleIdentifier ?? "app.soireecrew.mobile", category: "NetworkDiagnostic").notice("SC_NETWORK \(self.endpoint, privacy: .public) \(code, privacy: .public) HTTP\(status)")
    completion(result)
    session.finishTasksAndInvalidate()
    self.session = nil
  }
}
