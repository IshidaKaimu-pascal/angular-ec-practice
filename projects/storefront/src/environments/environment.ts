// 開発時 (ng serve) に使われる環境変数
// 本番ビルド時は environment.prod.ts に差し替わる (angular.json の fileReplacements で設定)
//
// apiUrl: REST API のベース URL
//   - 開発時はローカルの Express (localhost:3000) を直接呼ぶ
//   - 本番時 (Cloud9) は Apache の reverse proxy 経由になるため '/api' のような相対パスに変わる
// staticUrl: 商品画像など静的ファイルのベース URL
//   - 開発時は Express の /static エンドポイントを直接呼ぶ
//   - 本番時は Apache 経由で '/static' に変わる
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  staticUrl: 'http://localhost:3000/static',
};
