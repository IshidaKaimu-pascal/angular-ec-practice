// ============================================================
// シードスクリプト: テスト用の初期データを DB に投入する
// ------------------------------------------------------------
// 実行コマンド:
//   cd api
//   npx prisma db seed
//
// このスクリプトがやること:
//   1. 既存データを全削除 (外部キー制約に注意)
//   2. Category / Product / User / Admin / Order / OrderItem を投入
//   3. 全 User の password は bcrypt でハッシュ化済み (Phase 7-A-2 対応)
//
// 注意:
//   - 本番DBでは絶対に実行しないこと (全データが消えます)
//   - Prisma v7 のアダプター方式に合わせて src/prisma.ts のシングルトンを再利用
// ============================================================

import { prisma } from '../src/prisma';
import bcrypt from 'bcrypt';

// bcrypt のソルトラウンド数 (users.ts と揃える)
const SALT_ROUNDS = 10;

// テスト用の共通パスワード (全 customer 共通でログイン可能)
const CUSTOMER_PASSWORD = 'password123';
const ADMIN_PASSWORD = 'admin123';

// ============================================================
// _placeholderImage: placehold.co の画像URLを組み立てるヘルパー
// ------------------------------------------------------------
// 【将来用に保管】現在は全商品が Unsplash の実画像を imageUrl に持つため未使用。
// 新商品を仮画像で投入したい時にすぐ流用できるよう、関数と定数は残してある。
// アンダースコア "_" 始まりにすることで TypeScript の未使用警告を抑止している
// (TS の慣例: "_" 始まりの識別子は「未使用でも意図的」とみなされる)。
//
// placehold.co は「文字入り仮画像」を生成してくれる無料サービス。
//
// URL構文: https://placehold.co/{width}x{height}/{bgColor}/{textColor}?text={text}
//   bgColor / textColor は HEX (# は付けない)
//   text は URLエンコードして渡す (日本語や記号を含む場合の事故防止)
//
// 引数:
//   name: 画像内に描く文字 (商品名そのままを入れる)
//   bg:   背景色 (HEX 6桁、# 抜き)。カテゴリごとに変えて視認性アップ
// ============================================================
const _placeholderImage = (name: string, bg: string): string =>
  `https://placehold.co/400x300/${bg}/333333?text=${encodeURIComponent(name)}`;

// ============================================================
// カテゴリ別の背景色 (薄めの色で文字が読みやすいように)
//   毛糸 → 薄い赤系   FFCDD2
//   布地 → 薄い青系   BBDEFB
//   道具 → 薄い緑系   C8E6C9
// 【将来用に保管】上記 _placeholderImage と組で使う想定。同じくアンダースコア始まり。
// ============================================================
const _BG_KEITO = 'FFCDD2';
const _BG_NUNO = 'BBDEFB';
const _BG_DOUGU = 'C8E6C9';

