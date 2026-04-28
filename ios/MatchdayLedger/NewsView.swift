import SwiftUI

struct NewsView: View {
  @EnvironmentObject private var store: FootballStore
  @State private var sourceFilter = "all"
  @State private var query = ""

  var body: some View {
    LedgerPage {
      LedgerHeroHeader(
        title: "News",
        eyebrow: "Premier League 2025/26",
        pills: headerPills
      )

      VStack(alignment: .leading, spacing: 12) {
        LedgerSectionTitle(
          kicker: "Stories",
          title: "News",
          note: "ESPN and Sky Sports stories from the Cloudflare feed"
        )

        Picker("Source", selection: $sourceFilter) {
          Text("All").tag("all")
          ForEach(store.newsSources, id: \.self) { source in
            Text(source).tag(source)
          }
        }
        .pickerStyle(.segmented)
      }

      if let message = store.newsErrorMessage, store.news.isEmpty {
        LedgerNoticeView(title: "Could not load news", message: message)
      } else if store.isLoadingNews && store.news.isEmpty {
        LedgerLoadingView(message: "Loading news")
      } else if filteredArticles.isEmpty {
        LedgerNoticeView(title: "No articles match that filter", systemImage: "newspaper")
      } else {
        LazyVStack(spacing: 12) {
          ForEach(filteredArticles) { article in
            NewsCard(article: article)
          }
        }
      }
    }
    .navigationTitle("News")
    .navigationBarTitleDisplayMode(.inline)
    .searchable(text: $query, prompt: "Filter by club or headline")
    .toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button {
          Task { await store.refreshNews() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .disabled(store.isLoadingNews)
        .accessibilityLabel("Refresh news")
      }
    }
    .refreshable {
      await store.refreshNews()
    }
  }

  private var filteredArticles: [NewsArticle] {
    let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)

    return store.news.filter { article in
      let sourceMatches = sourceFilter == "all" || article.source == sourceFilter
      guard sourceMatches else { return false }
      guard !trimmedQuery.isEmpty else { return true }

      let searchableText = [
        article.headline,
        article.description ?? "",
        article.tag ?? "",
        article.teams.joined(separator: " ")
      ].joined(separator: " ")

      return searchableText.localizedCaseInsensitiveContains(trimmedQuery)
    }
  }

  private var headerPills: [LedgerSourcePill] {
    [
      LedgerSourcePill(store.news.isEmpty ? "News pending" : "\(store.news.count) stories", status: store.news.isEmpty ? .pending : .ok),
      LedgerSourcePill(store.newsSources.joined(separator: " · ").isEmpty ? "Sources loading" : store.newsSources.joined(separator: " · "), status: store.newsSources.isEmpty ? .pending : .ok),
      LedgerSourcePill("External links open safely", status: .ok)
    ]
  }
}

private struct NewsCard: View {
  @Environment(\.openURL) private var openURL
  let article: NewsArticle

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(spacing: 0) {
        NewsImageView(article: article)
          .frame(width: 210)
        cardBody
      }

      VStack(spacing: 0) {
        NewsImageView(article: article)
          .frame(height: 176)
        cardBody
      }
    }
    .background(LedgerTheme.paperStrong.opacity(0.86), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(LedgerTheme.lineStrong, lineWidth: 1)
    }
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    .shadow(color: Color(hex: 0x2d2615).opacity(0.12), radius: 20, x: 0, y: 12)
  }

  private var cardBody: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 8) {
        Text(article.source)
          .font(.caption2.weight(.heavy))
          .foregroundStyle(LedgerTheme.greenDark)
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(LedgerTheme.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 7, style: .continuous))

        Text(LedgerDate.fullDateTime(article.publishedAt))
          .font(.caption)
          .foregroundStyle(LedgerTheme.muted)
          .lineLimit(1)
      }

      Text(article.headline)
        .font(.headline.weight(.heavy))
        .foregroundStyle(LedgerTheme.ink)
        .fixedSize(horizontal: false, vertical: true)

      if let description = article.description, !description.isEmpty {
        Text(description)
          .font(.subheadline)
          .foregroundStyle(LedgerTheme.muted)
          .lineLimit(4)
      }

      HStack(spacing: 12) {
        Text(article.tag?.isEmpty == false ? article.tag! : "Premier League")
          .font(.caption2.weight(.heavy))
          .foregroundStyle(LedgerTheme.greenDark)
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(Color(hex: 0xe8dfc9), in: RoundedRectangle(cornerRadius: 7, style: .continuous))

        Spacer()

        if let link = article.link, let url = URL(string: link) {
          Button {
            openURL(url)
          } label: {
            Label("Read story", systemImage: "arrow.up.right")
              .labelStyle(.titleAndIcon)
              .font(.caption.weight(.heavy))
          }
          .foregroundStyle(LedgerTheme.greenDark)
        }
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct NewsImageView: View {
  let article: NewsArticle

  var body: some View {
    AsyncImage(url: imageURL) { phase in
      switch phase {
      case .success(let image):
        image
          .resizable()
          .scaledToFill()
      default:
        ZStack {
          Color(hex: 0xd8d1bd)
          Text(article.source)
            .font(.headline.weight(.black))
            .foregroundStyle(LedgerTheme.greenDark)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .clipped()
  }

  private var imageURL: URL? {
    guard let image = article.image else { return nil }
    return URL(string: image)
  }
}
