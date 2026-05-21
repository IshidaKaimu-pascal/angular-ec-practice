// /categories エンドポイントの定義。
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

const router = Router();

// ─────────────────────────────────────────────────────
// GET /categories  カテゴリ一覧（あいまい検索 + ページング対応）
//   クエリパラメータ:
//     ?q=xxx                      … name に xxx を含むカテゴリだけに絞る
//     ?page=N&pageSize=M          … N ページ目を M 件ずつ取得 (page は 0 始まり)
//
//   レスポンス形式 (page の有無で切り替え):
//     ?page= 無し       → Category[] (従来通りの配列、product-list の select 用)
//     ?page= 有り       → { items: Category[], total: number } (ページャーで件数表示するため total を返す)
//
//   後方互換のため「page が無い時は配列をそのまま返す」設計にしている。
//   これで Step 9-2 以降で既存呼び出しを壊さずに移行できる。
// ─────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ─── クエリパラメータ ?q= を取り出す ───
    // Express の req.query.q の型は string | string[] | undefined なので、
    // string であることを確認してから trim() で前後の空白を除去する。
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    // q が空文字 → where: {} (条件無し = 全件取得)
    // q に値がある → where: { name: { contains: q } } で部分一致検索
    // Prisma の contains は SQL の LIKE '%q%' に変換される (あいまい検索)
    const where = q ? { name: { contains: q } } : {};

    // findMany の共通オプション (paginated / 非paginated で同じ where + orderBy を使うため切り出し)
    //   orderBy を配列で複数指定: まず displayOrder の昇順、
    //   displayOrder が同値だった場合は id の昇順をフォールバックに使う。
    //   （displayOrder は重複可なので、フォールバックがないと並び順が不安定になる）
    const queryBase = {
      where,
      orderBy: [{ displayOrder: 'asc' as const }, { id: 'asc' as const }],
    };

    // ─── ページングモードの判定 ───
    // ?page= が URL に含まれていればページング有効、無ければ従来通り全件返す
    //   req.query.page は string | undefined (Express の型)
    //   undefined 比較で「キーが無い」を判定 (空文字 ?page= も含めて有効扱いする方針)
    const isPaginated = req.query.page !== undefined;

    if (isPaginated) {
      // page と pageSize を安全に数値化
      //   parseInt は失敗時 NaN を返す → || 0/10 でフォールバック
      //   Math.max(0, ...) で負数防止 (skip がマイナスだと Prisma がエラー)
      //   Math.min(100, ...) で pageSize 上限 (巨大値で DB を壊されないための予防策)
      const page = Math.max(0, parseInt(String(req.query.page), 10) || 0);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 10));

      const skip = page * pageSize;
      const take = pageSize;

      // TODO-1: ここに $transaction の処理を書いてください
      const [items, total] = await prisma.$transaction([
        //ページング機能に応じたquery
        prisma.category.findMany({ ...queryBase, skip, take }),
        //総件数のquery
        prisma.category.count({ where }),
      ])
      // 暫定: ToDo を埋めるまでは空のページを返す (動作確認エラー回避)
      res.json({ items, total });
      return;
    }

    // 非 paginated モード: 従来通り全件を配列で返す (後方互換)
    const categories = await prisma.category.findMany(queryBase);
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
    // 「分割代入(destructuring)」: req.body から name と displayOrder を取り出す。
    //   POSTリクエストで送られてきたJSON {"name":"Books","displayOrder":10} の各値を取得する。
    //   index.ts で app.use(express.json()) を入れているので、req.body は自動でパース済み。
    const { name, displayOrder } = req.body;

    // Prismaで「カテゴリを1件作成」する命令。
    //   create() に data: {...} を渡すと、その内容で新しい行をDBに insert する。
    //   displayOrder が undefined のときは schema の @default(0) が使われる。
    //   await は「DBへの問い合わせが完了するまで待ってから次に進む」という意味。
    //   戻り値の category には、作成された行（id, name, displayOrder, createdAt, updatedAt）が入る。
    const category = await prisma.category.create({
      data: { name, displayOrder },
    });

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
// DELETE /categories/:id  カテゴリ削除
//   外部キー制約に注意: そのカテゴリに紐づく Product があると Prisma の P2003 エラーが起きる
//   → 500 ではなく 409 Conflict で「関連データあり」と伝えるのが REST の作法
// ─────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    // idに紐づくカテゴリを削除
    await prisma.category.delete({ where: { id } });
    // 204 No Content: 削除成功でレスポンスボディは無し (RESTの慣例)
    res.status(204).end();
  } catch (err: any) {
    // ─── Prisma の代表的エラーコードをハンドリング ───
    // P2003: Foreign key constraint failed
    //   = 関連レコード (この場合は Product) が残っているため削除できない
    //   → 409 Conflict: 「他のデータと競合して削除不可」を意味する HTTP ステータス
    if (err?.code === 'P2003') {
      res.status(409).json({
        error: 'Conflict',
        message: 'このカテゴリには商品が紐付いているため削除できません',
      });
      return;
    }
    // P2025: 削除対象の id が DB に存在しない
    if (err?.code === 'P2025') {
      res.status(404).json({
        error: 'Not Found',
        message: '指定されたカテゴリが存在しません',
      });
      return;
    }
    // それ以外の予期しないエラー: 既定のエラーハンドラ (index.ts) に委ねる → 500
    next(err);
  }
});

export default router;
