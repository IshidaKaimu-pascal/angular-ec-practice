// 📌 このファイルをひとことで言うと:
//   「管理者ログイン画面のロジック (フォームの状態管理と送信処理)」
//
// 何をするファイル?
//   - メールとパスワードの入力フォームを管理する
//   - 送信ボタンが押されたら AuthService.signIn() に渡してサーバー認証する
//   - 成功すれば管理画面のトップへ、失敗すればエラーメッセージを表示する
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
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../services/auth.service';

// ============================================================
// デモアカウント (公開デモ用・提出時の動作確認用)
//   seed.ts で同じ email/password の Admin を投入済み。
//   ここの値を変える時は api/prisma/seed.ts の対応 admin も合わせる。
// ============================================================
const DEMO_EMAIL = 'admin@test.jp';
const DEMO_PASSWORD = 'admin123';

// ============================================================
// SignIn: 管理者サインイン (ログイン) 画面のコンポーネント
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
  //   フォームにデモ admin の値を流し込んでから onSubmit() を呼ぶことで、
  //   通常のサインインフロー (AuthService.signIn → API → 遷移) を流用する。
  //   submitting 中なら無視 (二重押下防止)。
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

   //サインイン関数実行時の処理
    this.authService.signIn(email, password).subscribe({
      // ▼ ここから ToDo-1 ▼
      next: () => {
        // ここに「成功時の処理」を書く
        this.router.navigate(['/']);
        //ボタンの送信中フラグを下げる
        this.submitting.set(false);
      },
      error: (err) => {
        // ここに「失敗時の処理」を書く
        console.error('サインインに失敗:', err);
        this.errorMessage.set(err.error?.message || 'メールまたはパスワードが違います');
        this.submitting.set(false);},
    });
  }
}
