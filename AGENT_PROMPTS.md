# セミナー向けリアルタイム集計アンケートWebアプリ — エージェントチーム実装プロンプト

## チーム構成

```
┌──────────────────────────────────────────────────┐
│              Leader（リーダー）                     │
│    = ユーザー + メイン会話のClaude                   │
│    役割: 設計判断・エージェント起動・統合・最終承認     │
└───────┬─────────────┬──────────────┬──────────────┘
        │  Step 1     │  Step 2      │  Step 3
        ▼             ▼              ▼
  ┌───────────┐ ┌───────────┐ ┌───────────┐
  │  実装担当   │ │ デザイン担当 │ │  QA担当    │
  │ Engineer  │ │ Designer  │ │ Reviewer  │
  │           │ │           │ │           │
  │ 全ファイル  │ │ CSS改善    │ │ コード品質  │
  │ の構築     │ │ 視覚演出   │ │ 動作整合性  │
  │           │ │ UX改善    │ │ a11y・SEO  │
  └───────────┘ └───────────┘ └───────────┘
```

### 実行フロー
1. **リーダー** が実装担当を起動し、全ファイルを構築させる
2. **リーダー** が実装結果を確認し、デザイン担当を起動する
3. **リーダー** がデザイン改善結果を確認し、QA担当を起動する
4. **リーダー** がQA結果を元に最終調整を判断する

---

## 共通仕様（全エージェント参照）

### ディレクトリ構造
```
seminar-survey/
├── server.js
├── package.json
├── README.md
├── .gitignore
├── public/
│   ├── index.html             # 参加者 回答ページ（モバイルファースト）
│   ├── admin.html             # 管理者ダッシュボード
│   ├── projection.html        # 会場投影スクリーン
│   ├── css/
│   │   ├── common.css         # 共通変数・リセット・タイポグラフィ
│   │   ├── survey.css         # 回答ページ用スタイル
│   │   ├── admin.css          # 管理者画面用スタイル
│   │   └── projection.css     # 投影画面用スタイル
│   └── js/
│       ├── survey.js          # 回答ページ ロジック
│       ├── admin.js           # 管理者画面 ロジック
│       └── projection.js      # 投影画面 ロジック
```

### 技術スタック
- **バックエンド**: Node.js + Express + Socket.IO
- **フロントエンド**: Vanilla HTML5 / CSS3 / JavaScript (ES6+)
- **グラフ描画**: Chart.js (CDN)
- **QRコード生成**: qrcode npm パッケージ（サーバーサイド生成）
- **データ保存**: インメモリ（セミナー1回分のみ保持）

### 質問データ
```js
const QUESTIONS = [
  { id: "q1", text: "貴社で現在使っている生成AIを選んでください", type: "multiple", options: ["Copilot", "Gemini", "ChatGPT", "Claude", "その他", "使っていない"] },
  { id: "q2", text: "貴社で生成AIをどのように使っていますか", type: "single", options: ["全社で使っている", "一部の部署で使っている", "個人レベルで使っている", "試しに使ったことはある", "使っていない"] },
  { id: "q3", text: "貴社のロボット活用状況に最も近いものを選んでください", type: "single", options: ["自社でロボットシステムを構築している", "外部に依頼してロボットシステムを導入している", "単体のロボットを使っている", "導入を検討している", "使っていない"] },
  { id: "q4", text: "貴社で使っているロボットの種類を選んでください", type: "multiple", options: ["協働ロボット", "産業用ロボット", "搬送ロボット（AGV・AMRなど）", "検査・自動化装置", "使っていない", "分からない"] },
  { id: "q5", text: "貴社で今後進めたいものを選んでください", type: "single", options: ["生成AIの活用", "ロボット導入", "AIとロボットの両方", "まずは情報共有やデータ整理", "まだ決まっていない"] }
];
```

