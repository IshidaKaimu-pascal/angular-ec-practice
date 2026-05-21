// 📌 このファイルをひとことで言うと:
//   「サーバーの『扉番 (とびらばん)』ファイル」
//
// 何をするファイル?
//   - ブラウザからリクエストが来たときに、身分証 (トークン) を確認する
//   - 身分証が無い・偽物・期限切れなら入口で追い返す (401 エラー)
//   - 身分証はあるけど権限が足りない場合も追い返す (403 エラー)
//   - 通過した場合は、後続の処理 (商品一覧取得等) に「この人は ID:○○ ですよ」と伝える
//
// 3 つの扉番:
//   - requireAuth     → ログイン済みなら誰でも通す
//   - requireCustomer → 顧客のみ通す (買い物カゴ・注文履歴など)
//   - requireAdmin    → 管理者のみ通す (商品登録・ユーザー管理など)

// ============================================================
// 認証ミドルウェア
// ------------------------------------------------------------
// このファイルは Express の「ミドルウェア」を 3つ提供する:
//   - requireAuth     : ログイン必須 (customer/admin どちらでも通す)
//   - requireCustomer : customer ロールのみ通す
//   - requireAdmin    : admin ロールのみ通す
//
// 使い方の例 (各 routes/*.ts で):
//   router.get('/me', requireAuth, async (req, res) => {
//     // 認証済みなら req.user に { id, role } が入っている
//     console.log(req.user?.id);
//   });
//
// ミドルウェアとは:
//   Express では「リクエスト → ミドルウェア → ハンドラ」の順に処理が流れる。
//   ミドルウェアは next() を呼ぶことで次の処理に進める。
//   呼ばずに res.json() で終わらせれば、その時点でレスポンスを返してチェーンを止められる。
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../auth/jwt';

// ============================================================
// Express の Request 型を拡張して `req.user` を生やす
// ------------------------------------------------------------
//   declare global で「TypeScript のグローバル名前空間にある型」を拡張する。
//   Express 本体の型定義に介入して、Request に user プロパティを追加する書き方。
//
//   なぜ必要?
//     何もしないと TypeScript が「Request に user なんてプロパティは無い」とエラーを出す。
//     拡張することで `req.user?.id` のように補完が効くようになる。
//
//   ? (オプショナル) を付ける理由:
//     ミドルウェアを通る前は user が未定義のため、型として undefined を許容する必要がある。
// ============================================================
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// ============================================================
// 内部ヘルパー: トークン取得 + 検証を一箇所にまとめる
//   3つのミドルウェアで同じ処理を繰り返さないように共通化
// ============================================================
function authenticate(req: Request): TokenPayload | null {
  // req.header(キー名) で「リクエストヘッダの指定の値」を文字列として取り出す
  //   - クライアントが Authorization ヘッダを付けていれば → "Bearer eyJhbGci..." のような文字列
  //   - 付けていなければ → undefined
  const authHeader = req.header('Authorization');

  // ガード節 (early return): 不正なら以降を実行せず即座に null を返す書き方
  //   ① !authHeader            → ヘッダが undefined / 空文字 のケースを弾く
  //   ② !startsWith('Bearer ') → 別形式 (Basic 等) や形式違反のケースを弾く
  //   ここを通過すれば「Authorization: Bearer XXX」の形であることが保証される
  if(!authHeader || !authHeader.startsWith('Bearer '))
    return null;

  // 'Bearer ' は 7 文字 (B,e,a,r,e,r,半角スペース)
  // substring(7) は「インデックス 7 以降」を抜き出すメソッド
  //   "Bearer eyJhbGci..." → "eyJhbGci..."
  // これで「Bearer 」プレフィックスを取り除き、トークン本体だけが残る
  const token = authHeader.substring(7);

  // 二重ガード: "Bearer " とだけ送られた (本体が空文字) ケースを弾く
  //   ① の startsWith では通過してしまうので、ここでもう一度チェック
  //   if (!token) は空文字 "" を「偽」と判定するため、空なら null を返す
  if (!token) return null;

  // verifyToken は内部で jwt.verify を呼び、失敗時は try/catch で null を返す
  //   失敗パターン: 改ざん / 期限切れ / JWT 形式違反 すべて null
  //   成功時は { id, role } の TokenPayload が返る
  return verifyToken(token);
}

// ============================================================
// requireAuth: ログイン必須ミドルウェア
//   ロールは問わず、有効なトークンが付いていれば通す
// ============================================================
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const payload = authenticate(req);
  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: '認証が必要です',
    });
    return;
  }
  // 認証成功: req.user に payload をセットして次へ
  req.user = payload;
  next();
}

// ============================================================
// requireCustomer: customer ロールのみ通すミドルウェア
//   shopping cart, order などの「顧客向け」エンドポイントで使う
// ============================================================
export function requireCustomer(req: Request, res: Response, next: NextFunction): void {
  const payload = authenticate(req);
  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: '認証が必要です',
    });
    return;
  }
  // 401 (認証されてない) と 403 (認証されてるが権限不足) は区別するのが REST の作法
  if (payload.role !== 'customer') {
    res.status(403).json({
      error: 'Forbidden',
      message: '顧客権限が必要です',
    });
    return;
  }
  req.user = payload;
  next();
}

// ============================================================
// requireAdmin: admin ロールのみ通すミドルウェア
//   backoffice の「管理者向け」エンドポイントで使う
// ============================================================
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const payload = authenticate(req);
  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: '認証が必要です',
    });
    return;
  }
  if (payload.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: '管理者権限が必要です',
    });
    return;
  }
  req.user = payload;
  next();
}
