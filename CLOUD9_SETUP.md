# Cloud9 セットアップ手順書

AWS Cloud9 (Amazon Linux 2 / Amazon Linux 2023) 上で本プロジェクトをデプロイし、外部 URL で公開するまでの完全手順です。

## 前提

- AWS アカウント取得済 (Cloud9 環境が作成済)
- Cloud9 IDE が起動できる状態
- 本リポジトリへのアクセス権がある (Public 公開済)

## 完成イメージ

```
[インターネット]
    ↓ http://ec2-xx-xx-xx-xx.compute.amazonaws.com/
[EC2 (Cloud9 の裏)] :80
    ↓
[Apache (httpd)]
    ├─ /            → /var/www/html/ (storefront)
    ├─ /backoffice/ → /var/www/html/backoffice/ (backoffice)
    ├─ /api/*       → reverse proxy → localhost:3000
    └─ /static/*    → reverse proxy → localhost:3000/static
         ↓
[Node.js (Express + PM2)] :3000
         ↓
[MariaDB] :3306
```

---

## ステップ 0: 環境確認

Cloud9 のターミナルで OS を確認:

```bash
cat /etc/os-release
```

- `Amazon Linux 2` → このまま手順通り (yum コマンド使用)
- `Amazon Linux 2023` → 同じく yum / dnf 互換
- `Ubuntu` 系 → `yum` を `apt-get` に、`httpd` を `apache2` に読み替え

## ステップ 1: パッケージインストール

```bash
# 1-1. システム更新
sudo yum update -y

# 1-2. Apache (httpd) + MariaDB + git
sudo yum install -y httpd mariadb-server git

# 1-3. Node.js 22 (Cloud9 標準は古いので nvm で入れ替え)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# 直近セッションで nvm を有効化
. ~/.nvm/nvm.sh
nvm install 22
nvm use 22
nvm alias default 22

# 1-4. バージョン確認
node -v   # → v22.x.x
npm -v    # → 10.x.x or 11.x.x
httpd -v  # → Apache/2.4.x
mariadb --version  # → mariadb Ver xxx
```

## ステップ 2: MariaDB 初期設定

```bash
# 2-1. MariaDB 起動 + 自動起動有効化
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 2-2. データベース作成 (パスワードなしの root で OK)
mysql -u root -e "CREATE DATABASE ec_practice CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"

# 2-3. 確認
mysql -u root -e "SHOW DATABASES;"
# → ec_practice が表示されれば OK
```

> ⚠️ 本番運用では root パスワード設定 (`sudo mysql_secure_installation`) が必要ですが、Cloud9 上の練習なら省略可。

## ステップ 3: リポジトリ clone + 依存インストール

```bash
# 3-1. プロジェクト clone (~/environment は Cloud9 のデフォルト作業ディレクトリ)
cd ~/environment
git clone https://github.com/IshidaKaimu-pascal/angular-ec-practice.git
cd angular-ec-practice

# 3-2. Angular workspace 側の依存
npm install

# 3-3. API 側の依存
cd api
npm install
cd ..
```

> 💡 `npm install` は計 10〜15 分かかります (Angular 側だけで 1000 パッケージ超)。

## ステップ 4: API の .env 設定 (本番用)

```bash
cd api
cp .env.example .env
# nano か vim で編集
nano .env
```

`.env` を以下の内容に書き換え:

```dotenv
# MariaDB (root パスワードなし)
DATABASE_URL="mysql://root:@localhost:3306/ec_practice"

# JWT 署名鍵 (必ずランダム値に書き換え)
JWT_SECRET="<openssl rand -hex 32 で生成した値>"

# CORS 許可オリジン (EC2 のパブリック DNS — ステップ 9 で確認)
CORS_ORIGIN=http://ec2-xx-xx-xx-xx.compute.amazonaws.com

# API ポート
PORT=3000

# 静的画像 URL ベース (空文字 → 相対 URL を返す)
STATIC_URL_BASE=
```

JWT_SECRET の生成 (Linux):

```bash
openssl rand -hex 32
```

> ⚠️ `STATIC_URL_BASE=` の **イコールの後ろは空** にすること。これで API が `/static/uploads/xxx.jpg` のような相対 URL を返すようになる。

## ステップ 5: DB マイグレーション + シード投入

