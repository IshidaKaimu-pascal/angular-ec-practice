import { Component, inject, signal } from '@angular/core';
// Reactive Forms (リアクティブフォーム) 用のモジュール
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
// Router: 画面遷移をプログラムから行うためのオブジェクト
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (キャンセルボタン用)
import { Router, RouterLink } from '@angular/router';
// Angular Material のフォーム部品
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { UserService } from '../../../services/user.service';

// ─────────────────────────────────────────────────────
// 設計方針メモ (Phase 6 後半に決定):
//   - backoffice の users は「customer データの保守」用途
//   - role 選択は不要 (User テーブルは customer 一色として扱う。
//     admin は別テーブルで管理予定)
//   - password 欄は残す: 現スコープでは backoffice が唯一の新規登録手段のため。
//     将来 storefront にサインアップ実装が入ったらこの画面ごと不要になる予定
// ─────────────────────────────────────────────────────

@Component({
  selector: 'app-user-create',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './user-create.html',
  styleUrl: './user-create.scss',
})
export class UserCreate {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  // ─────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  // submitting signal: 送信中フラグ (作成ボタン押下〜API応答まで true)
  //   true の間ボタンを disabled にして二重送信を防ぐ
  protected readonly submitting = signal<boolean>(false);

  // ─────────────────────────────────────────────────────
  // Reactive Forms: フォーム定義 (連絡先情報 + 初期パスワード)
  //   role はフォームから外し、API送信時に 'customer' をハードコードする
  //
  // バリデーターの意味:
  //   - required:           空欄を禁止
  //   - maxLength(n):       n 文字以下のみ許可
  //   - Validators.email:   メール形式チェック
  //   - minLength(n):       n 文字以上のみ許可 (パスワードの強度確保用)
  // ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    // パスワード: 最低6文字、最大100文字
    //   現状の API は平文保存だが、将来 Step 4 で bcrypt 化予定 (users.ts の冒頭コメント参照)
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(100)]],
    // address / phone は任意項目: required を付けず maxLength のみ
    address: ['', [Validators.maxLength(200)]],
    phone: ['', [Validators.maxLength(20)]],
  });

  // ─────────────────────────────────────────────────────
  // onSubmit: 「作成」ボタン押下 (または Enter キー) で呼ばれる
  //   流れ: バリデーション → 送信中フラグON → ペイロード組立 → API呼び出し
  // ─────────────────────────────────────────────────────
  onSubmit(): void {
    // ① バリデーションチェック
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // ② 送信中フラグを立てる → ボタン disabled になる
    this.submitting.set(true);

    // ③ ペイロード組立
    const raw = this.form.value;

    // address と phone の値を「空欄なら null、入力があればそのまま」に変換
    //   - 三項演算子 + ?. + .trim() で空白だけも null 扱いにする
    const address = raw.address?.trim() ? raw.address : null;
    const phone   = raw.phone?.trim() ? raw.phone : null;

    // role はハードコード: backoffice からの新規登録は customer 固定
    const payload = {
      name: raw.name as string,
      email: raw.email as string,
      password: raw.password as string,
      role: 'customer' as const,
      address: address,
      phone: phone,
    };

    // ④ API 呼び出し (POST /users)
    this.userService.create(payload).subscribe({
      // 成功した場合一覧をリダイレクトする
      next: () => {
        this.router.navigate(['/users']);
        this.submitting.set(false);
      },

      error: (err) => {
        // 失敗した場合エラー文を出力し、ボタンを戻す
        //   例: メールアドレス重複 (DB の UNIQUE 制約違反) で 500 が返るケースなど
        console.error('ユーザー作成に失敗:', err);
        this.submitting.set(false);
      },
    });
  }
}
