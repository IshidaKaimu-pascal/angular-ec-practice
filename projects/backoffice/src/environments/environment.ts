// 開発時 (ng serve) に使われる環境変数 (backoffice 用)
// 本番ビルド時は environment.prod.ts に差し替わる (angular.json の fileReplacements で設定)
//
// storefront 側と同じ API を呼ぶので apiUrl は同じ値だが、
// ファイルは backoffice 配下に別途配置して独立管理する。
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  staticUrl: 'http://localhost:3000/static',
};