### REST API
| Method | Path | 説明 |
|--------|------|------|
| `POST` | `/api/sessions` | 新規セッション作成。Body: `{ name }` → `{ sessionId, name, qrCodeDataUrl, participantUrl }` |
| `GET` | `/api/sessions/:id` | セッション情報取得 → `{ sessionId, name, questions, status }` |
| `GET` | `/api/sessions/:id/qrcode` | QRコード画像（data URL） |
| `POST` | `/api/sessions/:id/responses` | 回答送信。Body: `{ answers: { q1: [...], q2: "...", ... } }` |
| `GET` | `/api/sessions/:id/results` | 集計結果 `{ responseCount, results: { q1: { "Copilot": { count, percentage }, ... }, ... } }` |
| `POST` | `/api/sessions/:id/reset` | 回答リセット |
| `POST` | `/api/sessions/:id/status` | 状態変更。Body: `{ status: "waiting"|"active"|"closed" }` |

### WebSocket イベント
| イベント名 | 方向 | ペイロード |
|-----------|------|-----------|
| `join-session` | Client→Server | `{ sessionId }` |
| `new-response` | Server→Client | `{ results, responseCount }` |
| `session-status` | Server→Client | `{ status }` |
| `session-reset` | Server→Client | `{}` |

### バリデーションルール
- single型: 必ず1つだけ選択
- multiple型: 1つ以上選択
- multiple型で「使っていない」「分からない」選択時は他の選択肢と同時選択不可
- 全問回答必須
- 同一ブラウザからの二重回答防止（localStorage）

---

## Step 1: 実装担当（Engineer）

### 役割
フルスタックエンジニアとして、全ファイルを一気通貫で実装する。
API仕様のズレを防ぐため、バックエンドとフロントエンドを1人で構築する。

### プロンプト

