import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
// MatFormField + MatInput でテキスト入力のMaterial版を使う
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../services/auth.service';
import { UserService, UpdateUserPayload } from '../../services/user.service';

@Component({
  selector: 'app-user-settings',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './user-settings.html',
  styleUrl: './user-settings.scss',
})
export class UserSettings implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  // フォーム定義: 4項目すべて
  // - name, email は必須(required)
  // - email は形式チェック(Validators.email)
  // - address, phone は任意なので validator なし
  protected readonly form = new FormGroup({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    address: new FormControl<string>('', { nonNullable: true }),
    phone: new FormControl<string>('', { nonNullable: true }),
  });

  protected submitting = false;

  ngOnInit(): void {
    // 画面表示時に currentUser のデータをフォームに事前入力
    // patchValue: 一部または全部のフィールドを一括セット(set()と違って未指定フィールドは触らない)
    const user = this.authService.currentUser();
    this.form.patchValue({
      name: user.name,
      email: user.email,
      // null は patchValue だと型エラーになるので空文字に変換
      address: user.address ?? '',
      phone: user.phone ?? '',
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;

    const user = this.authService.currentUser();
    const values = this.form.getRawValue();

    // 空文字を null に戻して送る(API側で「住所未登録」を null として扱うため)
    const payload: UpdateUserPayload = {
      name: values.name,
      email: values.email,
      address: values.address || null,
      phone: values.phone || null,
    };

    this.submitting = true;
    this.userService.update(user.id, payload).subscribe({
      next: (updated) => {
        // 成功: AuthService の currentUser も最新化したい場面だが、
        // 現状 AuthService に setCurrentUser メソッドが無いので、簡易的に画面をリロードする方針
        // (本格実装時に AuthService.setCurrentUser(updated) を追加して呼ぶ予定)
        alert('保存しました');
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('ユーザー更新に失敗:', err);
        alert('保存に失敗しました');
        this.submitting = false;
      },
    });
  }
}
