# BLACKBOX-OpenAI-Proxy

BLACKBOX AI の API を OpenAI Response API および Chat Completions API に変換するプロキシサーバー。

## 📋 概要

このプロジェクトは、[BLACKBOX AI](https://www.blackbox.ai/) のバックエンド API をプロキシし、OpenAI と互換性のある REST API を提供します。TypeScript + Express で構築されており、ストリーミングレスポンスやツール呼び出し（Function Calling）をサポートしています。

### 主な機能

- OpenAI Response API 互換 - `/v1/responses` エンドポイント
- Chat Completions API 互換 - `/v1/chat/completions` エンドポイント
- モデル一覧取得 - `/v1/models` エンドポイント
- ストリーミングレスポンス - SSE (Server-Sent Events) 対応
- ツール呼び出し (Function Calling) - ツール定義のサポート
- ビジョン（画像）処理 - 画像 URL のサポート
- 多様なモデル - Claude、GPT、Gemini、Qwen など 200 以上のモデルを選択可能

## 🚀 クイックスタート

### 事前準備

- Node.js 20.x 以上
- npm または bun

### セットアップ

1. リポジトリをクローン
```bash
git clone <repository-url>
cd BLACKBOX-OpenAI-Proxy
```

2. 依存関係をインストール
```bash
npm install
```

3. `.env` ファイルを作成（`.env.example` を参考）
```bash
cp .env.example .env
```

4. サーバーを起動
```bash
# 開発モード（ホットリロード）
npm run dev

# 本番モード
npm run build
npm start
```

デフォルトでは `http://localhost:3000` で動作します。

## ⚙️ 設定（環境変数）

`.env` ファイルで以下の設定が可能です：

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `PORT` | `3000` | サーバーがリスンするポート |
| `BLACKBOX_API_ENDPOINT` | `https://app.blackbox.ai/api/chat` | BLACKBOX AI の API エンドポイント |
| `BLACKBOX_VALIDATION_TOKEN` | `''` | 認証トークン（必要な場合） |
| `BLACKBOX_MAX_TOKENS` | `1024` | 最大トーク数 |
| `BLACKBOX_CUSTOMER_ID` | `''` | サブスクライバー ID |
| `BLACKBOX_SESSION_TOKEN` | `''` | セッショントークン |
| `BLACKBOX_USER_SELECTED_AGENT` | `VscodeAgent` | デフォルトのエージェント |
| `CORS_ORIGINS` | `''` | 許可された CORS オリジン（カンマ区切り） |
| `DEBUG_LOG` | `false` | デバッグログを有効化 |
| `DEBUG_MAX_CHARS` | `10` | デバッグログの最大文字数 |

`BLACKBOX_SESSION_TOKEN` は有料アカウントを利用していない場合は必要ありません。
有料アカウントの場合は、開発者モードで以下のスクリプトを実行し、取得した値を入れてください。  
```js
console.log(JSON.parse(localStorage.getItem('subscription-cache') || '{}').customerId);
```

## 📚 API ドキュメント

### 1. モデル一覧取得

```
GET /v1/models
```

**レスポンス例:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "openai/gpt-5.2",
      "object": "model",
      "owned_by": "proxy"
    },
    {
      "id": "anthropic/claude-opus-4.6",
      "object": "model",
      "owned_by": "proxy"
    }
  ]
}
```

### 2. Chat Completions API

```
POST /v1/chat/completions
Content-Type: application/json
```

**リクエスト例:**
```json
{
  "model": "openai/gpt-5.2",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}
```

**レスポンス例:**
```json
{
  "id": "chatcmpl_xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "openai/gpt-5.2",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "proxy": {
    "responseTimeSec": 1.2,
    "raw": {...}
  }
}
```

#### ストリーミングモード

`stream: true` を指定すると、SSE (Server-Sent Events) でストリーミングレスポンスが取得できます。

### 3. Responses API (OpenAI Response API 互換)

```
POST /v1/responses
Content-Type: application/json
```

**リクエスト例:**
```json
{
  "model": "openai/gpt-5.2",
  "input": {
    {"role": "user", "content": "Hello!"}
  }
}
```

**レスポンス例:**
```json
{
  "id": "resp_xxx",
  "object": "response",
  "created_at": 1234567890,
  "status": "completed",
  "model": "openai/gpt-5.2",
  "output": [
    {
      "id": "msg_xxx",
      "type": "message",
      "status": "completed",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "Hello! How can I help you today?",
          "annotations": []
        }
      ]
    }
  ]
}
```

### 4. ツール呼び出し (Function Calling)

ツール定義を `tools` パラメータで指定できます。

レスポンスには `tool_calls` が含まれます：
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_xxx",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\": \"Tokyo\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

### 5. ビジョン（画像）サポート

画像 URL をメッセージに含めることで、視覚的な理解が可能です：

```json
{
  "model": "openai/gpt-5.2",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "Whats in this image?"},
        {
          "type": "image_url",
          "image_url": {"url": "https://example.com/image.jpg"}
        }
      ]
    }
  ]
}
```

## 🛠️ 利用可能なモデル

`pro`以上の課金アカウント利用時、200 以上のモデルをサポートしています。

### AI21
- `ai21/jamba-large-1.7`
- `ai21/jamba-mini-1.7`

### Amazon Nova
- `amazon/nova-pro-v1`
- `amazon/nova-lite-v1`
- `amazon/nova-micro-v1`

### Anthropic Claude
- `anthropic/claude-3.7-sonnet`
- `anthropic/claude-3.5-haiku`
- `anthropic/claude-opus-4.6`

### Google Gemini
- `google/gemini-3.1-pro-preview`
- `google/gemini-3-pro-preview`

### OpenAI
- `openai/gpt-5.4`
- `openai/gpt-5.3-codex`
- `openai/gpt-5.2`

### Qwen
- `qwen/qwen3-coder:free`
- `qwen/qwen3-32b`
- `qwen/qwen3-next-80b-a3b-thinking`

### その他
- `x-ai/grok-4`
- `z-ai/glm-4.6`
- `blackbox/free`: 無料アカウントでも利用可能です

など多数

## アーキテクチャ

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  BLACKBOX-Proxy  │────▶│  Blackbox AI    │
│ (OpenAI     │     │  (Express/TS)    │     │  Chat API       │
│  Client)    │     │                  │     │                 │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

### コンポーネント

- **`src/routes/v1/`** - API エンドポイント
  - `chat/chat.controller.ts` - Chat Completions API
  - `responses/responses.controller.ts` - Responses API
  - `models/models.controller.ts` - モデル一覧

- **`src/api/blackboxai.ts`** - BLACKBOX AI API との通信

- **`src/services/openai.ts`** - OpenAI 形式との変換ロジック

- **`src/utils/utils.ts`** - ユーティリティ関数（ID 生成、ストリーミング処理など）


## 謝辞

- [BLACKBOX AI](https://www.blackbox.ai/) - バックエンドAPI
- [OpenAI](https://openai.com/) - APIデザイン

---

> **注意**  
このプロキシは非公式です。  
BLACKBOX AI の利用条件に従って使用してください。
