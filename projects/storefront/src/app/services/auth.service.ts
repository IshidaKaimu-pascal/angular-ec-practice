// 📌 このファイルをひとことで言うと:
//   「ログイン・新規登録・ログアウトを担当するファイル」
//
// 何をするファイル?
//   - ログイン画面・新規登録画面から呼ばれて、サーバーに「この人合ってる?」を問い合わせる
//   - ログイン成功時に発行された「身分証 (トークン)」をブラウザに保存しておく
//   - 今ログインしている人が誰か (名前・メール等) を画面に教える
//   - ログアウト時は身分証を捨ててログイン状態を解除する
//
// 関連ファイル:
//   - auth.interceptor.ts  → 各通信に自動で身分証をくっつける係
//   - api/src/routes/auth.ts → サーバー側の窓口 (ここに問い合わせる相手)

// ============================================================
// AuthService: 認証状態の管理 (Phase 7 で本格化)
// ------------------------------------------------------------
// 役割:
//   - サインイン / サインアップ / サインアウトの API 連携
//   - JWT トークンの保存・取得 (localStorage)
//   - 現在ログイン中のユーザー情報を signal で公開
//
// JWT (JSON Web Token) とは:
//   サーバーが発行する「身分証カード」。サインイン時に発行され、
//   以降のリクエストで Authorization ヘッダで送信することで認証する。
//   このプロジェクトでは「Bearer <token>」形式で送る (auth.interceptor.ts 参照)。
//
// localStorage への保存:
//   ブラウザを閉じても再起動しても残るストレージ。
//   token と user を保存することで「次回起動時にサインイン状態を復元」できる。
//   注意: XSS 攻撃で盗まれるリスクあり。本番では HttpOnly Cookie が推奨。
//
// currentUser の型 (Step 7-C-4 ② で User | null に変更):
//   未ログイン時は null。サインイン成功時に本物の User オブジェクトが入る。
//   AuthGuard が保護ルートをガードしているため、保護画面で currentUser() が
//   null になることは実行時には起きないが、テンプレートでは型上の null チェックが必要。
// ============================================================

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { User } from 'shared';

// ============================================================
// API レスポンスの型定義
//   /auth/customer/signin と /auth/customer/signup の戻り値は両方とも
//   { token: string, user: User } の形 (api/src/routes/auth.ts 参照)
// ============================================================
export interface AuthResponse {
  token: string;
  user: User;
}

// サインアップ時にフォームから送る情報
export interface SignUpPayload {
  name: string;
  email: string;
  password: string;
  address?: string | null;
  phone?: string | null;
}

// localStorage のキー名を定数化 (typo 防止)
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  // サインアウト後のリダイレクト用に Router を注入
  //   (UI 都合ではなく認証フロー全体のルールなので、ナビゲーションも AuthService に集約)
  private readonly router = inject(Router);
  private readonly baseUrl = 'http://localhost:3000/auth';

  // 現在ログイン中のユーザー情報を保持する signal
  //   起動時に localStorage に保存済の user があれば復元、なければ null (未ログイン)
  //   保護ルートは AuthGuard が弾くので、保護画面では null にならない前提で良い。
  private readonly _currentUser = signal<User | null>(this.loadUserFromStorage());

  // 外部公開用: 読み取り専用 (書き換えは AuthService 経由のみ)
  readonly currentUser = this._currentUser.asReadonly();

  // ============================================================
  // signedIn: サインイン状態を表す signal
  // ------------------------------------------------------------
  // currentUser はダミーフォールバックがあるため「ログイン中かどうか」の判定には使えない。
  // token の有無で判定する signedIn を別途用意し、ヘッダーのメニュー出し分け等で使う。
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
  // signIn: 顧客のサインイン
  //   API を叩いて token + user を取得し、localStorage と signal に保存する。
  //
  //   引数:
  //     email, password — フォームから入力された認証情報
  //   戻り値:
  //     AuthResponse を流す Observable (subscribe して成功/失敗を扱う)
  // ============================================================
  signIn(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/customer/signin`, { email, password })
      .pipe(
        // tap: Observable のストリームを「素通りさせつつ副作用を実行する」演算子
        //   レスポンスをそのまま下流に流しつつ、ここでストレージ保存と signal 更新を行う
        tap((res) => this.applyAuthResponse(res)),
      );
  }

  // ============================================================
  // signUp: 顧客の新規登録
  //   API を叩いて新規ユーザー作成 + そのままサインイン状態にする。
  //   signIn と同じく token + user が返ってくるので applyAuthResponse で保存。
  // ============================================================
  signUp(payload: SignUpPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/customer/signup`, payload)
      .pipe(tap((res) => this.applyAuthResponse(res)));
  }

  // ============================================================
  // signOut: サインアウト処理
  // ------------------------------------------------------------
  // やること: token と user を消し、signal を未ログイン状態に戻し、サインイン画面へ遷移
  //
  // 穴埋め ToDo-1: currentUser signal を「未ログイン状態」に戻す処理を書いてください
  // ------------------------------------------------------------
  // ヒント:
  //   - _currentUser の型は signal<User | null> に変わったため、null を入れられる
  //   - this._currentUser.set(???) の ??? に何を入れるかを考える
  //   - 旧コードでは DUMMY_USER を入れていたが、ダミーは撤去したので別の値が必要
  //   - 「未ログイン = ユーザー情報が無い」をそのまま表す値は何でしょう?
  // ============================================================
  signOut(): void {
    // サインアウト時にトークン、ユーザーを削除する
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // 1 ここに currentUser signal を未ログイン状態に戻す
    this._currentUser.set(null);

    // サインイン状態を false にしてヘッダーのメニューを隠す
    this._signedIn.set(false);
    console.log('サインアウトしました');
    // サインアウト後はサインイン画面に飛ばす (未認証で画面に留まるのを防ぐ)
    this.router.navigate(['/sign-in']);
  }

  // ============================================================
  // applyAuthResponse: 認証成功レスポンスを受けて状態を更新
  //   signIn / signUp の両方で使う共通処理。
  //   1. localStorage に token と user を保存
  //   2. signal を更新 (画面が自動再描画される)
  //
  //   private にしている理由:
  //     外部から勝手に「サインイン状態にする」のは危険なので内部限定にする
  // ============================================================
  private applyAuthResponse(res: AuthResponse): void {
    // token は文字列なのでそのまま保存
    localStorage.setItem(TOKEN_KEY, res.token);
    // user はオブジェクトなので JSON.stringify で文字列化してから保存
    //   (localStorage は文字列しか保存できない)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    // signal を更新 → 購読中のテンプレートが自動再描画される
    this._currentUser.set(res.user);
    // サインイン状態を true にしてヘッダーのメニュー等を表示させる
    this._signedIn.set(true);
  }

  // ============================================================
  // loadUserFromStorage: 起動時に localStorage から user を復元
  //   token と user の両方が揃っている時だけ復元する。
  //   どちらか欠けていれば null を返して「ダミーで起動」させる。
  //
  //   JSON.parse の失敗対策:
  //     localStorage の中身を手動で書き換えられていると JSON.parse が例外を投げる。
  //     try/catch で握りつぶし、安全にダミー起動にフォールバックする。
  // ============================================================
  private loadUserFromStorage(): User | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (!token || !userJson) return null;
    try {
      return JSON.parse(userJson) as User;
    } catch {
      // パース失敗 → 壊れたデータを掃除してダミー起動に倒す
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