```bash
cd ~/environment/angular-ec-practice/api

# 5-1. テーブル作成 (schema.prisma に基づく)
npx prisma migrate deploy

# 5-2. Prisma クライアント生成
npx prisma generate

# 5-3. 初期データ投入 (カテゴリ / 商品 / サンプル admin など)
npx tsx prisma/seed.ts

# 5-4. 確認
mysql -u root -e "USE ec_practice; SHOW TABLES;"
# → categories / products / users / admins / orders / order_items が表示されれば OK
```

## ステップ 6: API を PM2 で常駐起動

```bash
# 6-1. PM2 をグローバルインストール
npm install -g pm2

# 6-2. API を常駐起動 (api/ ディレクトリで)
cd ~/environment/angular-ec-practice/api
pm2 start "npm run dev" --name ec-api

# 6-3. EC2 再起動時に自動起動するよう設定
pm2 startup
# → 出力された sudo コマンドをコピペして実行
pm2 save

# 6-4. 状態確認
pm2 status
# → ec-api が online になっていれば OK

# 6-5. ログ確認
pm2 logs ec-api --lines 20
# → "API server listening on http://localhost:3000" が出ていれば OK
```

> 💡 PM2 = Node.js プロセスマネージャ。`tsx watch` だとセッション切れで死ぬが、PM2 配下にすると永続化される。

## ステップ 7: Angular 本番ビルド

```bash
cd ~/environment/angular-ec-practice

# 7-1. storefront ビルド (本番用設定で environment.prod.ts に差し替わる)
npm run build:storefront

# 7-2. backoffice ビルド (--base-href=/backoffice/ で配置パス対応)
npx ng build backoffice --base-href=/backoffice/

# 7-3. ビルド出力先を確認
ls dist/storefront/browser/    # → index.html, main-xxx.js などが存在
ls dist/backoffice/browser/    # → 同上
```

> 💡 ビルドは計 5〜10 分かかります。

## ステップ 8: Apache に静的ファイルを配置

```bash
# 8-1. /var/www/html を一旦空にする (Apache デフォルトの welcome ページを除去)
sudo rm -rf /var/www/html/*

# 8-2. storefront を /var/www/html/ に配置
sudo cp -r dist/storefront/browser/* /var/www/html/

# 8-3. backoffice を /var/www/html/backoffice/ に配置
sudo mkdir -p /var/www/html/backoffice
sudo cp -r dist/backoffice/browser/* /var/www/html/backoffice/

# 8-4. .htaccess を配置 (SPA fallback)
sudo cp htaccess-storefront /var/www/html/.htaccess
sudo cp htaccess-backoffice /var/www/html/backoffice/.htaccess

# 8-5. Apache の設定ファイルを配置
sudo cp apache-ec-practice.conf /etc/httpd/conf.d/ec-practice.conf

# 8-6. Apache 起動 + 自動起動
sudo systemctl start httpd
sudo systemctl enable httpd

# 8-7. 設定 syntax チェック
sudo httpd -t
# → "Syntax OK" が出れば成功

# 8-8. もし以下のような mod_proxy 関連エラーが出たら有効化:
#   "Invalid command 'ProxyPass', perhaps misspelled or defined by a module not included"
# →
#   sudo dnf install -y mod_proxy_html  # (AL2023)
# あるいは httpd の Listen が 80 でない場合は /etc/httpd/conf/httpd.conf を確認

# 8-9. 設定を反映
sudo systemctl restart httpd
```

## ステップ 9: EC2 のパブリック DNS とセキュリティグループ設定

### 9-1. EC2 のパブリック DNS を確認

```bash
# EC2 メタデータサービスから取得
curl -s http://169.254.169.254/latest/meta-data/public-hostname
# → ec2-xx-xx-xx-xx.compute.amazonaws.com のような値が出る
```

または:
- AWS マネジメントコンソール → EC2 → 「インスタンス」
- Cloud9 と同名のインスタンスを選択
- 「パブリック IPv4 DNS」欄をコピー

### 9-2. .env の CORS_ORIGIN を更新

```bash
nano ~/environment/angular-ec-practice/api/.env
# CORS_ORIGIN=http://ec2-xx-xx-xx-xx.compute.amazonaws.com に変更
```

API を再起動して反映:

```bash
pm2 restart ec-api
```

### 9-3. セキュリティグループに 80 番ポート開放

AWS マネジメントコンソールで:

