import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
// provideHttpClient: アプリ全体で HttpClient を inject() できるようにする
// これがないと「No provider for HttpClient」エラーになる
//
// withInterceptors([...]): HTTP インターセプターを登録する関数
//   ここに登録した関数は、http.get/post する前に必ず通る。
//   authInterceptor を登録することで、全リクエストに JWT トークンが自動付与される。
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
  ],
};
