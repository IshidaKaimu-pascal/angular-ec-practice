// 📌 このファイルをひとことで言うと:
//   「サインインしていない人が管理画面を開こうとしたら、サインイン画面に追い返す係 (backoffice 版)」
//
// 何をするファイル?
//   - 各画面 (categories / products / users) を開く「直前」に呼ばれる
//   - 「この管理者ログイン済?」をチェックして OK / NG を判定
//   - OK なら画面を開かせる、NG なら /sign-in に飛ばす
//
// 関連ファイル:
//   - app.routes.ts → ルートごとに `canActivate: [authGuard]` で適用する
//   - auth.service.ts → signedIn() で判定材料を提供
//
// storefront 版との違い:
//   - 相対パスは同じ文字列だが、解決先が backoffice 内の AuthService (管理者用)
//   - リダイレクト先 /sign-in も backoffice の管理者サインイン画面
//   - ロジックは完全に同じ (同じ形の API なら中身が違っても動く例)

import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

//遷移する前のガード処理
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  //サインイン済みか判定
  //サインイン済みならそのまま遷移
  if(authService.signedIn()) return true;
  //サインイン済みでないならサインイン画面へリダイレクト
  router.navigate(['/sign-in']);  
  return false; // ← 仮の戻り値 (常に false で何も開けない)。これを書き換える
};
