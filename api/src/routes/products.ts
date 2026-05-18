// /products エンドポイントの定義。
import { Router, Request, Response, NextFunction, raw } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ─────────────────────────────────────────────────────
// GET /products  商品一覧（完成例: カテゴリ情報も含めて返す）
//   クエリパラメータ ?categoryId=1 でフィルタも可能（任意機能の例）
// ─────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryIdParam = req.query.categoryId;
    const where = categoryIdParam ? { categoryId: Number(categoryIdParam) } : {};

    const products = await prisma.product.findMany({
      where,
      include: { category: true }, // カテゴリ情報も一緒に取得
      orderBy: { id: 'asc' },
    });
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
// DELETE /products/:id  商品削除  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    //商品を削除
    await prisma.product.delete({where:{id}});
    //削除の場合返す必要はないため終了
    res.status(204).end();
    // TODO: prisma.product.delete を使う
  } catch (err) {
    next(err);
  }
});

export default router;
