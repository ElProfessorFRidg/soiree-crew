import ActivityKit
import SwiftUI
import WidgetKit

// Replaces expo-live-activity's own widget at prebuild (plugins/withNightActivityView.js).
// The module and its attributes stay as they are: the app sends the night as JSON in `subtitle`,
// already worded in the app's language, and this file only draws it (HUB-02, QOL-27, O-19).

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

// MARK: - What the app sends

struct NightPayload: Decodable {
  struct Person: Decodable, Hashable {
    let i: String
    let c: String
  }

  struct Party: Decodable {
    let name: String
    let venue: String?
    let here: String
    let hereN: Int
    let home: String?
    let people: [Person]
    let more: Int
    let alert: String?
    let endsAt: Double
    let ends: String
    let url: String
  }

  struct Drive: Decodable {
    let label: String
    let value: String
    let tone: String
    let short: String?

    var ink: Color {
      tone == "ok" ? NightColors.okText : tone == "amber" ? NightColors.tagText : NightColors.dangerText
    }
    var fill: Color {
      tone == "ok" ? NightColors.okBg : tone == "amber" ? NightColors.tagBg : NightColors.dangerBg
    }
  }

  struct Actions: Decodable {
    let again: String
    let water: String
    let sos: String
    let home: String?
  }

  let mode: String
  let show: Bool
  let accent: String
  let startAt: Double?
  let zeroAt: Double?
  let limitFrac: Double?
  let bac: String?
  let unit: String?
  let bacColor: String?
  let stamp: String
  let status: String?
  let drinksN: Int
  let waterN: Int
  let drinks: String
  let water: String
  let under: String?
  let drive: Drive?
  let zeroLabel: String?
  let zeroClock: String?
  let backToZero: String?
  let lastAt: Double?
  let last: String?
  let lastClock: String?
  let zeroIn: String
  let tonight: String
  let estimate: String
  let party: Party?
  let actions: Actions

  static func from(_ state: LiveActivityAttributes.ContentState) -> NightPayload? {
    guard let raw = state.subtitle, let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(NightPayload.self, from: data)
  }

  var inParty: Bool { mode == "party" && party != nil }
  var accentColor: Color { Color(hex: accent) }
  var figureColor: Color { bacColor.map { Color(hex: $0) } ?? NightColors.amber }

  /// The countdown the bar and the timer follow: back to zero, or the end of the party.
  var endDate: Date? {
    if let zeroAt { return Date(timeIntervalSince1970: zeroAt / 1000) }
    if let party { return Date(timeIntervalSince1970: party.endsAt / 1000) }
    return nil
  }

  var startDate: Date {
    startAt.map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date()
  }

  var lastDate: Date? {
    lastAt.map { Date(timeIntervalSince1970: $0 / 1000) }
  }
}

enum NightColors {
  static let bg = Color(hex: "#1E2624")
  static let surface = Color(hex: "#28322F")
  static let line = Color(hex: "#34403C")
  static let text = Color(hex: "#F1EEE6")
  static let muted = Color(hex: "#AEB7B2")
  static let amber = Color(hex: "#F4B33D")
  static let onAmber = Color(hex: "#1E2624")
  static let water = Color(hex: "#8CCBEA")
  static let waterBg = Color(hex: "#24404D")
  static let waterText = Color(hex: "#B8E0F3")
  static let danger = Color(hex: "#FF7A66")
  static let dangerBg = Color(hex: "#4E2C27")
  static let dangerText = Color(hex: "#FFD3CB")
  static let okBg = Color(hex: "#2A4632")
  static let okText = Color(hex: "#BFE9C8")
  static let tagBg = Color(hex: "#4A3E22")
  static let tagText = Color(hex: "#F8CE7A")
}

/// The big figures: compressed and heavy, like the app's Archivo numerals.
private func numeral(_ size: CGFloat) -> Font {
  .system(size: size, weight: .black).width(.compressed)
}

private func link(_ path: String) -> URL {
  URL(string: "soireecrew://" + path) ?? URL(string: "soireecrew://")!
}

// MARK: - Shared pieces

/// Time left in hours and minutes ("8 h 5 min"), drawn by iOS: no seconds ticking on the lock screen.
private struct Countdown: View {
  let end: Date
  let size: CGFloat
  var body: some View {
    Text(max(Date(), end), style: .relative)
      .font(.system(size: size, weight: .bold))
      .monospacedDigit()
      .lineLimit(1)
      .minimumScaleFactor(0.7)
      .multilineTextAlignment(.trailing)
  }
}

