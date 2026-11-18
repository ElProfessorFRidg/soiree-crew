import ActivityKit
import ExpoModulesCore
import Foundation

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var padding: Int?
  var paddingDetails: PaddingDetails?
  var imagePosition: String?
  var imageWidth: Int?
  var imageHeight: Int?
  var imageWidthPercent: Double?
  var imageHeightPercent: Double?
  var imageAlign: String?
  var contentFit: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  struct PaddingDetails: Codable, Hashable {
    var top: Int?
    var bottom: Int?
    var left: Int?
    var right: Int?
    var vertical: Int?
    var horizontal: Int?
  }
}



public class CrewActivityTokensModule: Module {
  private var observer: Task<Void, Never>?
  private var children: [String: Task<Void, Never>] = [:]

  public func definition() -> ModuleDefinition {
    Name("CrewActivityTokens")
    Events("onToken")
    OnDestroy { [weak self] in
      self?.observer?.cancel()
      self?.children.values.forEach { $0.cancel() }
      self?.children.removeAll()
    }
    AsyncFunction("startPushActivity") { (attributesJson: String, stateJson: String) -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
      let decoder = JSONDecoder()
      let attributes = try decoder.decode(LiveActivityAttributes.self, from: Data(attributesJson.utf8))
      let state = try decoder.decode(LiveActivityAttributes.ContentState.self, from: Data(stateJson.utf8))
      let activity = try Activity<LiveActivityAttributes>.request(
        attributes: attributes,
        content: ActivityContent(state: state, staleDate: nil),
        pushType: .token
      )
      return activity.id
    }
    Function("startObserving") { [weak self] in
      guard let self = self else { return }
      if #available(iOS 16.2, *) {
        self.observer?.cancel()
        self.children.values.forEach { $0.cancel() }
        self.children.removeAll()
        self.observer = Task { [weak self] in
          guard let self = self else { return }
          for activity in Activity<LiveActivityAttributes>.activities { self.watch(activity) }
          for await activity in Activity<LiveActivityAttributes>.activityUpdates {
            if Task.isCancelled { break }
            self.watch(activity)
          }
        }
      }
    }
  }

  @available(iOS 16.2, *)
  private func watch(_ activity: Activity<LiveActivityAttributes>) {
    let id = activity.id
    children[id]?.cancel()
    children[id] = Task { [weak self] in
      guard let self = self else { return }
      if let token = activity.pushToken {
        self.sendEvent("onToken", ["activityId": id, "token": token.map { String(format: "%02x", $0) }.joined()])
      }
      for await token in activity.pushTokenUpdates {
        if Task.isCancelled { break }
        self.sendEvent("onToken", ["activityId": id, "token": token.map { String(format: "%02x", $0) }.joined()])
      }
    }
  }
}
