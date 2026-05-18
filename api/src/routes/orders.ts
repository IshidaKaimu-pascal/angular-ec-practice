// /orders エンドポイントの定義。
// 購入1件 = Order レコード1つ + 複数の OrderItem レコード という親子構造。
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ─────────────────────────────────────────────────────
// GET /orders  注文一覧（完成例）
//   クエリ ?userId=1 で「特定ユーザーの購入履歴」として絞り込み可能
//   購入履歴画面で必要な「商品イメージ・商品名」も include で一緒に取得
// ─────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userIdParam = req.query.userId;
    const where = userIdParam ? { userId: Number(userIdParam) } : {};

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: { product: true }, // 注文明細→商品 と2段階で取得
        },
      },
      orderBy: { orderedAt: 'desc' }, // 新しい注文が先頭
    });
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