/// Driving, as on the party screen: a tinted pill with the car, its verdict or its "not before" time.
private struct DrivePill: View {
  let drive: NightPayload.Drive
  var compact = false
  var body: some View {
    VStack(alignment: .trailing, spacing: 2) {
      if !compact {
        HStack(spacing: 4) {
          Glyph(systemName: "car.fill", color: drive.ink, size: 11)
          Text(drive.label).font(.system(size: 11, weight: .bold)).foregroundStyle(drive.ink.opacity(0.8))
        }
      }
      HStack(spacing: 4) {
        if compact { Glyph(systemName: "car.fill", color: drive.ink, size: 11) }
        Text(compact ? (drive.short ?? drive.value) : drive.value)
          .font(.system(size: compact ? 13 : 15, weight: .heavy))
          .foregroundStyle(drive.ink)
          .lineLimit(1)
          .minimumScaleFactor(0.75)
      }
    }
    .padding(.horizontal, 10)
    .padding(.vertical, compact ? 4 : 6)
    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(drive.fill))
  }
}

/// Glasses, water and how long ago the last glass was: what the night looks like at a glance.
private struct Facts: View {
  let p: NightPayload
  var body: some View {
    HStack(spacing: 12) {
      HStack(spacing: 4) {
        Glyph(systemName: "mug.fill", color: NightColors.amber, size: 12)
        Text("\(p.drinksN)").foregroundStyle(NightColors.text)
      }
      HStack(spacing: 4) {
        Glyph(systemName: "drop.fill", color: NightColors.water, size: 12)
        Text("\(p.waterN)").foregroundStyle(NightColors.water)
      }
      if let last = p.lastClock, let label = p.last {
        HStack(spacing: 4) {
          Text(label).foregroundStyle(NightColors.muted)
          Text(last).foregroundStyle(NightColors.text)
        }
        .lineLimit(1)
        .minimumScaleFactor(0.75)
      }
    }
    .font(.system(size: 13, weight: .bold))
  }
}

/// Fills from the first drink to back-to-zero; the red tick is where the legal limit is crossed.
private struct NightBar: View {
  let payload: NightPayload
  let height: CGFloat
  var body: some View {
    if let end = payload.endDate {
      ZStack(alignment: .leading) {
        ProgressView(timerInterval: payload.startDate...max(payload.startDate, end), countsDown: false, label: { EmptyView() }, currentValueLabel: { EmptyView() })
          .progressViewStyle(.linear)
          .tint(payload.accentColor)
          .scaleEffect(x: 1, y: height / 4, anchor: .center)
        if payload.show, let frac = payload.limitFrac {
          GeometryReader { proxy in
            Rectangle()
              .fill(NightColors.danger)
              .frame(width: 2, height: height + 8)
              .offset(x: proxy.size.width * min(max(frac, 0), 1) - 1, y: -4)
          }
          .frame(height: height)
        }
      }
      .frame(height: height + 8)
    }
  }
}

