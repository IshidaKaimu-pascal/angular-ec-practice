// 📌 このファイルをひとことで言うと:
//   「ログイン・新規登録の受付窓口を担当するサーバー側のファイル」
//
// 何をするファイル?
//   - ブラウザから「このメール+パスワードでログインしたい」と来たら、
//     データベースと照合して合っているか確認する
//   - 合っていれば「身分証 (トークン)」を発行して返す
//   - 新規登録の場合はパスワードを安全な形 (ハッシュ化) で保存してから身分証を返す
//   - 顧客 (customer) と管理者 (admin) で別々の窓口を用意している
//
// 提供する 4 つの窓口:
//   - POST /auth/customer/signup  顧客の新規登録
//   - POST /auth/customer/signin  顧客のログイン
//   - POST /auth/admin/signup     管理者の新規登録
//   - POST /auth/admin/signin     管理者のログイン

// ============================================================
// /auth エンドポイント: 認証関連 (サインアップ / サインイン)
// ------------------------------------------------------------
// このファイルが扱う処理:
//   - POST /auth/customer/signup  : 顧客の新規登録 + JWT 発行
//   - POST /auth/customer/signin  : 顧客のログイン + JWT 発行
//
// 認証成功時のレスポンス形式:
//   { token: "eyJhbGci...", user: { id, name, email, ... } }
//
// クライアント側は token を localStorage 等に保存し、
// 以降のリクエストで `Authorization: Bearer <token>` ヘッダで送信する。
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma';
import { signToken } from '../auth/jwt';

const router = Router();

// bcrypt のソルトラウンド数 (users.ts と揃える)
const SALT_ROUNDS = 10;

// レスポンスに password を含めないための select 設定
// (users.ts と内容は同じ。学習段階なので共通化はあえてせず重複させている)
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

// ============================================================
// POST /auth/customer/signup  顧客のサインアップ
//   完成形 (POST /users とほぼ同じだが role を 'customer' で固定 + JWT 発行)
//
//   レスポンス例:
//     201 Created
//     { token: "...", user: { id: 6, name: "...", email: "...", role: "customer", ... } }
//
//   エラー:
//     409 Conflict — email 重複 (Prisma の P2002)
// ============================================================
router.post('/customer/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // リクエストボディから必要な情報を取り出す
    const { name, email, password, address, phone } = req.body;

    // パスワードを bcrypt でハッシュ化 (平文保存禁止)
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // ユーザー作成。role は 'customer' で固定 (admin への昇格は不可)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'customer',
        address,
        phone,
      },
      select: safeUserSelect,
    });

    // JWT 発行 (サインアップと同時にログイン状態にする)
    const token = signToken({ id: user.id, role: 'customer' });

    // 作成成功: 201 Created + token + user を返す
    res.status(201).json({ token, user });
  } catch (err: any) {
    // P2002: email の unique 制約違反 → 409 Conflict で「重複」を伝える
    if (err?.code === 'P2002') {
      res.status(409).json({
        error: 'Conflict',
        message: 'このメールアドレスはすでに登録されています',
      });
      return;
    }
    next(err);
  }
});

// ============================================================
// POST /auth/customer/signin  顧客のサインイン (穴埋め ToDo-1 含む)
//
//   重要なセキュリティ慣例:
//     「メールが存在しない」と「パスワードが違う」を 同じ 401 で返す
//       → 違うメッセージにすると「このメールは登録されているか」を攻撃者が探れる
//          (アカウント列挙攻撃の防止)
//
//   レスポンス例:
//     200 OK
//     { token: "...", user: { ... } }
//
//   エラー:
//     401 Unauthorized — メール不一致 or パスワード不一致 (区別しない)
// ============================================================
router.post('/customer/signin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // メールでユーザー検索
    // 注意: ハッシュとの比較が必要なので password も含めて取得する (safeUserSelect は使わない)
    const user = await prisma.user.findUnique({ where: { email } });

    // ユーザーが存在しない場合 → 401 (詳細は伝えない)
    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'メールアドレスまたはパスワードが違います',
      });
      return;
    }
    //ハッシュ化されていないパスワードとハッシュ化されたパスワードの照合
    const isValid: boolean = await bcrypt.compare(password,user.password); 

    // 照合失敗 → 401 (こちらもメッセージは存在チェックと同じにする)
    if (!isValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'メールアドレスまたはパスワードが違います',
      });
      return;
    }

    // 認証成功 → JWT 発行
    const token = signToken({ id: user.id, role: 'customer' });

    // レスポンスから password を除外して返す
    //   分割代入で password だけ別変数に取り、残りを safeUser にまとめる定番パターン
    const { password: _password, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// admin 用エンドポイントで使う select (Admin テーブルは password 以外シンプル)
// ============================================================
const safeAdminSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ============================================================
// POST /auth/admin/signup  管理者のサインアップ
//
//   ⚠️ セキュリティ警告 (本番運用時は注意):
//     現在の実装では「誰でも管理者アカウントを作成できる」状態。
//     学習用なのでシンプルに保っているが、本番環境では:
//       - 初期 admin は CLI スクリプトで作成
//       - 以降は既存 admin による「招待制」または手動承認
//     のいずれかにすべき。
//
//   レスポンス例:
//     201 Created
//     { token: "...", admin: { id, name, email, createdAt, updatedAt } }
//
//   エラー:
//     409 Conflict — email 重複 (P2002)
// ============================================================
router.post('/admin/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const admin = await prisma.admin.create({
      data: { name, email, password: hashedPassword },
      select: safeAdminSelect,
    });

    const token = signToken({ id: admin.id, role: 'admin' });

    res.status(201).json({ token, admin });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({
        error: 'Conflict',
        message: 'このメールアドレスはすでに登録されています',
      });
      return;
    }
    next(err);
  }
});

// ============================================================
// POST /auth/admin/signin  管理者のサインイン
//   構造は /auth/customer/signin とほぼ同じ
//   違い: prisma.user → prisma.admin, role: 'admin' で発行
// ============================================================
router.post('/admin/signin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'メールアドレスまたはパスワードが違います',
      });
      return;
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'メールアドレスまたはパスワードが違います',
      });
      return;
    }

    const token = signToken({ id: admin.id, role: 'admin' });

    const { password: _password, ...safeAdmin } = admin;
    res.json({ token, admin: safeAdmin });
  } catch (err) {
    next(err);
  }
});

export default router;
