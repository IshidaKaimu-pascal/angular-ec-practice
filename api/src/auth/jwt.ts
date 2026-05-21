// 📌 このファイルをひとことで言うと:
//   「身分証 (トークン) を作る人 / 確認する人 をまとめたファイル」
//
// 何をするファイル?
//   - ログイン成功時に「あなたは ID:○○ の人ですよ」という身分証を発行する
//   - ブラウザから送られてきた身分証が本物か (改ざんされていないか) を確認する
//   - 身分証には有効期限 (このプロジェクトでは 7 日間) が付いている
//
// 関連ファイル:
//   - routes/auth.ts        → ログイン成功時にここの signToken を呼んで身分証を発行
//   - middleware/requireAuth.ts → リクエストの身分証を verifyToken で確認

// ============================================================
// JWT (JSON Web Token) ヘルパー
// ------------------------------------------------------------
// JWT とは:
//   - サーバが署名付きで発行する「身分証」のような文字列
//   - クライアントは「Authorization: Bearer <token>」ヘッダで送信する
//   - サーバは署名を検証して「改ざんされていない」「自分が発行した」ことを確認できる
//   - DB を毎回引かなくても「誰のリクエストか」が分かるので高速
//   - 中身は base64 でエンコードされているだけで誰でも読める
//     → パスワード等の機密情報を payload に入れてはいけない
//
// このファイルが提供する関数:
//   - signToken(payload): サインイン成功時に呼んでトークンを発行
//   - verifyToken(token): 保護されたルートでヘッダのトークンを検証
// ============================================================

import jwt from 'jsonwebtoken';

// .env から JWT_SECRET を読み込む
// 起動時に必須チェック: 未設定なら即エラーで停止する
//   → 本番環境で「うっかり鍵なしで起動」を防ぐ
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET が .env に設定されていません');
}

// トークンの有効期限
//   短すぎる: ユーザーが頻繁に再ログインを求められて体験が悪化
//   長すぎる: 漏洩時のリスクが大きくなる
//   一般的な業務システムでは数時間〜数日が目安。練習用なので 7 日で広めに。
const EXPIRES_IN = '7d';

// ============================================================
// TokenPayload: トークンに埋め込む情報の型
//   id    : User または Admin のレコード ID
//   role  : 'customer' (顧客) | 'admin' (管理者) — リクエストの権限判定に使う
// ============================================================
export type TokenPayload = {
  id: number;
  role: 'customer' | 'admin';
};

// ============================================================
// signToken: トークン生成 (完成形)
//   サインイン成功時に呼び、生成したトークン文字列をクライアントに返す
//
//   jwt.sign(payload, secret, options) の引数:
//     - payload: トークンに埋め込む情報 (object)
//     - secret : 署名に使う秘密鍵 (.env の JWT_SECRET)
//     - options: 有効期限などの設定
//
//   戻り値: 署名済みトークン文字列 (例: "eyJhbGciOi...・3部構成・...QssW5c")
// ============================================================
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: EXPIRES_IN });
}

// ============================================================
// verifyToken: トークン検証 (穴埋め ToDo-1)
//   クライアントから受け取ったトークンを検証し、中身の payload を取り出す
//
//   方針: 失敗時は null を返す (呼び出し側でミドルウェアが 401 を返す想定)
//     → throw だと呼び出し側で try/catch が必要になり煩雑
// ============================================================
export function verifyToken(token: string): TokenPayload | null {
  try{
    //トークンの検証
    return jwt.verify(token, JWT_SECRET as string) as TokenPayload
  }catch(e){
    return null 
  }
}
