import Foundation

@main
struct CheckNetworkErrors {
  static func main() {
    let cases: [(Int, String)] = [
      (NSURLErrorCannotFindHost, "SC_DNS_01"),
      (NSURLErrorDNSLookupFailed, "SC_DNS_01"),
      (NSURLErrorSecureConnectionFailed, "SC_TLS_01"),
      (NSURLErrorServerCertificateUntrusted, "SC_TLS_01"),
      (NSURLErrorAppTransportSecurityRequiresSecureConnection, "SC_TLS_02"),
      (NSURLErrorNotConnectedToInternet, "SC_NET_01"),
      (NSURLErrorCannotConnectToHost, "SC_NET_02"),
      (NSURLErrorNetworkConnectionLost, "SC_NET_03"),
      (NSURLErrorDataNotAllowed, "SC_NET_05"),
      (NSURLErrorTimedOut, "SC_TIMEOUT_01"),
    ]
    for (code, expected) in cases {
      precondition(CrewNetworkProbe.errorCode(NSError(domain: NSURLErrorDomain, code: code)) == expected)
    }
    precondition(CrewNetworkProbe.errorCode(NSError(domain: NSCocoaErrorDomain, code: NSURLErrorCannotFindHost)) == "SC_NET_04")
    for (base, endpoint) in [
      ("https://user:secret@example.com", "/v1/health"),
      ("https://example.com/?token=secret", "/v1/health"),
      ("https://example.com", "/v1/me"),
      ("http://10.evil.0.0.1", "/v1/health"),
      ("http://public.example", "/v1/health"),
    ] {
      var refused = false
      CrewNetworkProbe.start(baseURL: base, endpoint: endpoint) { result in refused = result["code"] as? String == "SC_CFG_02" }
      precondition(refused, "Unsafe diagnostic request was not rejected synchronously")
    }
    print("Native DNS/TLS/connectivity classifications and credential-free endpoint restrictions passed.")
  }
}