// ============================================================
// main: シード処理の本体
//   - async 関数として定義し、最後に main().catch(...).finally(...) で実行
//   - try/catch ではなく、Promise の catch でエラーを拾う方式 (Prisma 公式パターン)
// ============================================================
async function main() {
  console.log('シード開始...');

  // ----------------------------------------------------------
  // 1. 既存データを全削除
  //   外部キー制約があるため、削除順序を間違えると P2003 エラーになる
  //
  //   依存関係 (X → Y は「X が Y を参照している」):
  //     OrderItem → Order, Product
  //     Order     → User
  //     Product   → Category
  //     User      (独立、ただし Order から参照される)
  //     Category  (独立、ただし Product から参照される)
  //     Admin     (独立、誰からも参照されない)
  //
  //   削除は「子から親へ」: 自分を参照しているデータを先に消す必要がある
  // ----------------------------------------------------------
  console.log('既存データを削除中...');
  
  // 依存関係の逆順で削除
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.admin.deleteMany();

  // ----------------------------------------------------------
  // 2. Category 投入 (3 件: 手芸用品ジャンル)
  //   displayOrder: 一覧画面での並び順 (小さい値ほど先に表示)
  //
  //   ⚠️ 重要: Promise.all で並列投入すると、DB コネクションの取り合いで
  //   id の発番順がコードの配列順と一致しない場合がある (毛糸が id=3 になったり)。
  //   ここでは逐次 await にすることで id を 1=毛糸 / 2=布地 / 3=道具 に固定する。
  //   後段の Product を categoryId 順に並べたい時、Category の id が安定していないと
  //   ソート結果も揺れるため。
  // ----------------------------------------------------------
  console.log('Category 投入中...');
  const keito = await prisma.category.create({ data: { name: '毛糸', displayOrder: 1 } });
  const nuno  = await prisma.category.create({ data: { name: '布地', displayOrder: 2 } });
  const dougu = await prisma.category.create({ data: { name: '道具', displayOrder: 3 } });

  // ----------------------------------------------------------
  // 3. Product 投入 (18 件: 各カテゴリ 6 件ずつ)
  //   各 Product は categoryId で Category と紐付ける
  //
  //   ⚠️ Category と同じ理由で Promise.all → 逐次 await に変更。
  //   配列リテラル内に await を並べると、JS は左から右へ順に評価するので
  //   結果的に「商品 id がコード上の並び順 (1〜18) で発番される」状態になる。
  //   これと API 側の orderBy: [{ categoryId }, { id }] が組み合わさることで、
  //   storefront 一覧が「毛糸6 → 布地6 → 道具6」の順に綺麗に並ぶ。
  //
  //   画像は既存 9 枚 (api/public/products/*.jpg) をカテゴリ内で 2 周ローテーション。
  //   追加 9 件用の新規画像ファイルは用意せず、同カテゴリの既存画像を使い回している。
  // ----------------------------------------------------------
  console.log('Product 投入中...');
  // imageUrl は API サーバー (Express) が配信するローカル画像の URL。
  //   実体: api/public/products/*.jpg
  //   配信: app.use('/static', express.static(api/public)) → /static/products/xxx.jpg
  //
  // STATIC_URL_BASE 環境変数で URL のプレフィックスを切替 (uploads.ts と同じ仕様):
  //   - 未設定: 'http://localhost:3000' をデフォルト (ローカル開発時)
  //   - 空文字 (本番 Cloud9 等): 相対 URL '/static/products/xxx.jpg' で投入
  //   - 任意の値: そのドメイン配下で投入
  const staticUrlBase = process.env.STATIC_URL_BASE ?? 'http://localhost:3000';
  const STATIC_BASE = `${staticUrlBase}/static/products`;
  const products = [
    // ── 毛糸 (6件) ─────────────────────────────────────
    await prisma.product.create({ data: { name: '並太毛糸（赤）500g',         price: 1800, stock: 30, categoryId: keito.id, imageUrl: `${STATIC_BASE}/yarn-red-500g.jpg` } }),
    await prisma.product.create({ data: { name: '極太毛糸（生成）300g',       price: 1500, stock: 25, categoryId: keito.id, imageUrl: `${STATIC_BASE}/yarn-ecru-300g.jpg` } }),
    await prisma.product.create({ data: { name: '段染め毛糸（青系）100g',     price:  800, stock: 50, categoryId: keito.id, imageUrl: `${STATIC_BASE}/yarn-blue-100g.jpg` } }),
    await prisma.product.create({ data: { name: 'モヘア毛糸（ピンク）50g',    price: 1200, stock: 40, categoryId: keito.id, imageUrl: `${STATIC_BASE}/yarn-red-500g.jpg` } }),
    await prisma.product.create({ data: { name: 'アクリル毛糸（黒）200g',     price: 1000, stock: 35, categoryId: keito.id, imageUrl: `${STATIC_BASE}/yarn-ecru-300g.jpg` } }),
    await prisma.product.create({ data: { name: '並太毛糸（紺）500g',         price: 1800, stock: 28, categoryId: keito.id, imageUrl: `${STATIC_BASE}/yarn-blue-100g.jpg` } }),
    // ── 布地 (6件) ─────────────────────────────────────
    await prisma.product.create({ data: { name: 'コットン無地（白）1m',       price: 1200, stock: 40, categoryId: nuno.id,  imageUrl: `${STATIC_BASE}/cotton-white-1m.jpg` } }),
    await prisma.product.create({ data: { name: '綿麻チェック柄 1m',           price: 2200, stock: 20, categoryId: nuno.id,  imageUrl: `${STATIC_BASE}/cotton-check-1m.jpg` } }),
    await prisma.product.create({ data: { name: 'リネン生地（ベージュ）1m',   price: 2800, stock: 15, categoryId: nuno.id,  imageUrl: `${STATIC_BASE}/linen-beige-1m.jpg` } }),
    await prisma.product.create({ data: { name: 'フランネル起毛（グレー）1m', price: 1800, stock: 22, categoryId: nuno.id,  imageUrl: `${STATIC_BASE}/cotton-white-1m.jpg` } }),
    await prisma.product.create({ data: { name: 'デニム生地（インディゴ）1m', price: 2400, stock: 18, categoryId: nuno.id,  imageUrl: `${STATIC_BASE}/cotton-check-1m.jpg` } }),
    await prisma.product.create({ data: { name: 'ガーゼ生地（白）1m',           price:  900, stock: 30, categoryId: nuno.id,  imageUrl: `${STATIC_BASE}/linen-beige-1m.jpg` } }),
    // ── 道具 (6件) ─────────────────────────────────────
    await prisma.product.create({ data: { name: '裁ちばさみ',                  price: 4500, stock: 10, categoryId: dougu.id, imageUrl: `${STATIC_BASE}/fabric-scissors.jpg` } }),
    await prisma.product.create({ data: { name: '編み針セット（5〜10号）',    price: 3800, stock: 12, categoryId: dougu.id, imageUrl: `${STATIC_BASE}/knitting-needles.jpg` } }),
    await prisma.product.create({ data: { name: 'まち針セット（100本入）',    price:  600, stock: 80, categoryId: dougu.id, imageUrl: `${STATIC_BASE}/sewing-pins.jpg` } }),
    await prisma.product.create({ data: { name: 'クロバー目打ち',             price: 1500, stock: 25, categoryId: dougu.id, imageUrl: `${STATIC_BASE}/fabric-scissors.jpg` } }),
    await prisma.product.create({ data: { name: 'ロータリーカッター 45mm',    price: 2800, stock: 15, categoryId: dougu.id, imageUrl: `${STATIC_BASE}/knitting-needles.jpg` } }),
    await prisma.product.create({ data: { name: 'ピンクッション',             price:  700, stock: 50, categoryId: dougu.id, imageUrl: `${STATIC_BASE}/sewing-pins.jpg` } }),
  ];

  // ----------------------------------------------------------
  // 4. User (customer) 投入 (5 件)
  //   全員 共通パスワード "password123" でログインできる (練習用)
  //   bcrypt.hash は重い処理のため、ハッシュ生成は 1 回だけ実行して使い回す
  // ----------------------------------------------------------
  console.log('User 投入中...');
  const hashedCustomerPassword = await bcrypt.hash(CUSTOMER_PASSWORD, SALT_ROUNDS);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: '田中ゆうこ',
        email: 'tanaka@test.com',
        password: hashedCustomerPassword,
        role: 'customer',
        address: '東京都新宿区1-2-3',
        phone: '090-1234-5678',
      },
    }),
    prisma.user.create({
      data: {
        name: '山田太郎',
        email: 'yamada@test.com',
        password: hashedCustomerPassword,
        role: 'customer',
        address: '大阪府大阪市2-3-4',
        phone: '080-2345-6789',
      },
    }),
    prisma.user.create({
      data: {
        name: '佐藤花子',
        email: 'sato@test.com',
        password: hashedCustomerPassword,
        role: 'customer',
        address: '愛知県名古屋市3-4-5',
        phone: '070-3456-7890',
      },
    }),
    prisma.user.create({
      data: {
        name: '鈴木一郎',
        email: 'suzuki@test.com',
        password: hashedCustomerPassword,
        role: 'customer',
        address: '福岡県福岡市4-5-6',
        phone: '090-4567-8901',
      },
    }),
    prisma.user.create({
      data: {
        name: '高橋美咲',
        email: 'takahashi@test.com',
        password: hashedCustomerPassword,
        role: 'customer',
        address: '北海道札幌市5-6-7',
        phone: '080-5678-9012',
      },
    }),
    // 公開デモ用のテストアカウント (Cloud9 デプロイ後の動作確認に使用)
    prisma.user.create({
      data: {
        name: 'テストユーザー',
        email: 'user@test.jp',
        password: hashedCustomerPassword,
        role: 'customer',
        address: '東京都千代田区0-0-0',
        phone: '090-0000-0000',
      },
    }),
  ]);

  // ----------------------------------------------------------
  // 5. Admin 投入 (1 件)
  //   admin@test.com / admin123 でログイン可能
  // ----------------------------------------------------------
  console.log('Admin 投入中...');
  const hashedAdminPassword = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
  await prisma.admin.create({
    data: {
      name: '管理者',
      email: 'admin@test.com',
      password: hashedAdminPassword,
    },
  });
  // 公開デモ用のテスト admin (Cloud9 デプロイ後の動作確認に使用)
  await prisma.admin.create({
    data: {
      name: 'テスト管理者',
      email: 'admin@test.jp',
      password: hashedAdminPassword,
    },
  });

  // ----------------------------------------------------------
  // 6. Order + OrderItem 投入 (3 件)
  //   ネストした create で Order と OrderItem を一度に作る (Prisma の便利機能)
  //   items.create に配列を渡すと、親 Order の作成と同時に子 OrderItem も作成される
  // ----------------------------------------------------------
  console.log('Order + OrderItem 投入中...');

  // 注文1: 田中ゆうこ → 並太毛糸 + 編み針セット (編み物セット)
  //   products[0]  = 並太毛糸（赤）500g
  //   products[13] = 編み針セット（5〜10号)  ※18件配列での新しい位置
  await prisma.order.create({
    data: {
      userId: users[0].id,
      totalAmount: 1800 + 3800,
      paymentMethod: 'credit_card',
      shippingAddress: '東京都新宿区1-2-3',
      items: {
        create: [
          { productId: products[0].id,  quantity: 1, unitPrice: 1800 },
          { productId: products[13].id, quantity: 1, unitPrice: 3800 },
        ],
      },
    },
  });

  // 注文2: 山田太郎 → 裁ちばさみ
  //   products[12] = 裁ちばさみ  ※道具カテゴリの先頭が index 12
  await prisma.order.create({
    data: {
      userId: users[1].id,
      totalAmount: 4500,
      paymentMethod: 'cash_on_delivery',
      shippingAddress: '大阪府大阪市2-3-4',
      items: {
        create: [
          { productId: products[12].id, quantity: 1, unitPrice: 4500 },
        ],
      },
    },
  });

  // 注文3: 佐藤花子 → コットン無地 + リネン生地 (洋裁セット)
  //   products[6] = コットン無地（白）1m  ※布地カテゴリの先頭が index 6
  //   products[8] = リネン生地（ベージュ）1m
  await prisma.order.create({
    data: {
      userId: users[2].id,
      totalAmount: 1200 + 2800,
      paymentMethod: 'credit_card',
      shippingAddress: '愛知県名古屋市3-4-5',
      items: {
        create: [
          { productId: products[6].id, quantity: 1, unitPrice: 1200 },
          { productId: products[8].id, quantity: 1, unitPrice: 2800 },
        ],
      },
    },
  });

  // ----------------------------------------------------------
  // 完了ログ
  // ----------------------------------------------------------
  console.log('');
  console.log('シード完了!');
  console.log('  Category : 3 件');
  console.log('  Product  : 18 件 (各カテゴリ 6 件)');
  console.log('  User     : 6 件 (customer)');
  console.log('  Admin    : 2 件');
  console.log('  Order    : 3 件');
  console.log('');
  console.log('ログイン情報:');
  console.log(`  customer: tanaka@test.com / ${CUSTOMER_PASSWORD} (他5名も同パスワード)`);
  console.log(`  customer (公開デモ用): user@test.jp / ${CUSTOMER_PASSWORD}`);
  console.log(`  admin   : admin@test.com / ${ADMIN_PASSWORD}`);
  console.log(`  admin   (公開デモ用): admin@test.jp / ${ADMIN_PASSWORD}`);
}

// ============================================================
// 実行: main() を呼び出し、終了時に必ず disconnect する
//   - .catch: シード失敗時は console.error + 終了コード 1 でプロセスを止める
//   - .finally: 成功失敗にかかわらず DB 接続をクローズ (接続リーク防止)
// ============================================================
main()
  .catch((e) => {
    console.error('シード失敗:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
