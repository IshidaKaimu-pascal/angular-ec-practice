// 📌 このファイルをひとことで言うと:
//   「管理者の新規登録画面のロジック (フォームの状態管理と送信処理)」
//
// 何をするファイル?
//   - 名前・メール・パスワード・パスワード確認の 4 項目を持つフォームを管理する
//   - パスワードと確認用が一致しているかをチェックする
//   - 送信ボタンが押されたら AuthService.signUp() に渡してサーバーで管理者作成
//   - 成功すれば自動でサインイン状態 + 管理画面トップへ遷移
//
// ⚠️ セキュリティ警告 (本番運用時は注意):
//   現在の実装では「誰でも管理者アカウントを作成できる」状態。
//   学習用なのでシンプルに保っているが、本番環境では:
//     - 初期 admin は CLI スクリプトで作成
//     - 以降は既存 admin による「招待制」または手動承認
//   のいずれかにすべき。
//   サーバー側の api/src/routes/auth.ts のコメントも参照。

import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../services/auth.service';

// ============================================================
// passwordMatchValidator: FormGroup 全体に適用するクロスフィールド検証
// ------------------------------------------------------------
// 普通の Validator は 1 フィールドに付くが、ここでは「password と confirmPassword の値を
// 比較する」必要があるため、FormGroup 全体に付ける形にする。
//
// 戻り値:
//   ValidationErrors (例: { passwordMismatch: true }) → エラーあり
//   null                                             → エラー無し
//
// 穴埋め ToDo-1: パスワード一致チェックの中身を埋めてください
// ------------------------------------------------------------
// やること:
//   - control.get('password') と control.get('confirmPassword') で各 FormControl を取得
//   - .value で値を取り出して比較
//   - 一致しなければ { passwordMismatch: true }、一致すれば null を返す
//
// 注意点 (storefront 版で踏んだ落とし穴):
//   - control.get('xxx')?.value のように Optional chaining を使うと、
//     control 自体が見つからない場合 (= undefined) も "値の比較" が成立してしまう。
//     両方 undefined だと "一致扱い" になるので、初期化漏れの検知にも使える。
//   - 厳密にやるなら control.get('password')?.value === control.get('confirmPassword')?.value
//     の "両方 undefined ではないかつ一致" を判定する書き方もある。今回はシンプル比較で OK。
//
// 参考: storefront の sign-up.ts に同じ実装あり (passwordMatchValidator)
// ============================================================
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  //パスワードと確認用パスワードが一致しているかをチェック
  return password === confirmPassword ? null : { passwordMismatch: true };
  
}

// ============================================================
// AdminSignup: 管理者新規登録画面のコンポーネント
// ============================================================
@Component({
  selector: 'app-admin-signup',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './admin-signup.html',
  styleUrl: './admin-signup.scss',
})
export class AdminSignup {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ============================================================
  // フォーム定義: name / email / password / confirmPassword の 4 項目
  //   - Admin スキーマには address / phone は無い (User と違う)
  //   - FormGroup に validators: [passwordMatchValidator] を付けて
  //     password と confirmPassword の一致チェックを行う
  // ============================================================
  protected readonly form = new FormGroup(
    {
      name: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      email: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      confirmPassword: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator] },
  );

  // 送信中フラグ (二重押下防止 + ボタンラベル切り替え)
  protected readonly submitting = signal<boolean>(false);

  // サーバーから返ったエラーメッセージ (null なら未エラー = 非表示)
  protected readonly errorMessage = signal<string | null>(null);

  // ============================================================
  // onSubmit: 送信ボタンが押された時の処理
  //   1. バリデーションエラーがあれば送信しない (二重ガード)
  //   2. signUp() を呼び、結果に応じて画面遷移 or エラー表示
  // ============================================================
  protected onSubmit(): void {
    if (this.form.invalid) return;

    // フォームから 4 項目を取り出す (confirmPassword は API 送信不要なので分離)
    const { name, email, password } = this.form.getRawValue();

    this.submitting.set(true);
    this.errorMessage.set(null);

    //サインアップ関数実行
    this.authService.signUp({ name, email, password }).subscribe({
      // ▼ ここから ToDo-2 ▼
      next: () => {
        // ここに「成功時の処理」を書く
        this.router.navigate(['/']);
        this.submitting.set(false);
      },
      error: (err) => {
        // ここに「失敗時の処理」を書く
        // 409 (email 重複) の場合は err.error?.message に日本語メッセージが入っている
        console.error('サインアップに失敗:',err);
        this.errorMessage.set(err.error?.message || '登録に失敗しました');
        this.submitting.set(false);
      },
    });
  }
}