1. **EC2 → インスタンス** から Cloud9 のインスタンスを選択
2. 下部タブ「**セキュリティ**」 → 「セキュリティグループ」のリンクをクリック
3. 「**インバウンドルール**」タブ → 「**インバウンドルールを編集**」
4. 「**ルールを追加**」をクリック
5. 設定値:
   - タイプ: **HTTP**
   - プロトコル: **TCP** (自動)
   - ポート範囲: **80** (自動)
   - ソース: **Anywhere-IPv4** (`0.0.0.0/0`)
6. 「**ルールを保存**」

> ⚠️ Anywhere-IPv4 は誰でもアクセス可能なので、テスト/デモ用途のみ。本番運用は IP 制限推奨。

### 9-4. Cloud9 のオートスリープ無効化 (任意)

デフォルトでは 30 分操作しないと EC2 が停止し、URL も停止する:

1. AWS マネジメントコンソール → **Cloud9 → 環境** → 対象環境を選択
2. 「設定」→ 「**インスタンスの停止までの時間**」を **Never** に変更

> ⚠️ Never にすると EC2 が起動しっぱなしになるため課金注意 (t2.micro なら月数百円)。

## ステップ 10: 動作確認

ブラウザで以下にアクセス:

| URL | 期待される表示 |
|---|---|
| `http://ec2-xx-xx-xx-xx.compute.amazonaws.com/` | storefront のトップページ |
| `http://ec2-xx-xx-xx-xx.compute.amazonaws.com/products` | 商品一覧 (シードデータが表示) |
| `http://ec2-xx-xx-xx-xx.compute.amazonaws.com/backoffice/` | backoffice のサインイン画面 |
| `http://ec2-xx-xx-xx-xx.compute.amazonaws.com/api/categories` | JSON でカテゴリ一覧 |
| `http://ec2-xx-xx-xx-xx.compute.amazonaws.com/api/` | `{"ok":true,...}` |

backoffice 用の初期 admin はシードで投入済 (詳細は `api/prisma/seed.ts` 参照)。

## トラブルシューティング

### 商品一覧が真っ白 (API エラー)

```bash
# API ログを確認
pm2 logs ec-api --lines 50

# Apache ログを確認
sudo tail -50 /var/log/httpd/ec-practice-error.log
sudo tail -50 /var/log/httpd/ec-practice-access.log
```

よくある原因:
- **CORS エラー**: `.env` の `CORS_ORIGIN` が EC2 の DNS と一致してない → 修正後 `pm2 restart ec-api`
- **DB 接続失敗**: MariaDB が止まっている → `sudo systemctl status mariadb`
- **Prisma エラー**: `npx prisma generate` 未実行 → api/ で再実行

### 画像が表示されない

- API レスポンスを確認 (DevTools の Network タブ): `imageUrl` が `/static/...` の相対 URL になっているか
- 絶対 URL (`http://localhost:3000/...`) が返ってきていたら `.env` の `STATIC_URL_BASE=` が空文字になっているか確認

### リロードすると 404 になる

- `.htaccess` が反映されていない
- `/etc/httpd/conf.d/ec-practice.conf` の `AllowOverride All` が無効
- mod_rewrite が無効: `sudo httpd -M | grep rewrite` で確認

### Apache が起動しない

```bash
sudo systemctl status httpd
sudo httpd -t   # syntax チェック
```

ポート 80 が他のプロセスに使われている可能性:

```bash
sudo ss -tlnp | grep ':80'
```

## 運用 Tips

- **API ログを常時監視**: `pm2 logs ec-api -f`
- **API 再起動**: `pm2 restart ec-api`
- **Apache 再読み込み**: `sudo systemctl reload httpd` (再起動より軽い)
- **DB バックアップ**: `mysqldump -u root ec_practice > backup.sql`
- **コード更新時**:
  1. `git pull`
  2. `npm install` (依存変わってれば)
  3. API 側変更 → `pm2 restart ec-api`
  4. Angular 側変更 → 再ビルド + `/var/www/html/` に再配置

## クリーンアップ (撤収手順)

公開を止める場合:

```bash
sudo systemctl stop httpd
sudo systemctl disable httpd
pm2 stop ec-api
pm2 delete ec-api
pm2 unstartup
```

EC2 自体を停止すれば課金は止まる (ストレージ料金のみ残る)。