private struct ActionButton: View {
  let label: String
  let path: String
  let fill: Color
  let ink: Color
  var icon: String? = nil
  var body: some View {
    Link(destination: link(path)) {
      HStack(spacing: 5) {
        if let icon { Image(systemName: icon).font(.system(size: 13, weight: .heavy)) }
        Text(label).font(.system(size: 15, weight: .bold)).lineLimit(1).minimumScaleFactor(0.7)
      }
      .padding(.horizontal, 10)
      .frame(maxWidth: .infinity, minHeight: 32, maxHeight: 32)
      .foregroundStyle(ink)
      .background(fill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
  }
}

private struct Glyph: View {
  let systemName: String
  let color: Color
  var size: CGFloat = 14
  var body: some View {
    Image(systemName: systemName)
      .font(.system(size: size, weight: .semibold))
      .foregroundStyle(color)
  }
}

private struct Faces: View {
  let people: [NightPayload.Person]
  let more: Int
  let size: CGFloat
  var body: some View {
    HStack(spacing: -size * 0.28) {
      ForEach(people, id: \.self) { person in
        Text(person.i)
          .font(.system(size: size * 0.4, weight: .heavy))
          .foregroundStyle(NightColors.onAmber)
          .frame(width: size, height: size)
          .background(Circle().fill(Color(hex: person.c)))
          .overlay(Circle().stroke(NightColors.bg, lineWidth: 2))
      }
      if more > 0 {
        Text("+\(more)")
          .font(.system(size: size * 0.4, weight: .heavy))
          .foregroundStyle(NightColors.text)
          .frame(width: size, height: size)
          .background(Circle().fill(NightColors.line))
          .overlay(Circle().stroke(NightColors.bg, lineWidth: 2))
      }
    }
  }
}

// MARK: - Lock screen, solo night (design A)

private struct SoloLockView: View {
  let p: NightPayload
  // iOS gives the lock screen about 160 pt of height: hero, bar, one line of facts, buttons.
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .center, spacing: 10) {
        if p.show, let bac = p.bac {
          VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
              Text(bac).font(numeral(40)).foregroundStyle(p.figureColor)
              Text(p.unit ?? "").font(.system(size: 13, weight: .bold)).foregroundStyle(NightColors.text)
            }
            if let status = p.status {
              Text(status).font(.system(size: 11, weight: .semibold)).foregroundStyle(NightColors.muted).lineLimit(1)
            }
          }
        } else if let zero = p.zeroClock {
          VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 5) {
              Glyph(systemName: "mug.fill", color: NightColors.amber, size: 11)
              Text(p.backToZero ?? "").font(.system(size: 12, weight: .bold)).foregroundStyle(NightColors.muted)
            }
            Text(zero).font(numeral(34)).foregroundStyle(NightColors.text).lineLimit(1).minimumScaleFactor(0.7)
          }
        } else if let zero = p.zeroLabel {
          Text(zero).font(.system(size: 15, weight: .bold)).foregroundStyle(NightColors.text)
        }
        Spacer(minLength: 0)
        if let drive = p.drive { DrivePill(drive: drive) }
      }
      NightBar(payload: p, height: 5)
      HStack(spacing: 8) {
        Facts(p: p)
        Spacer(minLength: 4)
        if p.show, let zero = p.zeroClock {
          Text((p.backToZero ?? "") + " " + zero).font(.system(size: 12, weight: .bold)).foregroundStyle(NightColors.muted).lineLimit(1).minimumScaleFactor(0.75)
        }
      }
      HStack(spacing: 8) {
        ActionButton(label: p.actions.again, path: "quick/again", fill: NightColors.amber, ink: NightColors.onAmber, icon: "plus")
        ActionButton(label: p.actions.water, path: "quick/water", fill: NightColors.waterBg, ink: NightColors.waterText, icon: "drop.fill")
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }
}

// MARK: - Lock screen, party with the crew (design C)

private struct PartyLockView: View {
  let p: NightPayload
  let party: NightPayload.Party
  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Rectangle().fill(p.accentColor).frame(height: 4)
      VStack(alignment: .leading, spacing: 7) {
        HStack(spacing: 6) {
          Text(p.show ? party.name : party.here)
            .font(.system(size: 16, weight: .heavy))
            .foregroundStyle(NightColors.text)
            .lineLimit(1)
          Spacer(minLength: 4)
          if p.show, let venue = party.venue {
            Glyph(systemName: "mappin", color: NightColors.muted, size: 12)
            Text(venue).font(.system(size: 13)).foregroundStyle(NightColors.muted).lineLimit(1)
          }
        }
        if p.show {
          HStack(spacing: 10) {
            Faces(people: party.people, more: party.more, size: 24)
            Text(party.here).font(.system(size: 14, weight: .bold)).foregroundStyle(NightColors.text)
            Spacer(minLength: 4)
            if let home = party.home {
              Text(home)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(NightColors.okText)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Capsule().fill(NightColors.okBg))
            }
          }
        }
        HStack(spacing: 10) {
          HStack(spacing: 1) {
            ForEach(0..<min(p.drinksN, 6), id: \.self) { _ in Glyph(systemName: "mug.fill", color: NightColors.amber, size: 16) }
            ForEach(0..<min(p.waterN, 3), id: \.self) { _ in Glyph(systemName: "drop.fill", color: NightColors.water, size: 16) }
          }
          Text(p.drinks).font(.system(size: 13)).foregroundStyle(NightColors.text.opacity(0.85)).lineLimit(1)
          Spacer(minLength: 4)
          if p.show, let bac = p.bac {
            HStack(alignment: .firstTextBaseline, spacing: 3) {
              Text(bac).font(numeral(26)).foregroundStyle(p.figureColor)
              Text(p.unit ?? "").font(.system(size: 11, weight: .bold)).foregroundStyle(NightColors.text)
            }
          }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(NightColors.surface))
        if let alert = party.alert {
          HStack(spacing: 8) {
            Glyph(systemName: "exclamationmark.circle.fill", color: NightColors.dangerText)
            Text(alert).font(.system(size: 13, weight: .bold)).foregroundStyle(NightColors.dangerText).lineLimit(2)
          }
          .padding(.horizontal, 10)
          .padding(.vertical, 7)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(NightColors.dangerBg))
        }
        HStack {
          Text(p.show ? p.stamp : party.ends).font(.system(size: 12)).foregroundStyle(NightColors.muted)
          Spacer(minLength: 6)
          if p.show { Text(party.ends).font(.system(size: 12)).foregroundStyle(NightColors.muted) }
          Countdown(end: Date(timeIntervalSince1970: party.endsAt / 1000), size: 15)
            .foregroundStyle(NightColors.text)
            .frame(maxWidth: 70)
        }
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 10)
    }
  }
}

