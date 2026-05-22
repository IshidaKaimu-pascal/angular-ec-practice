# Angular EC Practice

Angular + Express + Prisma + MariaDB で構築した、学習用の小規模 EC サイトです。
顧客向けフロント (storefront) と管理者向けフロント (backoffice)、共通の REST API の 3 構成で動きます。

## 構成

```
angular_ec_practice/
├── projects/
│   ├── storefront/   顧客向けフロント (商品閲覧 / カート / 購入 / 注文履歴)
│   ├── backoffice/   管理者向けフロント (カテゴリ / 商品 / ユーザー / 注文 の CRUD)
│   └── shared/       両フロント共通モデル (Category / Product / User / Order ...)
├── api/              REST API (Express + Prisma)
│   ├── prisma/       スキーマ / マイグレーション / シード
│   ├── public/       静的配信 (商品画像 / アップロード画像)
│   └── src/          ルーター / 認証ミドルウェア / JWT 発行
└── angular.json      Angular workspace 設定 (multi-project)
```

## 前提環境

- **Node.js** 20 以上 (推奨: 22 系)
- **npm** 11 系
- **XAMPP の MariaDB** (デフォルト構成: port 3306 / user `root` / password 空)
  - phpMyAdmin で `ec_practice` データベースを **事前に作成しておくこと**
  - 別ポート/別ユーザーを使う場合は `api/.env` の `DATABASE_URL` を書き換える

## セットアップ手順

### 1. リポジトリ取得と依存インストール

```powershell
git clone <このリポジトリの URL>
cd angular_ec_practice

# Angular workspace 側
npm install

# API 側
cd api
npm install
cd ..
```

### 2. 環境変数ファイルの準備

`api/.env` はリポジトリに含まれていません。雛形 `api/.env.example` をコピーして作成します。

```powershell
cd api
cp .env.example .env
```

`api/.env` を開き、以下を確認・編集してください:

| 変数 | 用途 | デフォルト値の扱い |
|---|---|---|
| `DATABASE_URL` | MariaDB 接続文字列 | XAMPP 標準構成ならそのまま使用可 |
| `JWT_SECRET` | JWT 署名用秘密鍵 | **必ずランダム文字列に書き換える** |

`JWT_SECRET` の生成例 (PowerShell):

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 3. DB マイグレーション + シード投入

`api/` ディレクトリで実行:

```powershell
# テーブル作成 (schema.prisma に従って ec_practice DB に CREATE TABLE)
npx prisma migrate deploy

# Prisma クライアント生成 (TypeScript 型定義の生成)
npx prisma generate

# 初期データ投入 (カテゴリ・商品・サンプル admin など)
npx tsx prisma/seed.ts
```

## 起動方法

ルートディレクトリ (`angular_ec_practice/`) で実行します。

### 開発時の同時起動 (推奨)

```powershell
# API + storefront を同時起動
npm run dev

# API + backoffice を同時起動
npm run dev:backoffice

# API + storefront + backoffice を全部同時起動
npm run dev:all
```

### 個別起動

```powershell
npm run dev:api              # API のみ (tsx watch)
npm run start:storefront     # storefront のみ
npm run start:backoffice     # backoffice のみ
```

## ポート構成

| サービス | URL |
|---|---|
| storefront (顧客側) | http://localhost:4200 |
| backoffice (管理者側) | http://localhost:4201 |
| REST API | http://localhost:3000 |

## 認証

- **storefront** — メールアドレス + パスワードで sign-up / sign-in。未サインインでもカートに追加可能で、購入確定時に sign-in を要求する Cart-aware フローを採用
- **backoffice** — `Admin` テーブルに登録された管理者アカウントで sign-in。初回は `/admin-signup` 画面から admin を作成可能
- 認証成功時に **JWT** を発行し、以降のリクエストは `Authorization: Bearer <token>` で送信

## 実装済機能

### storefront (顧客側)

- 商品一覧 / 商品詳細
- カート (未サインインでも利用可、サインイン跨ぎで保持)
- checkout (購入確定)
- 注文履歴 (期間絞り込み付き)
- sign-up / sign-in / パスワード変更 / ユーザー設定

### backoffice (管理者側)

- カテゴリ / 商品 / ユーザー / 注文 の CRUD
- 一覧画面の **検索機能** (RxJS の debounceTime + switchMap + combineLatest)
- 一覧画面の **サーバー側ページング** (Subject トリガー + Paged<T> + mat-paginator + skip/take)
- 商品画像の **アップロード** (multer + ローカル静的配信)

## 技術スタック

| 領域 | 技術 |
|---|---|
| Frontend | Angular 21 / Angular Material / RxJS 7 |
| Backend | Express 5 / Prisma 7 / JWT (jsonwebtoken) / bcrypt / multer |
| DB | MariaDB (MySQL 互換) |
| Workspace | Angular CLI multi-project workspace |
| Test runner | Vitest (Angular CLI 経由) |

## トラブルシューティング

- **`npx prisma migrate deploy` で接続エラー** → XAMPP の MySQL/MariaDB が起動しているか、`ec_practice` DB が作成済みか、`api/.env` の `DATABASE_URL` を確認
- **`Cannot find module '@prisma/client'`** → `api/` で `npx prisma generate` を再実行 (`.gitignore` 除外のため clone 直後は未生成)
- **ポート競合** → 4200/4201/3000 の使用状況を確認。別ポートで起動したい場合は `--port` オプションを付与
