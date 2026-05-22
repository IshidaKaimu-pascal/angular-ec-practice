// /products エンドポイントの定義。
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ─────────────────────────────────────────────────────
// GET /products  商品一覧（商品名検索 + カテゴリフィルタ + ページング対応）
//   クエリパラメータ:
//     ?categoryId=1               … カテゴリ絞り込み
//     ?q=xxx                      … name に xxx を含む商品だけに絞り込み
//     ?page=N&pageSize=M          … N ページ目を M 件ずつ取得 (page は 0 始まり)
//     上記の組み合わせは全て AND 結合される
//
//   レスポンス形式 (page の有無で切り替え):
//     ?page= 無し → Product[] (従来通りの配列)
//     ?page= 有り → { items: Product[], total: number }
// ─────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryIdParam = req.query.categoryId;
    // q (検索キーワード): string であることを確認 + 前後空白除去
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    // ─── where 条件を組み立てる ───
    // Prisma の where はオブジェクトのキーが AND 結合される。
    // 条件があるときだけキーを足していくのが定石。
    const where: any = {};

    if (categoryIdParam) {
      where.categoryId = Number(categoryIdParam);
    }

    if (q) {
      // name に q を含む商品で絞り込み (LIKE '%q%')
      where.name = { contains: q };
    }

    // findMany の共通オプション (paginated / 非paginated で同じ条件を使うため切り出し)
    //
    // orderBy は配列で「複数キーソート」を指定できる (左から優先度高)。
    //   ① categoryId 昇順 … カテゴリごとに商品が連続して並ぶ (毛糸=1 → 布地=2 → 道具=3)
    //   ② id 昇順         … 同カテゴリ内では追加順 (seed.ts の並び順) を保つ
    // これにより storefront 一覧が 6 件/ページのとき「毛糸6 → 布地6 → 道具6」と
    // カテゴリごとに 1 ページずつ綺麗にまとまる。
    const queryBase = {
      where,
      include: { category: true }, // カテゴリ情報も一緒に取得
      orderBy: [
        { categoryId: 'asc' as const },
        { id: 'asc' as const },
      ],
    };

    // ─── ページングモードの判定 ───
    // ?page= が URL に含まれていればページング有効
    const isPaginated = req.query.page !== undefined;

    if (isPaginated) {
      // page / pageSize の安全な解釈 (NaN → 0/10、負数防止、上限 100)
      const page = Math.max(0, parseInt(String(req.query.page), 10) || 0);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 10));

      // $transaction で items 取得と件数取得を 1 回の DB 接続で原子的に実行
      //   ① findMany: skip + take で対象ページの行を取得 (SQL の OFFSET + LIMIT)
      //   ② count   : 条件にマッチする総件数 (ページャー表示用)
      const [items, total] = await prisma.$transaction([
        prisma.product.findMany({ ...queryBase, skip: page * pageSize, take: pageSize }),
        prisma.product.count({ where }),
      ]);
      res.json({ items, total });
      return;
    }

    // 非 paginated モード: 従来通り全件を配列で返す (後方互換)
    const products = await prisma.product.findMany(queryBase);
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /products/:id  1件取得  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    //商品をidを条件に探す
    const products = await prisma.product.findUnique({where:{id},include:{category:true}});
  //商品を見つけられなければ404
 if(!products){
      res.status(404).json({
        error: 'Not Found',
      })
    }else{
      //見つかれば商品を返す
      res.json(products);
    }
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /products  商品作成  (TODO: あなたが実装)
//   入力: { name, description?, price, imageUrl?, stock?, categoryId }
//   ヒント: categoryId は必須。存在しないIDを指定すると外部キー制約エラーになる
// ─────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    //商品を作成
    const created = await prisma.product.create({
      data: req.body,
    })
    //作成した商品を返す
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// PUT /products/:id  商品更新  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    //商品を更新
    const updated = await prisma.product.update({
      where:{id},
      data:req.body,
    })
    //更新した商品を返す
    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// DELETE /products/:id  商品削除
//   外部キー制約に注意: その商品が OrderItem (注文明細) から参照されていると P2003 エラー
//   → 500 ではなく 409 Conflict で「関連データあり」と伝えるのが REST の作法
// ─────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    // idに紐づく商品を削除
    await prisma.product.delete({ where: { id } });
    // 204 No Content: 削除成功でレスポンスボディは無し (RESTの慣例)
    res.status(204).end();
  } catch (err: any) {
    // ─── Prisma の代表的エラーコードをハンドリング ───
    // P2003: Foreign key constraint failed
    //   = 関連レコード (この場合は OrderItem) が残っているため削除できない
    //   → 409 Conflict: 「他のデータと競合して削除不可」を意味する HTTP ステータス
    if (err?.code === 'P2003') {
      res.status(409).json({
        error: 'Conflict',
        message: 'この商品は注文明細に含まれているため削除できません',
      });
      return;
    }
    // P2025: 削除対象の id が DB に存在しない
    if (err?.code === 'P2025') {
      res.status(404).json({
        error: 'Not Found',
        message: '指定された商品が存在しません',
      });
      return;
    }
    // それ以外の予期しないエラー: 既定のエラーハンドラ (index.ts) に委ねる → 500
    next(err);
  }
});

export default router;
