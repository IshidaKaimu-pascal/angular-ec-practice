// /users エンドポイントの定義。
// Express の Router は「URLごとのハンドラをまとめる小さなアプリ」のような存在。
// 最後に index.ts で app.use('/users', router) するとマウントされる。
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

const router = Router();

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
// GET /users  全ユーザー一覧（完成例）
// ─────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: safeUserSelect,
      orderBy: { id: 'asc' },
    });
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

    // TODO 1: req.params.id は文字列。Number(...) で数値に変換する
    // TODO 2: prisma.user.findUnique({ where: { id: ... }, select: safeUserSelect }) で取得
    // TODO 3: 結果が null なら res.status(404).json({ error: 'Not found' })
    // TODO 4: 見つかれば res.json(user)
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// POST /users  ユーザー作成  (TODO: あなたが実装)
//   注意: 現時点では password は平文で保存。Step 4 で bcrypt によるハッシュ化に置き換える
// ─────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    //データベースから取得してきたデータをそれぞれの変数に代入
    const {name,email,password,role,address,phone} = req.body;
    //ユーザーを作成
    const created = await prisma.user.create({
      data:{name,email,password,role,address,phone},
      select: safeUserSelect,
    })
    //作成したユーザーを返す
    res.status(201).json(created);    

  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// PUT /users/:id  ユーザー更新  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    //条件付きユーザーを更新
    const updated = await prisma.user.update({
      where:{id},
      data:{...req.body},
      select: safeUserSelect
    });

    res.status(201).json(updated);

  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────
// DELETE /users/:id  ユーザー削除  (TODO: あなたが実装)
// ─────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    //idに紐づくユーザーを削除
    await prisma.user.delete({where:{id}});
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
