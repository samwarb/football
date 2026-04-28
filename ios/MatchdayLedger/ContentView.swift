import SwiftUI

struct ContentView: View {
  @StateObject private var store = FootballStore()

  var body: some View {
    TabView {
      NavigationStack {
        LeagueTableView()
      }
      .tabItem {
        Label("Table", systemImage: "list.number")
      }

      NavigationStack {
        WebDashboardView()
      }
      .tabItem {
        Label("Dashboard", systemImage: "safari")
      }
    }
    .environmentObject(store)
    .task {
      await store.loadInitialData()
    }
    .tint(.green)
  }
}

private struct WebDashboardView: View {
  @StateObject private var webViewModel = WebViewModel()
  @Environment(\.openURL) private var openURL

  var body: some View {
    ZStack {
      WebView(model: webViewModel) { url in
        openURL(url)
      }
      .ignoresSafeArea()

      if webViewModel.isLoading {
        VStack(spacing: 12) {
          ProgressView()
          Text("Loading Matchday Ledger")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 18)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
      }
    }
    .navigationTitle("Dashboard")
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItemGroup(placement: .topBarLeading) {
        Button {
          webViewModel.goBack()
        } label: {
          Image(systemName: "chevron.left")
        }
        .disabled(!webViewModel.canGoBack)

        Button {
          webViewModel.goForward()
        } label: {
          Image(systemName: "chevron.right")
        }
        .disabled(!webViewModel.canGoForward)
      }

      ToolbarItemGroup(placement: .topBarTrailing) {
        Button {
          webViewModel.reload()
        } label: {
          Image(systemName: "arrow.clockwise")
        }

        Button {
          webViewModel.openCurrentPage(externalOpen: { url in
            openURL(url)
          })
        } label: {
          Image(systemName: "safari")
        }
      }
    }
  }
}
