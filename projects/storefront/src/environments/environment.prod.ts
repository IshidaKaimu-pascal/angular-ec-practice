// 本番ビルド時 (ng build --configuration production) に使われる環境変数
// angular.json の fileReplacements で environment.ts と差し替えられる
//
// Apache の reverse proxy を前提とした相対 URL:
//   - apiUrl: '/api' → Apache が /api/* を localhost:3000/* に流す
//   - staticUrl: '/static' → Apache が /static/* を localhost:3000/static/* に流す
// 同一オリジンになるため CORS 問題が発生しない。
export const environment = {
  production: true,
  apiUrl: '/api',
  staticUrl: '/static',
};
