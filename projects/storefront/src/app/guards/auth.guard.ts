// 📌 このファイルをひとことで言うと:
//   「サインインしていない人が保護ページを開こうとしたら、サインイン画面に追い返す係」
//
// 何をするファイル?
//   - 各画面 (cart / checkout / orders 等) を開く「直前」に呼ばれる
//   - 「この人ログイン済?」をチェックして OK / NG を判定
//   - OK なら画面を開かせる、NG なら /sign-in に飛ばす
//
// 関連ファイル:
//   - app.routes.ts → ルートごとに `canActivate: [authGuard]` で適用する
//   - auth.service.ts → signedIn() で判定材料を提供

import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

// ============================================================
// authGuard: 認証ガード (Angular 15+ の関数型 CanActivateFn 形式)
// ------------------------------------------------------------
// CanActivateFn とは:
//   ルート遷移の「許可/不許可」を判定する関数型。Angular がルーター遷移直前に呼び出す。
//   戻り値:
//     true / UrlTree  → 遷移を許可 (または別ルートへ振り替え)
//     false           → 遷移を中止 (画面は変わらない)
//
// 関数型ガード:
//   Angular 15+ の新形式。クラス + @Injectable + provide が不要で簡潔。
//   inject() で DI コンテナからサービスを取得する。
//
// 役割:
//   AuthService.signedIn() を見て、未サインインなら /sign-in に飛ばす。
//   サインイン済みなら true を返して通過させる。
// ============================================================
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  //ガード処理
  //trueならそのまま遷移
  if(authService.signedIn()) return true;
  //falseならサインイン画面へリダイレクト
  router.navigate(['/sign-in']);
  return false; // ← 仮の戻り値 (常に false)。これを書き換える
};