```
あなたはフルスタックエンジニアです。
セミナー会場向けリアルタイム集計アンケートWebアプリの全ファイルを実装してください。

## 作業ディレクトリ
c:\work\Antigravity\seminar-survey

## 作成するファイル一覧
1. package.json
2. .gitignore
3. server.js
4. public/css/common.css
5. public/css/survey.css
6. public/css/admin.css
7. public/css/projection.css
8. public/index.html
9. public/admin.html
10. public/projection.html
11. public/js/survey.js
12. public/js/admin.js
13. public/js/projection.js
14. README.md

## 実装順序
バックエンド → 共通CSS → 回答ページ → 管理画面 → 投影画面 → README の順で実装すること。
この順序で作ることで、後続ページが前のページのパターンを踏襲でき、整合性が保たれる。

---

### 1. package.json
- name: "seminar-survey"
- scripts: { "start": "node server.js", "dev": "node --watch server.js" }
- dependencies: express, socket.io, cors, qrcode, uuid

### 2. .gitignore
- node_modules/
- .env

### 3. server.js（バックエンド）

Express + Socket.IO サーバー。

#### セッション管理
- Map<sessionId, { id, name, status, questions, responses[], createdAt }>
- sessionId: uuid先頭8文字
- status: "waiting" | "active" | "closed"

#### 質問データ
上記「共通仕様」の QUESTIONS をそのまま定義する。

#### REST API（上記「共通仕様」のAPI表の通り実装）

POST /api/sessions
- Body: { name }
- QRコード生成: 回答URL = http(s)://{host}/?s={sessionId}（Hostヘッダーから動的生成）
- Response: { sessionId, name, status, qrCodeDataUrl, participantUrl }

GET /api/sessions/:id
- questionsを含むセッション情報を返す
- 404 if not found

GET /api/sessions/:id/qrcode
- data URLを返す

POST /api/sessions/:id/responses
- バリデーション:
  - セッションが active でなければ 403
  - 全問回答必須（未回答は400）
  - single型: stringで1つ
  - multiple型: string[]で1つ以上
  - 各回答が有効な選択肢に含まれること
  - multiple型で「使っていない」「分からない」選択時は他との同時選択不可
- responses配列にpush
- 集計結果を計算しSocket.IOでブロードキャスト
- Response: { success: true, responseCount }

GET /api/sessions/:id/results
- 各質問×選択肢ごとの count と percentage
- Response: { responseCount, results: { q1: { "Copilot": { count, percentage }, ... }, ... } }

POST /api/sessions/:id/reset
- responses を空に
- session-reset をブロードキャスト

POST /api/sessions/:id/status
- status を更新
- session-status をブロードキャスト

#### Socket.IO
- join-session でルーム参加
- new-response で結果ブロードキャスト
- session-status / session-reset をブロードキャスト

#### 静的ファイル配信
- express.static('public')

---

### 4. public/css/common.css

#### リセット
- box-sizing: border-box 全要素
- margin, padding リセット
- img { max-width: 100%; display: block; }
- button リセット（cursor: pointer, border: none, background: none）

#### CSS変数（:root）
- --color-primary: #0F4C81
- --color-accent: #00D4AA
- --color-text: #1A1A2E
- --color-bg: #F7F9FC
- --color-card: #FFFFFF
- --color-error: #E74C6F
- --color-success: #00D4AA
- --font-ja: 'Noto Sans JP', sans-serif
- --font-en: 'Inter', sans-serif
- --radius-sm: 8px
- --radius-md: 12px
- --radius-lg: 16px
- --shadow-sm: 0 1px 4px rgba(0,0,0,0.06)
- --shadow-md: 0 2px 12px rgba(0,0,0,0.08)

#### Google Fonts
- @import で Noto Sans JP (400,500,700) と Inter (400,500,600,700,800)

#### 共通タイポグラフィ
- body: font-family: var(--font-ja); color: var(--color-text); line-height: 1.6;
- .visually-hidden ユーティリティ

---

### 5. public/index.html + css/survey.css + js/survey.js（参加者回答ページ）

スマートフォンで使うモバイルファーストページ。QRコードから /?s={sessionId} で直接開く。

#### 画面フロー
1. URLSearchParams から sessionId 取得
2. GET /api/sessions/:id でセッション情報取得
3. waiting なら待機画面（Socket.IOで状態監視、activeになったら自動切替）
4. active なら質問表示
5. 回答送信後、完了画面

#### 質問表示
- 全5問を1ページ縦スクロール
- Q番号 + 質問文 + 選択肢
- single型: ラジオボタン風カスタムUI（タップで選択、ハイライト）
- multiple型: チェックボックス風カスタムUI（「複数選択可」表記）
- multiple型で「使っていない」「分からない」選択時は他を自動解除、逆も同様
- 未回答の質問で送信押下時: ハイライト + スクロール

#### 送信
- POST /api/sessions/:id/responses
- 送信中: ボタンにローディングスピナー
- 成功時: localStorage に `survey_answered_{sessionId}` 保存
- 再訪問時: 回答済みなら完了画面

#### 完了画面
- CSS描画のチェックマーク
- 「ご回答ありがとうございました」
- 「スクリーンに結果が表示されます」

#### デザイン指示（survey.css）
- max-width: 480px, margin: 0 auto, padding: 16px
- 各質問: カード（白背景, border-radius: 16px, box-shadow）
- 選択肢: 角丸ボタン風（padding: 14px 18px, border-radius: 12px）
- 未選択: 白背景 + 1px solid #E2E8F0
- 選択中: グラデーション背景(#0F4C81→#1A6FB5) + 白テキスト + チェックアイコン
- 送信ボタン: sticky bottom, グラデーション(#00D4AA→#00B894), 角丸14px
- 質問カード読み込み時: fadeIn + slideUp（stagger 0.1s）
- 選択肢タップ: 0.15s ease トランジション

---

### 6. public/admin.html + css/admin.css + js/admin.js（管理者ダッシュボード）

PCで操作する管理画面。

#### 画面構成

**セッション未作成時**
- セッション名入力 + 「セッションを作成」ボタン

**セッション作成後 — 左右2カラム**

左カラム（360px固定）:
- QRコード（200x200以上）
- 参加者URL（コピーボタン付き）
- セッション状態コントロール:
  - 「回答受付開始」(waiting→active)
  - 「回答受付終了」(active→closed)
  - 状態バッジ: waiting=#F59E0B, active=#10B981, closed=#EF4444
- 回答数（大きな数字, リアルタイム更新）
- 「結果をリセット」ボタン（confirm付き）
- 「投影画面を開く」ボタン（新ウィンドウ）

右カラム（flex-grow: 1）:
- 全5問の横棒グラフ（Chart.js）
- 各質問: カード内にタイトル + グラフ
- 0件時は「まだ回答がありません」

#### リアルタイム
- Socket.IO: join-session → new-response でグラフ更新、session-reset でクリア

#### デザイン指示（admin.css）
- 背景: #F0F2F5
- カード: 白, border-radius: 12px, box-shadow
- 回答数: Inter 700, 3rem
- グラフバー色: ["#0F4C81", "#00D4AA", "#6C5CE7", "#F59E0B", "#EF4444", "#3B82F6"]
- barRadius: 6

#### JS
- sessionをlocalStorageに保存（リロード復帰）
- Chart.jsインスタンスを質問ごとに管理
- chart.update() でアニメーション更新

---

### 7. public/projection.html + css/projection.css + js/projection.js（会場投影スクリーン）

プロジェクターで大画面投影する画面。 /projection.html?s={sessionId}

#### 画面状態

**waiting 時（QRコード誘導）**
- 中央にQRコード大（400x400px）
- 「スマートフォンでQRコードを読み取ってください」
- 背景にゆっくりしたグラデーションアニメーション

**active / closed 時（結果表示）**
- 左上にQRコード小（途中参加用）
- 右上に回答数（カウントアップアニメーション付き）
- 5問の結果グリッド:
  - 上段: Q1, Q2, Q3（3カラム）
  - 下段: Q4, Q5（2カラム中央寄せ）
- 各質問: カード + 横棒グラフ

#### デザイン指示（projection.css）— ダークテーマ
- 背景: #0A0E27
- カード: rgba(255,255,255,0.06), backdrop-filter: blur(20px), border: 1px solid rgba(255,255,255,0.1)
- テキスト: #FFFFFF
- アクセント: #00D4AA
- グラフバー色: ["#00D4AA", "#6C5CE7", "#3B82F6", "#F59E0B", "#EF4444", "#EC4899"]
- barRadius: 8, barThickness: 28
- 背景演出: CSSの大きなradial-gradient円を2〜3個配置、ゆっくり動くアニメーション
- QRコードカード: グロー + パルスアニメーション
- 回答数: Inter 800, 4rem, #00D4AA, バウンスアニメーション
- 画面遷移: フェードアウト→フェードイン
- body: margin:0, overflow:hidden, 100vw x 100vh

#### JS
- Chart.jsダークテーマ: グリッドrgba(255,255,255,0.08)、ラベル白
- 回答数カウントアップ: requestAnimationFrame
- データラベル: バー右端に回答数を白文字（カスタム描画）

---

### 8. README.md

日本語で記述。以下の構成:
- タイトル「セミナー リアルタイム集計アンケート」
- 概要（1段落）
- 主な機能（箇条書き5項目）
- セットアップ手順（npm install → npm start）
- 使い方（6ステップ）
- 技術構成
- ライセンス: MIT

---

## 注意事項（実装担当への指示）
- CLAUDE.mdのコーディング標準に従うこと（セマンティックHTML、CSS変数、クリーンなJS）
- 各ページのHTMLには必ずcommon.cssと各ページ固有CSSの両方をlinkする
- Socket.IOは /socket.io/socket.io.js、Chart.jsは https://cdn.jsdelivr.net/npm/chart.js から読み込む
- CSSは TailwindなどのフレームワークではなくVanilla CSSで書く
- エラーハンドリングを適切に入れる
- console.logで主要操作をログ出力する
- publicディレクトリ構造は mkdir -p で事前に作成する
- すべてのファイルを作成し終えるまで完了報告しないこと
```

