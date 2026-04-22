# ReadMaster - 英語長文学習アプリ

英文を貼り付けると、AIが内容理解テストと語彙チェックを自動生成するWebアプリです。

## 機能
- 📖 内容理解テスト（4択クイズ×4問）
- 📝 語彙チェック（重要単語8語のフラッシュカード）
- AIによる自動問題生成（Claude API使用）

## セットアップ

```bash
npm install
npm run dev
```

## デプロイ（GitHub + Vercel）

1. GitHubにリポジトリを作成してpush
2. Vercelでリポジトリをインポート
3. Vercelの環境変数に `ANTHROPIC_API_KEY` を設定

詳しい手順はClaude.aiでの会話を参照してください。
