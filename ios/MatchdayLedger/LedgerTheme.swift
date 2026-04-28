import SwiftUI

extension Color {
  init(hex: UInt32, opacity: Double = 1) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xff) / 255,
      green: Double((hex >> 8) & 0xff) / 255,
      blue: Double(hex & 0xff) / 255,
      opacity: opacity
    )
  }
}

enum LedgerTheme {
  static let paper = Color(hex: 0xf4efe1)
  static let paperStrong = Color(hex: 0xfffaf0)
  static let ink = Color(hex: 0x18231d)
  static let muted = Color(hex: 0x627266)
  static let line = Color(hex: 0xd7cfbb)
  static let lineStrong = Color(hex: 0xb7ab92)
  static let green = Color(hex: 0x1f7a5b)
  static let greenDark = Color(hex: 0x0d4c39)
  static let gold = Color(hex: 0xc39b3b)
  static let red = Color(hex: 0xc7553d)
  static let blue = Color(hex: 0x486a9b)
  static let midTable = Color(hex: 0x7b8176)

  static func rankColor(for rank: Int) -> Color {
    if rank <= 4 { return blue }
    if rank <= 6 { return gold }
    if rank == 7 { return green }
    if rank >= 18 { return red }
    return midTable
  }

  static func formColor(for outcome: String) -> Color {
    switch outcome {
    case "W": green
    case "D": gold
    case "L": red
    default: midTable
    }
  }
}

enum LedgerPillStatus {
  case ok
  case pending
  case warning
}

struct LedgerSourcePill: Identifiable {
  let id = UUID()
  let label: String
  let status: LedgerPillStatus

  init(_ label: String, status: LedgerPillStatus = .ok) {
    self.label = label
    self.status = status
  }
}

struct LedgerPage<Content: View>: View {
  private let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        content
      }
      .padding(.horizontal, 16)
      .padding(.top, 12)
      .padding(.bottom, 28)
    }
    .background {
      LedgerGridBackground()
    }
  }
}

private struct LedgerGridBackground: View {
  var body: some View {
    GeometryReader { proxy in
      Path { path in
        let step: CGFloat = 32
        stride(from: CGFloat.zero, through: proxy.size.width, by: step).forEach { x in
          path.move(to: CGPoint(x: x, y: 0))
          path.addLine(to: CGPoint(x: x, y: proxy.size.height))
        }
        stride(from: CGFloat.zero, through: proxy.size.height, by: step).forEach { y in
          path.move(to: CGPoint(x: 0, y: y))
          path.addLine(to: CGPoint(x: proxy.size.width, y: y))
        }
      }
      .stroke(LedgerTheme.green.opacity(0.06), lineWidth: 1)
      .background(LedgerTheme.paper)
      .ignoresSafeArea()
    }
  }
}

struct LedgerHeroHeader: View {
  let title: String
  let eyebrow: String
  let pills: [LedgerSourcePill]

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      VStack(alignment: .leading, spacing: 6) {
        Text(eyebrow.uppercased())
          .font(.caption.weight(.heavy))
          .foregroundStyle(LedgerTheme.paperStrong.opacity(0.72))

        Text(title)
          .font(.system(size: 39, weight: .heavy, design: .serif))
          .foregroundStyle(LedgerTheme.paperStrong)
          .lineLimit(2)
          .minimumScaleFactor(0.82)
      }

      LazyVGrid(columns: [GridItem(.adaptive(minimum: 138), spacing: 8, alignment: .leading)], alignment: .leading, spacing: 8) {
        ForEach(pills) { pill in
          SourcePillView(pill: pill)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(20)
    .background(
      LinearGradient(
        colors: [LedgerTheme.green.opacity(0.96), Color(hex: 0x143c2f).opacity(0.96)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      ),
      in: RoundedRectangle(cornerRadius: 8, style: .continuous)
    )
    .overlay {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(LedgerTheme.lineStrong.opacity(0.7), lineWidth: 1)
    }
  }
}

private struct SourcePillView: View {
  let pill: LedgerSourcePill

  var body: some View {
    Text(pill.label)
      .font(.caption.weight(.bold))
      .lineLimit(2)
      .minimumScaleFactor(0.78)
      .foregroundStyle(textColor)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(LedgerTheme.paperStrong.opacity(0.1), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .stroke(LedgerTheme.paperStrong.opacity(0.24), lineWidth: 1)
      }
  }

  private var textColor: Color {
    switch pill.status {
    case .ok: LedgerTheme.paperStrong
    case .pending: Color(hex: 0xdbe7df)
    case .warning: Color(hex: 0xffe0a3)
    }
  }
}

struct LedgerSectionTitle: View {
  let kicker: String
  let title: String
  var note: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(kicker.uppercased())
        .font(.caption.weight(.heavy))
        .foregroundStyle(LedgerTheme.green)
      Text(title)
        .font(.title2.weight(.heavy))
        .foregroundStyle(LedgerTheme.ink)
      if let note {
        Text(note)
          .font(.footnote)
          .foregroundStyle(LedgerTheme.muted)
      }
    }
  }
}

