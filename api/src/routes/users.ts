// /users エンドポイントの定義。
// Express の Router は「URLごとのハンドラをまとめる小さなアプリ」のような存在。
// 最後に index.ts で app.use('/users', router) するとマウントされる。
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma';

const router = Router();

// bcrypt のソルトラウンド数。
// 値が大きいほど安全だが処理が重くなる。10 が業界の標準的なバランス。
// 2^10 = 1024 回のハッシュ計算を行う。
const SALT_ROUNDS = 10;

// セキュリティ上の理由で、レスポンスに password を含めないために再利用する select 設定。
// Prismaの select は「SQLのSELECT句で取得するカラムを指定」する機能。
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  address: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─────────────────────────────────────────────────────
// GET /users  全ユーザー一覧（あいまい検索 + ページング対応）
//   クエリパラメータ:
//     ?q=xxx                      … name または email に xxx を含むユーザーだけに絞る (OR 検索)
//     ?page=N&pageSize=M          … N ページ目を M 件ずつ取得 (page は 0 始まり)
//
//   レスポンス形式 (page の有無で切り替え):
//     ?page= 無し → User[] (従来通りの配列)
//     ?page= 有り → { items: User[], total: number }
// ─────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // q (検索キーワード): string であることを確認 + 前後空白除去
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    // q があれば name OR email の部分一致で絞る、無ければ全件取得
    //   contains = SQL の LIKE '%q%' (部分一致)
    //   OR の中で複数フィールドを並べると「どれか一つにヒットすればよい」検索になる
    const where = q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : {};

    // findMany の共通オプション (paginated / 非paginated で同じ条件を使うため切り出し)
    const queryBase = {
      where,
      select: safeUserSelect, // password を除外したカラムだけ返す
      orderBy: { id: 'asc' as const },
    };

    // ─── ページングモードの判定 ───
    const isPaginated = req.query.page !== undefined;

    if (isPaginated) {
      // page / pageSize の安全な解釈 (NaN → 0/10、負数防止、上限 100)
      const page = Math.max(0, parseInt(String(req.query.page), 10) || 0);
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize), 10) || 10));

      // $transaction で items 取得と件数取得を 1 回の DB 接続で原子的に実行
      const [items, total] = await prisma.$transaction([
        prisma.user.findMany({ ...queryBase, skip: page * pageSize, take: pageSize }),
        prisma.user.count({ where }),
      ]);
      res.json({ items, total });
      return;
    }

    // 非 paginated モード: 従来通り全件を配列で返す (後方互換)
    const users = await prisma.user.findMany(queryBase);
    res.json(users);
  } catch (err) {
    next(err); // エラーハンドラ (index.ts) へ転送
  }
});

// ─────────────────────────────────────────────────────
// GET /users/:id  1件取得  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    //ユーザーをidを条件に探す(SELECT)
    const user = await prisma.user.findUnique({
      where:{ id },
      select: safeUserSelect
    });

    //ユーザーが存在しない場合404エラー
    if(!user){
      res.status(404).json({
        error: 'Not Found',
      })
    }else{
      //見つかればユーザーを返す
      res.json(user);
    }
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /users  ユーザー作成
//   password は bcrypt でハッシュ化してから保存する (平文保存は禁止)
// ─────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    //データベースから取得してきたデータをそれぞれの変数に代入
    const {name,email,password,role,address,phone} = req.body;

    // bcrypt.hash(平文パスワード, ソルトラウンド数) で一方向ハッシュ化する。
    // await が必要 (非同期処理: 計算に少し時間がかかる)。
    // 返り値の例: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    //ユーザーを作成 (password はハッシュ化済みのものを渡す)
    const created = await prisma.user.create({
      data:{name,email,password: hashedPassword,role,address,phone},
      select: safeUserSelect,
    })
    //作成したユーザーを返す
    res.status(201).json(created);

  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// PUT /users/:id  ユーザー更新
//   password が含まれる場合のみハッシュ化する (含まれない場合は触らない)
// ─────────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);

    // req.body をコピーして編集用の data オブジェクトを作る (元の req.body は変更しない)
    const data = { ...req.body };

    // 更新にpassword が含まれる場合のみハッシュ化する
    if('password' in data){
      const hashedPassword = await bcrypt.hash(data.password,SALT_ROUNDS);
      data.password = hashedPassword;
    }

    //条件付きユーザーを更新
    const updated = await prisma.user.update({
      where:{id},
      data,
      select: safeUserSelect
    });

    res.status(201).json(updated);

  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// DELETE /users/:id  ユーザー削除
//   外部キー制約に注意: そのユーザーが Order を持っていると Prisma の P2003 エラーが起きる
//   → 500 ではなく 409 Conflict で「関連データあり」と伝えるのが REST の作法
// ─────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    // idに紐づくユーザーを削除
    await prisma.user.delete({ where: { id } });
    // 204 No Content: 削除成功でレスポンスボディは無し (RESTの慣例)
    res.status(204).end();
  } catch (err: any) {
    // ─── Prisma の代表的エラーコードをハンドリング ───
    // P2003: Foreign key constraint failed
    //   = 関連レコード (この場合は Order) が残っているため削除できない
    //   → 409 Conflict: 「他のデータと競合して削除不可」を意味する HTTP ステータス
    if (err?.code === 'P2003') {
      res.status(409).json({
        error: 'Conflict',
        message: 'このユーザーには注文履歴が紐付いているため削除できません',
      });
      return;
    }
    // P2025: An operation failed because it depends on one or more records that were required but not found
    //   = 削除対象の id が DB に存在しない
    //   → 404 Not Found: リソースが見つからない場合の標準ステータス
    if (err?.code === 'P2025') {
      res.status(404).json({
        error: 'Not Found',
        message: '指定されたユーザーが存在しません',
      });
      return;
    }
    // それ以外の予期しないエラー: 既定のエラーハンドラ (index.ts) に委ねる → 500
    next(err);
  }
});

export default router;
