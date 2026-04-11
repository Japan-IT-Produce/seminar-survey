# Claude Codeでアプリを作る準備ガイド

## 必要なもの

- Windows / Mac PC
- インターネット接続
- クレジットカード（Claude契約用）

---

## Step 1: Claudeのプランを契約する

### 1-1. Claudeアカウントを作成
1. https://claude.ai にアクセス
2. 「Sign up」からアカウントを作成（メールアドレスまたはGoogleアカウント）

### 1-2. プランを選択
1. https://claude.ai/settings/billing にアクセス
2. 以下のいずれかのプランを契約する

| プラン | 月額 | Claude Code |
|--------|------|-------------|
| Free | 無料 | 使えない |
| **Pro** | **$20/月（約3,000円）** | **使える** |
| **Max** | **$100/月（約15,000円）** | **使える（大量利用向き）** |

> Claude Codeを使うには **Pro以上のプラン** が必要です。

---

## Step 2: AIコードエディタをインストールする

AIコードエディタとは、AIが組み込まれたプログラミング用のソフトウェアです。
以下から **1つ** を選んでインストールしてください。

### 主要なAIコードエディタ比較

| エディタ | 開発元 | 料金 | 特徴 |
|---------|--------|------|------|
| **Google Antigravity** | Google（旧Windsurfチーム） | 現在無料（パブリックプレビュー中） | エージェント型IDE。Gemini 3が中心だが、Claude等の他モデルも利用可能。「Manager View」で複数エージェントを並列管理できる |
| **Cursor** | Anysphere | 無料〜$20/月 | VS Codeベース。AI補完・チャット・エージェント機能。複数のAIモデルを切り替えて使える |
| **VS Code + Claude Code** | Microsoft + Anthropic | VS Code無料 + Claude Pro $20/月 | 世界で最も使われているエディタに、Claude公式拡張機能を追加。シンプルで確実 |

> 本セミナーでは **VS Code + Claude Code** を使用しています。
> どれを選んでも、AIに日本語で指示してアプリを作る体験は同じです。

---

### 選択肢A: Google Antigravity

Googleが開発したエージェント型の次世代IDE。
旧Windsurfのチームが開発しており、AI機能が最も先進的です。

1. https://antigravity.dev にアクセス
2. 「Download」からインストーラーをダウンロード
3. インストーラーを実行
4. Googleアカウントでログイン
5. Claudeモデルを使う場合は、設定からAnthropicのAPIキーを追加

**向いている人**: 最新のAI開発ツールを試したい人、Gemini 3も使いたい人

---

### 選択肢B: Cursor

VS Codeをベースにした人気のAIコードエディタ。

1. https://cursor.com からダウンロード
2. インストーラーを実行
3. アカウント作成・ログイン
4. 無料のHobbyプラン、または Pro（$20/月）を選択

**向いている人**: VS Codeに慣れている人、複数のAIモデルを切り替えたい人

---

### 選択肢C: VS Code + Claude Code 拡張機能（本セミナーで使用）

無料のVS CodeにAnthropic公式のClaude Code拡張機能を追加する方法です。
最もシンプルで、Claude Proプランの範囲内で追加費用なく使えます。

#### VS Codeのインストール
1. https://code.visualstudio.com からダウンロード
2. インストーラーを実行（設定はすべてデフォルトでOK）

#### Claude Code 拡張機能のインストール
1. VS Codeを起動
2. 左サイドバーの **拡張機能アイコン**（四角が4つ）をクリック
3. 検索欄に **「Claude Code」** と入力
4. Anthropic公式の **「Claude Code」** を見つけて **「Install」** をクリック
5. サイドバーにClaudeのアイコンが追加される
6. クリックしてAnthropicアカウントでログイン（Step 1で作成したアカウント）

> 拡張機能のインストールは無料です。利用にはStep 1のClaude Proプランが必要です。

**向いている人**: 初めてAIコーディングを試す人、コストを抑えたい人

---

## Step 3: Node.js をインストールする

アンケートアプリはNode.js（サーバーサイドJavaScript）で動きます。