struct LedgerSurface<Content: View>: View {
  private let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    content
      .padding(16)
      .background(LedgerTheme.paperStrong.opacity(0.86), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .stroke(LedgerTheme.lineStrong, lineWidth: 1)
      }
      .shadow(color: Color(hex: 0x2d2615).opacity(0.12), radius: 20, x: 0, y: 12)
  }
}

struct LedgerLoadingView: View {
  let message: String

  var body: some View {
    LedgerSurface {
      HStack(spacing: 12) {
        ProgressView()
          .tint(LedgerTheme.green)
        Text(message)
          .font(.callout.weight(.semibold))
          .foregroundStyle(LedgerTheme.muted)
      }
      .frame(maxWidth: .infinity, minHeight: 120)
    }
  }
}

struct LedgerNoticeView: View {
  let title: String
  var message: String?
  var systemImage: String = "exclamationmark.triangle"

  var body: some View {
    LedgerSurface {
      VStack(spacing: 10) {
        Image(systemName: systemImage)
          .font(.title2.weight(.semibold))
          .foregroundStyle(LedgerTheme.red)
        Text(title)
          .font(.headline)
          .foregroundStyle(LedgerTheme.ink)
        if let message {
          Text(message)
            .font(.footnote)
            .foregroundStyle(LedgerTheme.muted)
            .multilineTextAlignment(.center)
        }
      }
      .frame(maxWidth: .infinity, minHeight: 120)
    }
  }
}

struct TeamBadgeView: View {
  let urlString: String?
  let fallback: String
  var size: CGFloat = 30

  var body: some View {
    AsyncImage(url: imageURL) { phase in
      switch phase {
      case .success(let image):
        image
          .resizable()
          .scaledToFit()
      default:
        ZStack {
          RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(Color(hex: 0xe8dfc9))
          Text(fallback)
            .font(.caption2.weight(.heavy))
            .foregroundStyle(LedgerTheme.greenDark)
            .minimumScaleFactor(0.6)
            .lineLimit(1)
        }
      }
    }
    .frame(width: size, height: size)
  }

  private var imageURL: URL? {
    guard let urlString else { return nil }
    return URL(string: urlString)
  }
}

struct FormPillView: View {
  let outcome: String

  var body: some View {
    Text(outcome)
      .font(.caption2.weight(.heavy))
      .foregroundStyle(.white)
      .frame(width: 24, height: 24)
      .background(LedgerTheme.formColor(for: outcome), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
  }
}

enum LedgerDate {
  static func shortDate(_ value: String?) -> String {
    guard let date = dateOnly(from: value) else { return "TBC" }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_GB")
    formatter.dateFormat = "E d MMM"
    return formatter.string(from: date)
  }

  static func fullDateTime(_ value: String?) -> String {
    guard let date = dateTime(from: value) else { return "Recently" }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_GB")
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }

  static func shortTime(_ value: String?) -> String {
    guard let value, !value.isEmpty else { return "vs" }
    return String(value.prefix(5))
  }

  static func rangeLabel(round: Int, fixtures: [Fixture]) -> String {
    let dates = fixtures.compactMap(\.date).sorted()
    guard let first = dates.first, let last = dates.last else {
      return "Round \(round)"
    }

    if first == last {
      return "R\(round) - \(shortDate(first))"
    }

    return "R\(round) - \(shortDate(first)) to \(shortDate(last))"
  }

  private static func dateOnly(from value: String?) -> Date? {
    guard let value else { return nil }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_GB")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: value)
  }

  private static func dateTime(from value: String?) -> Date? {
    guard let value else { return nil }
    let fractionalFormatter = ISO8601DateFormatter()
    fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]

    return fractionalFormatter.date(from: value) ?? formatter.date(from: value)
  }
}
