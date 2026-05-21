// /orders エンドポイントの定義。
// 購入1件 = Order レコード1つ + 複数の OrderItem レコード という親子構造。
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ─────────────────────────────────────────────────────
// GET /orders  注文一覧（ページング + 絞り込み対応）
//   クエリパラメータ:
//     ?userId=N                   … 特定ユーザーの履歴のみ
//     ?paymentMethod=xxx          … 支払い方法で絞る (cash_on_delivery など)
//     ?dateFrom=2026-01-01        … 売上日時の下限 (この日以降)
//     ?dateTo=2026-12-31          … 売上日時の上限 (この日以前)
//     ?page=N&pageSize=M          … N ページ目を M 件ずつ取得 (page は 0 始まり)
//
//   レスポンス形式 (page の有無で切り替え):
//     ?page= 無し       → Order[]                              (従来通りの配列・後方互換)
//     ?page= 有り       → { items: Order[], total: number }    (mat-paginator 用)
//
//   後方互換: Phase 9 で確立した「page が無ければ配列をそのまま返す」設計を踏襲。
// ─────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ─── クエリパラメータの取り出し ───
    const userIdParam = req.query.userId;
    const paymentMethodParam = req.query.paymentMethod;

    // ─── where 句を組み立てる ───
    // Prisma の where はオブジェクトを後から追加できる (JS のオブジェクトリテラル)
    // 必要な条件だけ条件付きで足していくスタイル
    const where: any = {};
    if (userIdParam) where.userId = Number(userIdParam);
    if (paymentMethodParam) where.paymentMethod = String(paymentMethodParam);

    // ─── 期間絞り込み (orderedAt の範囲指定) ───
    //
    // Prisma の比較演算子:
    //   gte (greater than or equal) = 「以上」
    //   lte (less than or equal)    = 「以下」
    // どちらも文字列ではなく Date オブジェクトを渡す必要があるため new Date(...) で変換する。
    // (Prisma は内部で SQL の >= / <= に変換してくれる)

    //日付絞り込み
    const dateFromParam  = req.query.dateFrom;
    const dateToParam    = req.query.dateTo;
    // 空オブジェクトから出発し、必要な条件だけ動的に追加するスタイル (上の where 句と同じ発想)
    const dateFilter: any = {};
    if (dateFromParam) dateFilter.gte = new Date(String(dateFromParam));  //期間の開始日
    if (dateToParam)   dateFilter.lte = new Date(String(dateToParam));    //期間の終了日
    // Object.keys(...).length でプロパティ数を数える。1 つでも条件があれば where に組み込む。
    //   両方未指定 (空オブジェクト) の場合は orderedAt 条件を追加せず、全件マッチさせる
    //   これをサボって where.orderedAt = {} を入れると Prisma が無駄な条件節を組み立ててしまう
    if (Object.keys(dateFilter).length > 0) where.orderedAt = dateFilter;


    // include: 一覧画面で「購入者名」「商品サマリ」を出すために必要
    //   user は password を含めないよう select で公開項目だけに絞る
    const include = {
      items: { include: { product: true } },
      user: { select: { id: true, name: true, email: true } },
    };

    // findMany の共通オプション (paginated / 非paginated で同じ where + include + orderBy を使うため切り出し)
    const queryBase = {
      where,
      include,
      orderBy: { orderedAt: 'desc' as const }, // 新しい注文が先頭
    };

    // ─── ページングモードの判定 (Phase 9 の後方互換設計を踏襲) ───
    const isPaginated = req.query.page !== undefined;

    if (isPaginated) {
      // page と pageSize を安全に数値化
      //   Math.max(0, ...) で負数防止 (skip がマイナスだと Prisma がエラー)
      //   Math.min(100, ...) で pageSize 上限 (巨大値で DB を壊されないための予防策)
      const page = Math.max(0, parseInt(String(req.query.page), 10) || 0);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 10));
      const skip = page * pageSize;
      const take = pageSize;

      // $transaction: items 取得と count を 1 トランザクションで実行 (整合性保証 + 速度)
      const [items, total] = await prisma.$transaction([
        prisma.order.findMany({ ...queryBase, skip, take }),
        prisma.order.count({ where }),
      ]);
      res.json({ items, total });
      return;
    }

    // 非 paginated モード: 従来通り全件を配列で返す (後方互換)
    const orders = await prisma.order.findMany(queryBase);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /orders/:id  1件取得  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    //idを数字に変換
    const id = Number(req.params.id);
    //idを条件に注文を探す
    const order = await prisma.order.findUnique({
      where:{id},
      include: {
        items: {
          include: { product: true }, // 注文明細→商品 と2段階で取得
        },
      },
    })
    //見つかれば返す
    if(!order){
      return res.status(404).json({
        error: 'Not Found',
      })
    }
    res.json(order);

  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /orders  注文作成  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId,paymentMethod,shippingAddress,items} = req.body;
    const productIds = items.map((i:any) => i.productId);
    const products = await prisma.product.findMany({
      where: { id:{in: productIds}},
    });

    //productIdをキー、商品オブジェクトを値にしたMapを作る
    //(ループの中で.find()を毎回呼ぶより速い & 読みやすい)
    const productMap = new Map(
      products.map((p) => [p.id, p])
    );

    type OrderItem = {
      productId: number;
      quantity: number;
      unitPrice: number;
    };

    //各OrderItemの確定データを組み立てる
    const orderItemsData: OrderItem[] = items.map((i: any) => {
      const product = productMap.get(i.productId);
      if (!product) {
        // バッククォートで囲むとテンプレートリテラルとなり ${...} が展開される
        throw new Error(`商品が見つかりません:productId=${i.productId}`);
      }

      return {
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: product.price, // DBから取得した「その時点の価格」をスナップショット保存
      };
    });

    //合計金額 = 各行(単価×数量)の合計
    const totalAmount = orderItemsData.reduce(
      (sum,item) => sum + item.unitPrice * item.quantity,
      0
    );

    const created = await prisma.order.create({
      data:{
        userId,
        paymentMethod,
        shippingAddress,
        totalAmount,
        items:{
          //ネステッドwrite;子テーブル(OrderItem)も同時に作る
          create:orderItemsData,
        },
      },
      include:{
        items: {
          include: { product: true }, // 注文明細→商品 と2段階で取得
        },
      }
  });
  res.status(201).json(created);
  } catch (err) {
    next(err);
  }


});

// 注: Order は履歴データなので、原則として更新・削除は提供しない設計が多い。
// 必要があれば PATCH /orders/:id/status のような状態変更APIを別途追加する。

export default router;
