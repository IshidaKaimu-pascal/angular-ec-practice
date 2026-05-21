// 📌 このファイルをひとことで言うと:
//   「管理者のログイン・新規登録・ログアウトを担当するファイル (backoffice 版)」
//
// 何をするファイル?
//   - サインイン画面・新規登録画面から呼ばれて、サーバーに「この管理者合ってる?」を問い合わせる
//   - ログイン成功時に発行された「身分証 (トークン)」をブラウザに保存しておく
//   - 今ログインしている管理者が誰か (名前・メール等) を画面に教える
//   - ログアウト時は身分証を捨ててログイン状態を解除する
//
// storefront 側の AuthService との違い:
//   - エンドポイント: /auth/admin/signin と /auth/admin/signup (admin 用)
//   - レスポンス形: { token, admin } (storefront は { token, user })
//   - 型: Admin (storefront は User)
//   - localStorage キー: admin_ プレフィックスを付けて衝突回避
//   - 公開 signal: currentAdmin (storefront は currentUser)
//
// 関連ファイル:
//   - auth.interceptor.ts  → 各通信に自動で身分証をくっつける係 (Step 7-D-2 で作る)
//   - api/src/routes/auth.ts → サーバー側の窓口 (ここに問い合わせる相手)

// ============================================================
// AuthService: 管理者向け認証状態の管理
// ------------------------------------------------------------
// 役割:
//   - サインイン / サインアップ / サインアウトの API 連携
//   - JWT トークンの保存・取得 (localStorage)
//   - 現在ログイン中の管理者情報を signal で公開
//
// JWT (JSON Web Token) とは:
//   サーバーが発行する「身分証カード」。サインイン時に発行され、
//   以降のリクエストで Authorization ヘッダで送信することで認証する。
//   このプロジェクトでは「Bearer <token>」形式で送る (auth.interceptor.ts 参照)。
//
// localStorage への保存:
//   ブラウザを閉じても再起動しても残るストレージ。
//   token と admin を保存することで「次回起動時にサインイン状態を復元」できる。
//   注意: XSS 攻撃で盗まれるリスクあり。本番では HttpOnly Cookie が推奨。
//
// currentAdmin の型 (Admin | null):
//   未ログイン時は null。サインイン成功時に本物の Admin オブジェクトが入る。
//   AuthGuard が保護ルートをガードしているため、保護画面で currentAdmin() が
//   null になることは実行時には起きないが、テンプレートでは型上の null チェックが必要。
// ============================================================

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { Admin } from 'shared';

// ============================================================
// API レスポンスの型定義
//   /auth/admin/signin と /auth/admin/signup の戻り値は両方とも
//   { token: string, admin: Admin } の形 (api/src/routes/auth.ts 参照)
// ============================================================
export interface AuthResponse {
  token: string;
  admin: Admin;
}

// サインアップ時にフォームから送る情報 (Admin は address/phone 無し)
export interface SignUpPayload {
  name: string;
  email: string;
  password: string;
}