---

## Step 2: デザイン担当（Designer）

### 役割
実装担当が作ったCSSと HTMLを専門的な視点でレビューし、
プレミアムで洗練されたUIに引き上げる。機能やJSロジックには触れない。

### プロンプト

```
あなたはシニアUIデザイナー兼CSSスペシャリストです。
セミナー会場向けリアルタイム集計アンケートWebアプリの
デザイン品質を専門的にレビューし、CSSとHTMLの構造的改善を行ってください。

## 作業ディレクトリ
c:\work\Antigravity\seminar-survey\public

## 対象ファイル
- css/common.css
- css/survey.css
- css/admin.css
- css/projection.css
- index.html（構造的にデザインに影響する部分のみ）
- admin.html（同上）
- projection.html（同上）

## あなたの責務
JavaScriptやサーバーロジックには一切触れないこと。
CSS と HTML の構造・クラス名の改善のみを行う。
既存の機能を壊さないことを最優先とする。

## レビュー観点と改善指示

### 1. カラー・グラデーション
- 原色（純粋な赤青緑）が使われていないか
- グラデーションが自然で滑らかか
- コントラスト比がWCAG AA基準を満たしているか（テキストvs背景）
- ダークテーマ（投影画面）の可読性

### 2. タイポグラフィ
- Noto Sans JP + Inter が正しく読み込まれ適用されているか
- フォントウェイトの使い分けが適切か（太すぎ/細すぎがないか）
- 行間・字間が窮屈でないか
- 投影画面のフォントサイズが遠くから読める大きさか

### 3. スペーシング・レイアウト
- 余白が詰まりすぎ/空きすぎていないか
- カード間・セクション間のリズムが統一されているか
- モバイル（survey.css）のタップ領域が44px以上か
- 管理画面の2カラムレイアウトの比率

### 4. インタラクション・アニメーション
- ホバー/タップ時のフィードバックがあるか
- トランジションの duration が適切か（速すぎ/遅すぎ）
- アニメーションが品格のあるものか（チープな動きがないか）
- 投影画面の背景アニメーションが上品か

### 5. コンポーネント品質
- ボタンに適切なホバー・アクティブ・無効状態があるか
- カードのbox-shadowが自然か
- 選択肢UIの状態遷移（未選択→ホバー→選択→選択+ホバー）が明確か
- フォーム要素のfocus状態が見えるか（a11y）

### 6. 投影画面（最重要）
- グラスモーフィズムの半透明度が適切か
- 背景のグラデーション演出が映えるか
- QRコードのグロー効果
- グラフの配色がダーク背景で映えるか
- 全体の「会場で映える」印象

### 7. レスポンシブ
- survey.css: 320px〜480pxで崩れないか
- admin.css: 768px以下でカラム崩れしないか

## 出力形式
1. まず全CSSファイルを読み、問題点をリスト化する
2. 各ファイルを修正する
3. 最後に、改善した点のサマリーを出力する

## デザイン基準
- 「セミナー会場でプロジェクターに映しても恥ずかしくない」品質
- 「スマホで開いた瞬間に洗練されている」と感じるUI
- MVP感やテンプレート感は絶対にNG
- モダンなSaaSプロダクトや一流企業のイベントページを基準にする
```

