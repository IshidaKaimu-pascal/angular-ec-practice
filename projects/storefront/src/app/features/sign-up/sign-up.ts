// 📌 このファイルをひとことで言うと:
//   「新規登録画面のロジック (フォーム + サーバー登録 + 自動ログイン)」
//
// 何をするファイル?
//   - 名前 / メール / パスワード等の入力フォームを管理する
//   - 送信ボタンが押されたら AuthService.signUp() に渡してサーバーに登録
//   - 登録成功時はそのままサインイン状態 (signUp の戻り値が token + user) でトップへ
//   - 失敗時 (重複メール等) はエラーメッセージを表示
//
// 関連ファイル:
//   - sign-up.html  → 画面の見た目
//   - auth.service.ts → 認証ロジック本体 (signUp の中で API 呼び出し)
//   - password-change.ts → passwordMatchValidator の参考実装

import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService, SignUpPayload } from '../../services/auth.service';

// ============================================================
// passwordMatchValidator: FormGroup 全体に対するクロスフィールドバリデーター
// ------------------------------------------------------------
// クロスフィールドバリデーターとは:
//   1つの FormControl だけでは判定できない「複数フィールド間の関係」を検証する仕組み。
//   FormGroup の `validators` オプションに渡して使う。
//
// 戻り値の規約:
//   null → エラーなし
//   { キー名: true } → エラーあり (テンプレート側で form.hasError('キー名') で拾える)
//
// 穴埋め ToDo-1 で完成させる (本体は空)。
// 参考: password-change.ts の同名 validator
// ============================================================
const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  //パスワードが確認用パスワードと一致しているかをチェック(両方とも入力されている場合のみ)
  return group.get('password')?.value === group.get('confirmPassword')?.value ? null : {passwordMismatch: true}; 
};

// ============================================================
// SignUp: 新規登録 (サインアップ) 画面のコンポーネント
// ------------------------------------------------------------
// signUp 成功時の挙動:
//   AuthService.signUp() は内部で token と user を localStorage に保存する。
//   そのため、サインアップ完了時点で「サインイン済み」状態になる。
//   ここではトップに遷移するだけで OK。
// ============================================================
@Component({
  selector: 'app-sign-up',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './sign-up.html',
  styleUrl: './sign-up.scss',
})
export class SignUp {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ============================================================
  // フォーム定義
  //   必須: name / email / password / confirmPassword
  //   任意: address / phone (string | null 型、空欄なら null)
  //   FormGroup 全体に passwordMatchValidator を適用
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
      // 任意項目: 空欄を許容するので null許容、Validators 無し
      address: new FormControl<string | null>(null),
      phone: new FormControl<string | null>(null),
    },
    { validators: [passwordMatchValidator] },
  );

  // 送信中フラグ (ボタンの二重押下防止 + ラベル切替)
  protected readonly submitting = signal<boolean>(false);

  // サーバー側エラーメッセージ (null なら非表示)
  protected readonly errorMessage = signal<string | null>(null);

  // ============================================================
  // onSubmit: 送信ボタンが押された時の処理
  //   1. バリデーションエラーがあれば送信しない
  //   2. フォーム値を SignUpPayload に整形して signUp() を呼ぶ
  //   3. 結果に応じて画面遷移 or エラー表示
  // ============================================================
  protected onSubmit(): void {
    if (this.form.invalid) return;

    // フォーム値を取り出して API 用の payload に整形
    //   address / phone は空文字なら null として送る (API 側で null 許容)
    const { name, email, password, address, phone } = this.form.getRawValue();
    const payload: SignUpPayload = {
      name,
      email,
      password,
      address: address || null,
      phone: phone || null,
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    //新規登録情報をAPIに送る
    this.authService.signUp(payload).subscribe({
      // ▼ ここから ToDo-2 ▼
      next: () => {
        // topに遷移
        this.router.navigate(['/']);
        // 送信中フラグを下げる
        this.submitting.set(false);
      },
      error: (err) => {
        // ここに「失敗時の処理」を書く
        console.error('サインアップに失敗:', err);
        this.errorMessage.set(err.error?.message || '登録に失敗しました');
        this.submitting.set(false);
      },
    });
  }
}
