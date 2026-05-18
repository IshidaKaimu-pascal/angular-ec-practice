import { Component, inject } from '@angular/core';
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
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

// クロスフィールドバリデーター: FormGroup 全体に対するバリデーション関数
// (1つの FormControl だけでは判断できない「複数フィールド間の関係」を検証する仕組み)
//
// 戻り値:
//   - null → エラーなし
//   - { keyName: true } のようなオブジェクト → エラーあり
//     (テンプレート側で form.errors?.['keyName'] でチェックできる)
const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const newPwd = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  // 両方未入力なら判定保留(required validator が拾うのでここでは null を返す)
  if (!newPwd || !confirm) return null;
  return newPwd === confirm ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-password-change',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './password-change.html',
  styleUrl: './password-change.scss',
})
export class PasswordChange {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  // FormGroup の第2引数で「グループ全体のバリデーター」を渡す
  // 個別のFormControl の validators とは別物
  protected readonly form = new FormGroup(
    {
      // 「現在のパスワード」は今は認証未実装のため UI 上の体裁としてだけ存在
      // 将来 AuthService.verifyPassword で検証する想定
      currentPassword: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      newPassword: new FormControl<string>('', {
        nonNullable: true,
        // minLength(6): 6文字以上を要求
        validators: [Validators.required, Validators.minLength(6)],
      }),
      confirmPassword: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator] }, // ← グループ全体のバリデーター登録
  );

  protected submitting = false;

  protected onSubmit(): void {
    if (this.form.invalid) return;

    const userId = this.authService.currentUser().id;
    const newPassword = this.form.controls.newPassword.value;

    // 部分更新: password だけ送る
    this.submitting = true;
    this.userService.update(userId, { password: newPassword }).subscribe({
      next: () => {
        alert('パスワードを変更しました');
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('パスワード変更に失敗:', err);
        alert('パスワード変更に失敗しました');
        this.submitting = false;
      },
    });
  }
}
