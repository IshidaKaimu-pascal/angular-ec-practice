import { Routes } from '@angular/router';
// 各ページコンポーネントを eager loading でインポート
// (eager loading = 初回ロード時に全部まとめて読み込む方式。lazy loading の対義語)
// 規模が大きくなったら loadComponent で lazy loading に切り替える選択肢もある。
import { SignIn } from './features/sign-in/sign-in';
// 管理者新規登録 (Step 7-D-4 で追加)
import { AdminSignup } from './features/admin-signup/admin-signup';
// 認証ガード (auth.guard.ts) は学習用に残してあるが、提出時の動線をシンプルにするため
// 現在は適用していない。再有効化する時は各ルートに canActivate: [authGuard] を戻す。
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
// Backoffice (管理システム) のルート定義
//
// ルート登録順の注意:
//   静的パス (categories/new) は動的パス (categories/:id) より「先」に書く。
//   理由: ルート照合は上から順番に行われるため、:id を先に書くと
//         /categories/new の "new" が :id="new" として解釈され、CategoryDetail に飛んでしまう。
//
// 認証ガードについて:
//   提出時にサインインなしで各機能を確認できるよう、現在は authGuard を外している。
//   サインイン画面 (/sign-in) とサインイン処理自体は残してあるので、
//   デモアカウントでのサインインも引き続き可能。
// ─────────────────────────────────────────────────────
export const routes: Routes = [
  // 空パス '/' は /categories に直接リダイレクト
  //   pathMatch: 'full' は「URL が完全一致 (= '/' のみ) の時だけマッチ」の意味。
  //   付けないと「/」始まりの全 URL にマッチしてしまうため redirectTo では必須。
  { path: '', redirectTo: 'categories', pathMatch: 'full' },

  // 認証画面 (Step 7-D-3 で本実装)
  { path: 'sign-in', component: SignIn },

  // 管理者新規登録 (Step 7-D-4 で追加)
  //   ⚠️ 学習用なので「誰でも作れる」状態。本番では招待制 or CLI 限定にすべき。
  //   静的パス '/admin/signup' は users/:id のような動的パスより前に置くこと。
  { path: 'admin/signup', component: AdminSignup },

  // カテゴリ管理 (4ページ)
  { path: 'categories', component: CategoryList },           // 一覧
  { path: 'categories/new', component: CategoryCreate },     // 新規作成 (静的パスを先)
  { path: 'categories/:id', component: CategoryDetail },     // 詳細 (:id はURLパラメータ)
  { path: 'categories/:id/edit', component: CategoryEdit },  // 編集

  // 商品管理 (4ページ。categories と同じ順序ルール: 静的パスを動的より先)
  { path: 'products', component: ProductList },             // 一覧
  { path: 'products/new', component: ProductCreate },       // 新規作成 (静的パスを先)
  { path: 'products/:id', component: ProductDetail },       // 詳細
  { path: 'products/:id/edit', component: ProductEdit },    // 編集

  // ユーザー管理 (CRUD 4画面。categories/products と同じ順序ルール: 静的パスを動的より先)
  { path: 'users', component: UserList },             // 一覧
  { path: 'users/new', component: UserCreate },       // 新規作成 (静的パスを先)
  { path: 'users/:id', component: UserDetail },       // 詳細
  { path: 'users/:id/edit', component: UserEdit },    // 編集

  // 注文履歴 (Phase 11 で新設)
  //   Step 11-4 でユーザー詳細から /orders?userId=N の形で遷移する想定
  { path: 'orders', component: OrderList },           // 一覧

  // ワイルドカード: 未定義のパス (タイポ・存在しないID等) は /categories に戻す
  // products/new や users/:id 等の未定義パスもここに吸収される (次フェーズで個別ルートを追加)
  { path: '**', redirectTo: 'categories' },
];
