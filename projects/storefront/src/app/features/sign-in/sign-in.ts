// 📌 このファイルをひとことで言うと:
//   「ログイン画面のロジック (フォームの状態管理と送信処理)」
//
// 何をするファイル?
//   - メールとパスワードの入力フォームを管理する
//   - 送信ボタンが押されたら AuthService.signIn() に渡してサーバー認証する
//   - 成功すればトップへ、失敗すればエラーメッセージを表示する
//
// 関連ファイル:
//   - sign-in.html  → 画面の見た目 (この TS が状態を渡す)
//   - auth.service.ts → 認証ロジック本体 (signIn の中で API 呼び出し)

import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../services/auth.service';

// ============================================================
// デモアカウント (公開デモ用・提出時の動作確認用)
//   seed.ts で同じ email/password の User を投入済み。
//   ここの値を変える時は api/prisma/seed.ts の対応ユーザーも合わせる。
// ============================================================
const DEMO_EMAIL = 'user@test.jp';
const DEMO_PASSWORD = 'password123';

// ============================================================
// SignIn: サインイン (ログイン) 画面のコンポーネント
// ------------------------------------------------------------
// Reactive Forms とは:
//   FormGroup / FormControl を TS 側で組み立てて HTML と紐付ける Angular の入力フォーム機構。
//   テンプレート駆動 (ngModel) より型安全で、バリデーションも書きやすい。
//
// signal とは:
//   Angular 17+ の新しい状態管理機構。値が変わると依存するテンプレートが自動再描画される。
//   読む時: signal()、書く時: signal.set(値)
// ============================================================
@Component({
  selector: 'app-sign-in',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
})
export class SignIn {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  // Step 7-E-2: クエリパラメータ ?returnUrl=... を読むために ActivatedRoute を inject
  //   例: /sign-in?returnUrl=/checkout でサインイン後 /checkout に飛ばすのに使う
  private readonly route = inject(ActivatedRoute);

  // ============================================================
  // フォーム定義: email + password の 2 フィールド
  //   nonNullable: true により value は string で取れる (null にならない)
  //   Validators.email: HTML5 の type="email" より厳密な形式チェック
  //   minLength(6): API 側のサインアップ最小長と合わせる
  // ============================================================
  protected readonly form = new FormGroup({
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  // 送信中フラグ (ボタンの二重押下防止 + ボタンラベル切り替えに使う)
  protected readonly submitting = signal<boolean>(false);

  // サーバーから返ったエラーメッセージ (null なら未エラー = 非表示)
  protected readonly errorMessage = signal<string | null>(null);

  // テンプレート側で表示するデモアカウント情報
  //   HTML から {{ demoEmail }} のように参照できるよう protected で公開する
  protected readonly demoEmail = DEMO_EMAIL;
  protected readonly demoPassword = DEMO_PASSWORD;

  // ============================================================
  // onDemoSignIn: 「デモアカウントでサインイン」ボタン用
  //   フォームにデモアカウントの値を流し込んでから onSubmit() を呼ぶことで、
  //   通常のサインインフロー (AuthService.signIn → API 呼び出し → 遷移) を流用する。
  //   既に submitting 中なら無視 (二重押下防止)。
  // ============================================================
  protected onDemoSignIn(): void {
    if (this.submitting()) return;
    // setValue: フォーム全フィールドを一括更新 (patchValue と違い全項目必須)
    this.form.setValue({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    this.onSubmit();
  }

  // ============================================================
  // onSubmit: 送信ボタンが押された時の処理
  //   1. バリデーションエラーがあれば送信しない (二重ガード)
  //   2. signIn() を呼び、結果に応じて画面遷移 or エラー表示
  // ============================================================
  protected onSubmit(): void {
    if (this.form.invalid) return;

    // フォームから email/password を取り出す
    //   getRawValue は disabled なフィールドも含めて値を取る (慣例的な書き方)
    const { email, password } = this.form.getRawValue();

    this.submitting.set(true);
    this.errorMessage.set(null);

    // ============================================================
    // 穴埋め ToDo-1: subscribe の next / error コールバックを完成させてください
    // ------------------------------------------------------------
    // やること:
    //   next  → サインイン成功。トップへ遷移して submitting を false に戻す。
    //   error → サインイン失敗。エラーメッセージをセットして submitting を false に戻す。
    //
    // ヒント (next):
    //   - this.router.navigate(['/']) でトップ ('/') に遷移できる
    //   - this.submitting.set(false) で送信中フラグを下げる
    //   - 認証成功時の token / user 保存は AuthService 側で済んでいるので、
    //     ここでは画面遷移とフラグ操作だけで OK
    //
    // ヒント (error):
    //   - err.error?.message にサーバーからの日本語メッセージが入っている
    //     (api/src/routes/auth.ts でレスポンスを定義済み)
    //   - 無い場合は 'メールまたはパスワードが違います' をフォールバック表示
    //   - this.errorMessage.set(...) でメッセージを画面に出す
    //   - this.submitting.set(false) で送信中フラグを下げる
    //
    // 参考: password-change.ts の userService.update().subscribe({...}) と同じパターン
    // ============================================================
    this.authService.signIn(email, password).subscribe({
      // ▼ ここから ToDo-1 (完了済) ▼
      next: () => {
        // クエリ ?returnUrl=... から飛び先を取り出す (無ければ null)
        //   route.snapshot は「今この瞬間のスナップショット」。sign-in 画面では再取得不要なのでこれで十分
        //   queryParamMap.get('returnUrl') の戻り値は string | null (?returnUrl が無ければ null)
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl'); // ?returnUrl=...を取得する
        // returnUrl があればそこへ、無ければ '/' (トップ = homeRedirect で振り分け) へ
        //   ?? (Null 合体演算子): 左辺が null/undefined のときだけ右辺の '/' を使う
        //   navigateByUrl: '/checkout' のような URL 文字列を直接渡せる (navigate と違い配列ではない)
        this.router.navigateByUrl(returnUrl ?? '/');
        //送信中フラグを下げる (ボタンを再度押せる状態に戻す)
        this.submitting.set(false);
      },
      error: (err) => {
        // ここに「失敗時の処理」を書く
        console.error('サインインに失敗:', err);
        this.errorMessage.set(err.error?.message || 'メールまたはパスワードが違います');
        this.submitting.set(false);
      },
    });
  }
}