1. https://nodejs.org にアクセス
2. **LTS版**（推奨版）をダウンロード
3. インストーラーを実行（設定はすべてデフォルトでOK）
4. インストール確認:
   - VS Codeのターミナル（`` Ctrl+` ``）を開く
   - 以下を入力して、バージョンが表示されればOK
   ```
   node --version
   npm --version
   ```

---

## Step 4: Git をインストールする

ソースコード管理とGitHub公開に必要です。

1. https://git-scm.com からダウンロード
2. インストーラーを実行（設定はすべてデフォルトでOK）
3. インストール確認:
   ```
   git --version
   ```

---

## Step 5: GitHub アカウントを作成する

コードの公開とデプロイ（インターネットへの公開）に使います。

1. https://github.com にアクセス
2. 「Sign up」からアカウントを作成（無料）
3. GitHub CLI（コマンドラインツール）をインストール:
   - https://cli.github.com からダウンロード・インストール
4. ターミナルでGitHubにログイン:
   ```
   gh auth login
   ```
   - 「GitHub.com」→「HTTPS」→「Y」→「Login with a web browser」を選択
   - ブラウザが開くので、表示されたコードを入力して認証

---

## Step 6: 作業フォルダを作成する

1. VS Codeでターミナルを開く（`` Ctrl+` ``）
2. 作業フォルダを作成:
   ```
   mkdir c:\work\seminar-survey
   ```
3. VS Codeで「ファイル」→「フォルダーを開く」→ 作成したフォルダを選択

---

## Step 7: Claude Code でアプリを作る

エディタのClaude Codeパネルを開き、日本語で指示するだけです。

### 7-1. 要件を伝える

```
セミナー会場向けのリアルタイム集計アンケートWebアプリを実装してください。

参加者がスマホでQRコードを読み、5問の選択式アンケートに匿名回答すると、
会場スクリーンにリアルタイムでグラフが表示されるアプリです。

（質問内容、選択肢、利用フローなどを記載）
```

### 7-2. AIが自動で開発

Claude Codeが以下を自動実行:
- サーバー側プログラムの構築
- 参加者回答画面（スマホ対応）の作成
- 管理者画面の作成
- 会場投影スクリーンの作成

### 7-3. 動作確認

ターミナルで以下を実行:
```
npm install
npm start
```
ブラウザで http://localhost:3000/admin.html を開いて動作確認。

---

## Step 8: インターネットに公開する

### 8-1. GitHubにコードを公開

Claude Codeに以下を指示:
```
GitHubで公開してください
```

### 8-2. Render にデプロイ

1. https://render.com にアクセス
2. 「Sign in with GitHub」でログイン
3. 「New +」→「Web Service」
4. GitHubリポジトリを選択
5. 設定:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Instance Type: **Free**
6. 「Deploy Web Service」をクリック

数分後、公開URLが発行されます。

---

## 全体の流れまとめ

```
Step 1  Claude Pro プランを契約              ← 5分
Step 2  AIコードエディタをインストール         ← 10分
        （Antigravity / Cursor / VS Code + Claude Code）
Step 3  Node.js をインストール               ← 5分
Step 4  Git をインストール                   ← 5分
Step 5  GitHub アカウントを作成              ← 5分
Step 6  作業フォルダを作成                   ← 1分
Step 7  Claude Code でアプリを作る            ← 30〜40分
Step 8  インターネットに公開する（Render）      ← 10分
──────────────────────────────────────
合計                                      約60〜80分
```

> Step 1〜6（環境構築）は事前準備として済ませておけば、
> 当日は **Step 7〜8 の約40〜50分** でアプリ完成・公開まで到達できます。

---

## 費用まとめ

| 項目 | 費用 |
|------|------|
| Claude Pro プラン | $20/月（約3,000円） |
| **エディタ** | |
| 　Google Antigravity | 無料（パブリックプレビュー中） |
| 　Cursor Hobby | 無料（Pro: $20/月） |
| 　VS Code | 無料 |
| 　Claude Code 拡張機能 | 無料（Claude Proプラン内） |
| Node.js / Git / GitHub | 無料 |
| Render（ホスティング） | 無料プラン |
| **最小構成の合計** | **$20/月（Claude Proプランのみ）** |