private struct FallbackView: View {
  let title: String
  var body: some View {
    HStack(spacing: 10) {
      Glyph(systemName: "clock", color: NightColors.amber, size: 18)
      Text(title).font(.system(size: 16, weight: .bold)).foregroundStyle(NightColors.text)
      Spacer()
    }
    .padding(16)
  }
}

// MARK: - Widget

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      Group {
        if let p = NightPayload.from(context.state) {
          if p.inParty, let party = p.party {
            PartyLockView(p: p, party: party)
              .widgetURL(link(party.url))
          } else {
            SoloLockView(p: p).widgetURL(link(""))
          }
        } else {
          FallbackView(title: context.state.title).widgetURL(link(""))
        }
      }
      .activityBackgroundTint(NightColors.bg)
      .activitySystemActionForegroundColor(NightColors.text)
    } dynamicIsland: { context in
      let p = NightPayload.from(context.state)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          if let p {
            expandedLeading(p).padding(.leading, 6)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let p {
            expandedTrailing(p).padding(.trailing, 6)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          if let p {
            expandedBottom(p).padding(.horizontal, 6)
          } else {
            Text(context.state.title).font(.system(size: 15, weight: .semibold))
          }
        }
      } compactLeading: {
        if let p {
          compactLeading(p)
        }
      } compactTrailing: {
        if let p {
          compactTrailing(p)
        }
      } minimal: {
        if let p {
          minimal(p)
        }
      }
      .keylineTint(p?.accentColor ?? NightColors.amber)
      .widgetURL(link(p?.party?.url ?? ""))
    }
  }

  // Compact: party = people here and my glasses; alone = the figure (or the glass) and the countdown.
  @ViewBuilder
  private func compactLeading(_ p: NightPayload) -> some View {
    if p.inParty, let party = p.party {
      HStack(spacing: 4) {
        Circle().fill(party.alert != nil ? NightColors.danger : p.accentColor).frame(width: 8, height: 8)
        Text("\(party.hereN)").font(.system(size: 15, weight: .heavy)).foregroundStyle(NightColors.text)
        Glyph(systemName: "person.2.fill", color: NightColors.text, size: 11)
      }
    } else if p.show, let bac = p.bac {
      HStack(spacing: 4) {
        Glyph(systemName: "mug.fill", color: p.figureColor, size: 12)
        Text(bac).font(numeral(17)).foregroundStyle(p.figureColor)
      }
    } else {
      HStack(spacing: 3) {
        Glyph(systemName: "mug.fill", color: NightColors.amber, size: 12)
        Text("\(p.drinksN)").font(.system(size: 15, weight: .heavy)).foregroundStyle(NightColors.amber)
      }
    }
  }

  @ViewBuilder
  private func compactTrailing(_ p: NightPayload) -> some View {
    if p.inParty {
      HStack(spacing: 3) {
        Glyph(systemName: "mug.fill", color: NightColors.amber, size: 12)
        Text("\(p.drinksN)").font(.system(size: 15, weight: .heavy)).foregroundStyle(NightColors.amber)
      }
    } else if let zero = p.zeroClock {
      // The time back to zero, fixed: a ticking timer by the camera says less and moves all night.
      HStack(spacing: 3) {
        Glyph(systemName: "arrow.down.right", color: NightColors.muted, size: 10)
        Text(zero).font(.system(size: 14, weight: .heavy)).foregroundStyle(NightColors.text).lineLimit(1).minimumScaleFactor(0.7)
      }
      .frame(maxWidth: 70)
    }
  }

  @ViewBuilder
  private func minimal(_ p: NightPayload) -> some View {
    if let end = p.endDate {
      ProgressView(timerInterval: p.startDate...max(p.startDate, end), countsDown: true, label: { EmptyView() }, currentValueLabel: {
        Image(systemName: p.inParty ? "person.2.fill" : "mug.fill").font(.system(size: 9, weight: .bold))
      })
      .progressViewStyle(.circular)
      .tint(p.inParty ? p.accentColor : p.figureColor)
    } else {
      Glyph(systemName: "mug.fill", color: NightColors.amber, size: 13)
    }
  }

  @ViewBuilder
  private func expandedLeading(_ p: NightPayload) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      if p.inParty, let party = p.party {
        Text(p.show ? party.name : party.here).font(.system(size: 15, weight: .heavy)).foregroundStyle(NightColors.text).lineLimit(1)
      } else {
        if p.show { Text(p.stamp).font(.system(size: 11, weight: .bold)).foregroundStyle(NightColors.muted) }
      }
      if p.show, let bac = p.bac {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(bac).font(numeral(p.inParty ? 30 : 44)).foregroundStyle(p.figureColor)
          Text(p.unit ?? "").font(.system(size: 12, weight: .bold)).foregroundStyle(NightColors.text)
        }
      } else if !p.inParty, let zero = p.zeroClock {
        Text(p.backToZero ?? "").font(.system(size: 11, weight: .bold)).foregroundStyle(NightColors.muted)
        Text(zero).font(numeral(30)).foregroundStyle(NightColors.text).lineLimit(1).minimumScaleFactor(0.7)
      } else if let zero = p.zeroLabel {
        Text(zero).font(.system(size: 14, weight: .bold)).foregroundStyle(NightColors.text)
      }
    }
  }

  @ViewBuilder
  private func expandedTrailing(_ p: NightPayload) -> some View {
    VStack(alignment: .trailing, spacing: 6) {
      HStack(spacing: 10) {
        HStack(spacing: 3) {
          Glyph(systemName: "mug.fill", color: NightColors.amber, size: 12)
          Text("\(p.drinksN)").foregroundStyle(NightColors.text)
        }
        HStack(spacing: 3) {
          Glyph(systemName: "drop.fill", color: NightColors.water, size: 12)
          Text("\(p.waterN)").foregroundStyle(NightColors.water)
        }
      }
      .font(.system(size: 15, weight: .heavy))
      if let drive = p.drive { DrivePill(drive: drive, compact: true) }
    }
  }

  @ViewBuilder
  private func expandedBottom(_ p: NightPayload) -> some View {
    VStack(spacing: 6) {
      if p.inParty, let party = p.party, let alert = party.alert {
        Text(alert)
          .font(.system(size: 13, weight: .bold))
          .foregroundStyle(NightColors.dangerText)
          .frame(maxWidth: .infinity, alignment: .leading)
      } else if p.inParty, let party = p.party, p.show {
        HStack(spacing: 8) {
          Faces(people: party.people, more: party.more, size: 24)
          Text(party.here).font(.system(size: 13, weight: .bold)).foregroundStyle(NightColors.text)
          Spacer()
          if let home = party.home { Text(home).font(.system(size: 12, weight: .bold)).foregroundStyle(NightColors.okText) }
        }
      }
      NightBar(payload: p, height: 6)
      HStack(spacing: 8) {
        ActionButton(label: p.actions.again, path: "quick/again", fill: NightColors.amber, ink: NightColors.onAmber, icon: "plus")
        if p.inParty, let home = p.actions.home {
          ActionButton(label: home, path: "quick/home", fill: NightColors.okBg, ink: NightColors.okText, icon: "house.fill")
        } else {
          ActionButton(label: p.actions.water, path: "quick/water", fill: NightColors.waterBg, ink: NightColors.waterText, icon: "drop.fill")
        }
        ActionButton(label: p.actions.sos, path: "sos", fill: NightColors.dangerBg, ink: NightColors.dangerText)
          .frame(maxWidth: 76)
      }
    }
  }
}
