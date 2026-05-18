// /categories エンドポイントの定義。
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ─────────────────────────────────────────────────────
// GET /categories  カテゴリ一覧（完成例）
// ─────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// GET /categories/:id  1件取得（完成例: 関連商品も含めて取得）
//   `include` で「このテーブルに紐づく別テーブルの行も一緒に取る」ことができる
// ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const category = await prisma.category.findUnique({
      where: { id },
      include: { products: true }, // 関連する商品も一緒に取得
    });
    if (!category) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /categories  カテゴリ作成
// ─────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 「分割代入(destructuring)」: req.body から name プロパティを取り出して name 変数に入れる。
    //   POSTリクエストで送られてきたJSON {"name":"Books"} の name の値を取得する。
    //   index.ts で app.use(express.json()) を入れているので、req.body は自動でパース済み。
    const { name } = req.body;

    // Prismaで「カテゴリを1件作成」する命令。
    //   create() に data: {...} を渡すと、その内容で新しい行をDBに insert する。
    //   await は「DBへの問い合わせが完了するまで待ってから次に進む」という意味。
    //   戻り値の category には、作成された行（id, name, createdAt, updatedAt）が入る。
    const category = await prisma.category.create({ data: { name } });

    // 201 Created を返す。
    //   200 OK ではなく 201 を使うのが REST の慣例（「新しいリソースを作った」という意味）。
    //   .json() で JavaScript オブジェクトを自動的にJSON文字列に変換して返す。
    res.status(201).json(category);
  } catch (err) {
    // try ブロック内でエラーが出たら(例: name が重複しているなど)、ここに飛ぶ。
    //   next(err) で Express のエラーハンドラ(index.ts最下部)に処理を委ねる。
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// PUT /categories/:id  カテゴリ更新  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    //データのidを数値化
    const id = Number(req.params.id);
    //更新
    const updated = await prisma.category.update({where:{id},data: req.body});
    //更新後のデータを返す
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// DELETE /categories/:id  カテゴリ削除  (TODO: あなたが実装)
//   注意: そのカテゴリに紐づく商品があると、外部キー制約でエラーになる
//          → 試行錯誤しながら try/catch で 400 BadRequest を返すなど対応
// ─────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    //削除
    await prisma.category.delete({where:{id}});
    //204
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
