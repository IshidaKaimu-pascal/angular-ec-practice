import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
// 各ページコンポーネントを eager loading でインポート
// (eager loading = 初回ロード時に全部まとめて読み込む方式。lazy loading の対義語)
// 規模が大きくなったら loadComponent で lazy loading に切り替える選択肢もある。
import { SignIn } from './features/sign-in/sign-in';
// 管理者新規登録 (Step 7-D-4 で追加)
import { AdminSignup } from './features/admin-signup/admin-signup';
// 認証ガード (Step 7-D-5 で追加): 未サインイン時に /sign-in へ追い返す
import { authGuard } from './guards/auth.guard';
// AuthService: homeRedirect で signedIn() を参照するために使う (Step 7-E-1)
import { AuthService } from './services/auth.service';
import { CategoryList } from './features/categories/category-list/category-list';
import { CategoryCreate } from './features/categories/category-create/category-create';
import { CategoryDetail } from './features/categories/category-detail/category-detail';
import { CategoryEdit } from './features/categories/category-edit/category-edit';
// products は CRUD 全コンポーネントをインポート (Phase 6 で追加)
import { ProductList } from './features/products/product-list/product-list';
import { ProductCreate } from './features/products/product-create/product-create';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { ProductEdit } from './features/products/product-edit/product-edit';
// users は CRUD 全画面を実装済み (Phase 6 完了)
import { UserList } from './features/users/user-list/user-list';
import { UserDetail } from './features/users/user-detail/user-detail';
import { UserCreate } from './features/users/user-create/user-create';
import { UserEdit } from './features/users/user-edit/user-edit';
// 注文履歴一覧 (Phase 11 で新設)。現状は雛形だけ、Step 11-3 で本実装。
import { OrderList } from './features/orders/order-list/order-list';

// ─────────────────────────────────────────────────────
// homeRedirect: ルート '/' を開いた時の振り分けガード (Step 7-E-1)
//   - サインイン済   → /categories へ
//   - 未サインイン   → /sign-in へ
//
// CanActivateFn は関数型ガード (Angular 15+)。
//   UrlTree を返すとそのまま Router がリダイレクト扱いにする。
//   ※ storefront 版と違い、こちらは「サインイン済でも必ずどこかへ飛ばす」ので
//     true を返さず常に UrlTree を返している。
// ─────────────────────────────────────────────────────
const homeRedirect: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  // サインイン済なら /categories、未サインインなら /sign-in にリダイレクト
  return router.parseUrl(authService.signedIn() ? '/categories' : '/sign-in');
};

// ─────────────────────────────────────────────────────
// Backoffice (管理システム) のルート定義
//
// ルート登録順の注意:
//   静的パス (categories/new) は動的パス (categories/:id) より「先」に書く。
//   理由: ルート照合は上から順番に行われるため、:id を先に書くと
//         /categories/new の "new" が :id="new" として解釈され、CategoryDetail に飛んでしまう。
// ─────────────────────────────────────────────────────
export const routes: Routes = [
  // 空パス '/' は homeRedirect で振り分け (Step 7-E-1 で旧 redirectTo: 'categories' から変更)
  //   children: [] は「このルート自体には子コンポーネントが無い」ことを示すためのダミー。
  //   component も redirectTo も無いルートだと Angular が怒るので、空の children を付けて回避する。
  { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },

  // 認証画面 (Step 7-D-3 で本実装)
  { path: 'sign-in', component: SignIn },

  // 管理者新規登録 (Step 7-D-4 で追加)
  //   ⚠️ 学習用なので「誰でも作れる」状態。本番では招待制 or CLI 限定にすべき。
  //   静的パス '/admin/signup' は users/:id のような動的パスより前に置くこと。
  { path: 'admin/signup', component: AdminSignup },

  // ─────────────────────────────────────────────────────
  // ここから下のルートはすべて canActivate: [authGuard] で保護される
  //   未サインイン時にアクセスすると /sign-in に飛ばされる
  // ─────────────────────────────────────────────────────

  // カテゴリ管理 (4ページ)
  { path: 'categories', component: CategoryList, canActivate: [authGuard] },           // 一覧
  { path: 'categories/new', component: CategoryCreate, canActivate: [authGuard] },     // 新規作成 (静的パスを先)
  { path: 'categories/:id', component: CategoryDetail, canActivate: [authGuard] },     // 詳細 (:id はURLパラメータ)
  { path: 'categories/:id/edit', component: CategoryEdit, canActivate: [authGuard] },  // 編集

  // 商品管理 (4ページ。categories と同じ順序ルール: 静的パスを動的より先)
  { path: 'products', component: ProductList, canActivate: [authGuard] },             // 一覧
  { path: 'products/new', component: ProductCreate, canActivate: [authGuard] },       // 新規作成 (静的パスを先)
  { path: 'products/:id', component: ProductDetail, canActivate: [authGuard] },       // 詳細
  { path: 'products/:id/edit', component: ProductEdit, canActivate: [authGuard] },    // 編集

  // ユーザー管理 (CRUD 4画面。categories/products と同じ順序ルール: 静的パスを動的より先)
  { path: 'users', component: UserList, canActivate: [authGuard] },             // 一覧
  { path: 'users/new', component: UserCreate, canActivate: [authGuard] },       // 新規作成 (静的パスを先)
  { path: 'users/:id', component: UserDetail, canActivate: [authGuard] },       // 詳細
  { path: 'users/:id/edit', component: UserEdit, canActivate: [authGuard] },    // 編集

  // 注文履歴 (Phase 11 で新設)
  //   Step 11-4 でユーザー詳細から /orders?userId=N の形で遷移する想定
  { path: 'orders', component: OrderList, canActivate: [authGuard] },           // 一覧

  // ワイルドカード: 未定義のパス (タイポ・存在しないID等) は /categories に戻す
  // products/new や users/:id 等の未定義パスもここに吸収される (次フェーズで個別ルートを追加)
  { path: '**', redirectTo: 'categories' },
];
