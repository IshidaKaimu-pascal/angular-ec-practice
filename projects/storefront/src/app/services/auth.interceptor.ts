// 📌 このファイルをひとことで言うと:
//   「サーバーへの通信に自動で身分証 (トークン) をくっつけてくれるファイル」
//
// 何をするファイル?
//   - ブラウザからサーバーに「商品ちょうだい」「注文履歴見せて」等を送るとき、
//     その途中でこのファイルが割り込んで、身分証 (トークン) を一緒に付けてくれる
//   - 各画面・各サービスで「身分証を付ける」コードを毎回書かなくて済む
//   - ログインしていない (身分証が無い) 時は何もせず、リクエストをそのまま流す
//
// なぜ必要?
//   毎回手動で身分証を付けると書き忘れ事故が起きる。
//   ここに集約することで、全通信に確実に身分証が付くようになる。

// ============================================================
// authInterceptor: HTTP リクエストに JWT トークンを自動付与する
// ------------------------------------------------------------
// HttpInterceptor (HTTP インターセプター) とは:
//   全ての HTTP リクエストを「途中で捕まえて加工する」仕組み。
//   各サービスから http.get/post する前に、ここを必ず通る。
//
// なぜ必要?
//   token を手動で各リクエストに付ける書き方だと、
//     http.get(url, { headers: { Authorization: `Bearer ${token}` } })
//   を 100 箇所書く必要が出てしまう (DRY 原則違反 + 付け忘れ事故の原因)。
//   インターセプターで一箇所に集約すれば、各サービスは普通に
//     http.get(url)
//   と書くだけで自動的に Authorization が付くようになる。
//
// 関数型インターセプター (HttpInterceptorFn):
//   Angular 15+ で導入された新形式。クラスではなく関数で書ける。
//   従来の HttpInterceptor クラス + provide は記述量が多かったが、
//   関数形式だと「ただの関数」として宣言できてシンプル。
//
// ============================================================

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

// ============================================================
// HttpInterceptorFn は (req, next) => Observable<HttpEvent> の関数型
//   - req  : 送信予定の HttpRequest オブジェクト
//   - next : 次のインターセプター or 実際のリクエスト送信処理を呼び出す関数
//
// 「リクエストの不変性」:
//   HttpRequest はイミュータブル (変更不可)。
//   ヘッダーを足したい時は req.clone({ ... }) で「コピーを作って差し替える」。
//   .setHeaders で既存ヘッダーを保ったまま追加できる。
// ============================================================
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // inject() で AuthService の token 取得メソッドを使う
  //   関数型インターセプター内では DI コンテナから inject() で取得する
  const authService = inject(AuthService);
  const token = authService.getToken();

  // ▼ ここから ToDo-1 を実装 ▼
  if(!token){
    return next(req);
  }else{
      const authReq = req.clone({
      //トークンが存在する(ログイン済み)の場合ヘッダーを付ける
      setHeaders: { Authorization: `Bearer ${token}` },
    })
    return next(authReq);
  }
};
