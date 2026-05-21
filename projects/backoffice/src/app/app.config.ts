import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
// provideHttpClient: アプリ全体で HttpClient を inject() できるようにする
// これがないと「No provider for HttpClient」エラーになる
// withInterceptors: 関数型インターセプターを HttpClient に登録する
//   ここで登録した順に、全 HTTP リクエストが通過する。
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
// authInterceptor: 全リクエストに JWT トークン (Authorization ヘッダ) を自動付与する
import { authInterceptor } from './services/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withInterceptors([authInterceptor]) で関数型インターセプターを登録
    //   サーバー側で requireAuth/requireAdmin ミドルウェアを通すルートでは
    //   このトークンが無いと 401 になる。
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
  ],
};