---

## Step 3: QA担当（Reviewer）

### 役割
実装＋デザイン改善後のコード全体を第三者目線でレビューし、
バグ・整合性・品質の問題を洗い出して修正する。

### プロンプト

```
あなたはシニアQAエンジニア兼コードレビュアーです。
セミナー会場向けリアルタイム集計アンケートWebアプリの
全コードをレビューし、問題があれば修正してください。

## 作業ディレクトリ
c:\work\Antigravity\seminar-survey

## 対象ファイル
全ファイル（server.js, 全HTML, 全CSS, 全JS, package.json, README.md）

## レビュー観点

### 1. API整合性（最重要）
- server.jsのAPIエンドポイントと、各フロントエンドJSのfetchリクエストが一致しているか
  - URL パス
  - HTTPメソッド
  - リクエストボディの構造
  - レスポンスの構造（フロント側が期待するキー名とサーバーが返すキー名が一致するか）
- Socket.IOイベント名とペイロード構造がサーバーとクライアントで一致しているか

### 2. バリデーション
- サーバーサイドバリデーション:
  - single型で複数回答が送られた場合に弾くか
  - multiple型で空配列が送られた場合に弾くか
  - 存在しない選択肢が送られた場合に弾くか
  - 「使っていない」「分からない」と他選択肢の排他制御がサーバー側で検証されるか
  - activeでないセッションへの回答を弾くか
- クライアントサイドバリデーション:
  - 未回答での送信が防がれるか
  - 排他選択肢のUI制御が正しく動くか

### 3. 二重回答防止
- localStorageのキー名がサーバーとクライアントで整合しているか
- 回答済み判定が正しく動作するか
- localStorageがない環境（プライベートブラウズ）でエラーにならないか

### 4. WebSocket接続
- Socket.IOクライアントの読み込みパスが正しいか（/socket.io/socket.io.js）
- join-sessionが適切なタイミングで呼ばれるか
- 再接続時の処理があるか

### 5. エラーハンドリング
- fetch失敗時のユーザー通知
- 存在しないセッションIDへのアクセス時のUI
- サーバーエラー時の適切なHTTPステータスコード

### 6. HTMLの品質
- セマンティックタグの使用（header, main, section, footer）
- viewport metaタグの設定
- title、meta descriptionの設定
- 各ページでcommon.css + ページ固有CSSの両方がlinkされているか
- Chart.js、Socket.IOのscriptタグが正しいか

### 7. JavaScriptの品質
- グローバル変数の汚染がないか
- イベントリスナーの重複登録がないか
- メモリリーク（Chart.jsインスタンスの破棄漏れ等）がないか
- async/awaitのtry-catch

### 8. セキュリティ
- XSS: ユーザー入力がinnerHTMLに直接挿入されていないか
- 適切なContent-Type設定

### 9. README
- セットアップ手順が正確か
- 記載されたコマンドが実際に動くか

## 出力形式
1. まず全ファイルを読み、問題をカテゴリ別にリスト化する
2. 深刻度の高い順に修正する（Critical → Major → Minor）
3. 最後に、発見した問題と修正内容のサマリーを出力する

## 判断基準
- Critical: 動作しない、データが壊れる、セキュリティ脆弱性
- Major: 特定条件で動作不良、UX上の重大な問題
- Minor: コード品質、ベストプラクティスからの逸脱
```

---

## リーダー用 実行手順

### Step 0: プロジェクト準備
```bash
cd c:\work\Antigravity\seminar-survey
mkdir -p public/css public/js
```

### Step 1: 実装担当エージェントを起動
上記「Step 1: 実装担当」のプロンプトでエージェントを起動。
完了後、`npm install && npm start` で起動確認。

### Step 2: デザイン担当エージェントを起動
上記「Step 2: デザイン担当」のプロンプトでエージェントを起動。
完了後、ブラウザで3画面の見た目を確認。

### Step 3: QA担当エージェントを起動
上記「Step 3: QA担当」のプロンプトでエージェントを起動。
完了後、指摘内容を確認。

### Step 4: 最終確認（リーダー）
1. `npm start` でサーバー起動
2. /admin.html でセッション作成
3. /?s={id} でスマホ回答テスト
4. /projection.html?s={id} で投影画面確認
5. 問題なければ git init → commit → GitHub公開