// localStorage のキー名を定数化 (typo 防止 + storefront と衝突回避のため admin_ プレフィックス)
const TOKEN_KEY = 'admin_auth_token';
const ADMIN_KEY = 'admin_auth_admin';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  // サインアウト後のリダイレクト用に Router を注入
  //   (UI 都合ではなく認証フロー全体のルールなので、ナビゲーションも AuthService に集約)
  private readonly router = inject(Router);
  private readonly baseUrl = 'http://localhost:3000/auth';

  // 現在ログイン中の管理者情報を保持する signal
  //   起動時に localStorage に保存済の admin があれば復元、なければ null (未ログイン)
  //   保護ルートは AuthGuard が弾くので、保護画面では null にならない前提で良い。
  private readonly _currentAdmin = signal<Admin | null>(this.loadAdminFromStorage());

  // 外部公開用: 読み取り専用 (書き換えは AuthService 経由のみ)
  readonly currentAdmin = this._currentAdmin.asReadonly();

  // ============================================================
  // signedIn: サインイン状態を表す signal
  // ------------------------------------------------------------
  // token の有無で判定する。ヘッダーのメニュー出し分け等で使う。
  //
  // 初期値:
  //   起動時に localStorage に token があれば true、無ければ false。
  //   サインイン/サインアウト時に applyAuthResponse / signOut から更新される。
  //
  // signal 化する理由:
  //   普通の関数 isSignedIn() でも判定できるが、テンプレートで「変化を検知して再描画」
  //   させるには signal が必須。signal なら set() の度に依存箇所が自動で更新される。
  // ============================================================
  private readonly _signedIn = signal<boolean>(this.getToken() !== null);
  readonly signedIn = this._signedIn.asReadonly();

  // ============================================================
  // getToken: localStorage から JWT トークンを取り出す
  //   主に HttpInterceptor から呼ばれて、Authorization ヘッダに付与される。
  //   token が無い (未ログイン) 場合は null を返す。
  // ============================================================
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // ============================================================
  // signIn: 管理者のサインイン
  //   API を叩いて token + admin を取得し、localStorage と signal に保存する。
  //
  //   引数:
  //     email, password — フォームから入力された認証情報
  //   戻り値:
  //     AuthResponse を流す Observable (subscribe して成功/失敗を扱う)
  // ============================================================
  signIn(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/admin/signin`, { email, password })
      .pipe(
        // tap: Observable のストリームを「素通りさせつつ副作用を実行する」演算子
        //   レスポンスをそのまま下流に流しつつ、ここでストレージ保存と signal 更新を行う
        tap((res) => this.applyAuthResponse(res)),
      );
  }

  // ============================================================
  // signUp: 管理者の新規登録
  //   API を叩いて新規管理者作成 + そのままサインイン状態にする。
  //   signIn と同じく token + admin が返ってくるので applyAuthResponse で保存。
  //
  //   ⚠️ セキュリティ警告: 現在は「誰でも管理者を作れる」設計 (学習用)。
  //   本番では招待制 or CLI 限定にすべき (api/src/routes/auth.ts のコメント参照)。
  // ============================================================
  signUp(payload: SignUpPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/admin/signup`, payload)
      .pipe(tap((res) => this.applyAuthResponse(res)));
  }

  // ============================================================
  // signOut: サインアウト処理
  // ------------------------------------------------------------
  // やること: token と admin を消し、signal を未ログイン状態に戻し、サインイン画面へ遷移
  //
  // 穴埋め ToDo-1: currentAdmin signal を「未ログイン状態」に戻す処理を書いてください
  // ------------------------------------------------------------
  // ヒント:
  //   - _currentAdmin の型は signal<Admin | null> なので、null を入れられる
  //   - this._currentAdmin.set(???) の ??? に何を入れるかを考える
  //   - 「未ログイン = 管理者情報が無い」をそのまま表す値は何でしょう?
  //   - storefront の auth.service.ts の signOut() と完全に同じパターン
  // ============================================================
  signOut(): void {
    // サインアウト時にトークン、管理者情報を削除する
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);

    // 1 ここに currentAdmin signal
    this._currentAdmin.set(null);

    // サインイン状態を false にしてヘッダーのメニューを隠す
    this._signedIn.set(false);
    console.log('管理者がサインアウトしました');
    // サインアウト後はサインイン画面に飛ばす (未認証で画面に留まるのを防ぐ)
    this.router.navigate(['/sign-in']);
  }

  // ============================================================
  // applyAuthResponse: 認証成功レスポンスを受けて状態を更新
  //   signIn / signUp の両方で使う共通処理。
  //   1. localStorage に token と admin を保存
  //   2. signal を更新 (画面が自動再描画される)
  //
  //   private にしている理由:
  //     外部から勝手に「サインイン状態にする」のは危険なので内部限定にする
  // ============================================================
  private applyAuthResponse(res: AuthResponse): void {
    // token は文字列なのでそのまま保存
    localStorage.setItem(TOKEN_KEY, res.token);
    // admin はオブジェクトなので JSON.stringify で文字列化してから保存
    //   (localStorage は文字列しか保存できない)
    localStorage.setItem(ADMIN_KEY, JSON.stringify(res.admin));
    // signal を更新 → 購読中のテンプレートが自動再描画される
    this._currentAdmin.set(res.admin);
    // サインイン状態を true にしてヘッダーのメニュー等を表示させる
    this._signedIn.set(true);
  }

  // ============================================================
  // loadAdminFromStorage: 起動時に localStorage から admin を復元
  //   token と admin の両方が揃っている時だけ復元する。
  //   どちらか欠けていれば null を返して「未ログイン」状態にする。
  //
  //   JSON.parse の失敗対策:
  //     localStorage の中身を手動で書き換えられていると JSON.parse が例外を投げる。
  //     try/catch で握りつぶし、安全に未ログイン状態にフォールバックする。
  // ============================================================
  private loadAdminFromStorage(): Admin | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const adminJson = localStorage.getItem(ADMIN_KEY);
    if (!token || !adminJson) return null;
    try {
      return JSON.parse(adminJson) as Admin;
    } catch {
      // パース失敗 → 壊れたデータを掃除して未ログイン状態にフォールバック
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
      return null;
    }
  }
}
