import { Component, OnInit, inject, signal } from '@angular/core';
// Reactive Forms 用のモジュール (FormBuilder / Validators / ReactiveFormsModule)
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
// ActivatedRoute: 現在の URL に紐付くルート情報を取得するサービス (URL の :id を読む)
// Router: 画面遷移をプログラムから行うためのオブジェクト
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (キャンセルボタン用)
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// Angular Material のフォーム部品
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
// MatProgressSpinnerModule: ローディング中のクルクル表示用
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
// UserService: 取得・更新の API 呼び出し
//   UpdateUserPayload は全項目 optional → 「部分更新」を許容する設計
import { UserService, UpdateUserPayload } from '../../../services/user.service';

// ─────────────────────────────────────────────────────
// 設計方針メモ (Phase 6 後半に決定):
//   - backoffice の users は「customer データの保守」用途
//   - password 変更は storefront の /user/password ページで行う設計に変更
//     (このため password 入力欄をここから削除)
//   - role の選択も不要 (User テーブルは customer 一色として扱う。
//     admin は別テーブルで管理予定)
//
//   この方針変更により、本ファイルから password / role に関する一切の処理を撤去している
// ─────────────────────────────────────────────────────

@Component({
  selector: 'app-user-edit',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './user-edit.html',
  styleUrl: './user-edit.scss',
})
export class UserEdit implements OnInit {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  // ─────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // 編集対象のユーザーID (URL から取り出して ngOnInit でセット)
  protected userId!: number;

  // loading signal: 初回データ取得中フラグ (true の間スピナーを表示)
  protected readonly loading = signal<boolean>(true);

  // submitting signal: 送信中フラグ (二重送信防止)
  protected readonly submitting = signal<boolean>(false);

  // ─────────────────────────────────────────────────────
  // Reactive Forms: フォーム定義 (連絡先情報のみ)
  //   password / role はこの画面では扱わない (設計方針メモ参照)
  // ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    address: ['', [Validators.maxLength(200)]],
    phone: ['', [Validators.maxLength(20)]],
  });

  // ─────────────────────────────────────────────────────
  // ngOnInit: 流れ
  //   ① URL から :id 取り出し
  //   ② NaN ガード
  //   ③ getById で対象ユーザーを取得
  //   ④ patchValue でフォームに反映 (password / role は除く)
  //   ⑤ loading 解除
  // ─────────────────────────────────────────────────────
  ngOnInit(): void {
    // ① URL から :id を取り出す
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam === null) {
      this.router.navigate(['/users']);
      return;
    }

    // ② string → number 変換 + NaN ガード
    this.userId = Number(idParam);
    if (Number.isNaN(this.userId)) {
      this.router.navigate(['/users']);
      return;
    }

    // ③ API からユーザーを取得して反映
    this.userService.getById(this.userId).subscribe({
      next: (user) => {
        // 取得に成功した場合既存値をフォームに反映 (連絡先情報のみ)
        this.form.patchValue({
          name: user.name,
          email: user.email,
          address: user.address ?? '',
          phone: user.phone ?? '',
        });
        // 読み込み中を消す
        this.loading.set(false);
      },

      error: (err) => {
        // 取得失敗: ログ → loading 解除 → 一覧へ退避 (3点セット)
        console.error('ユーザー取得に失敗:', err);
        this.loading.set(false);
        this.router.navigate(['/users']);
      },
    });
  }

  // ─────────────────────────────────────────────────────
  // onSubmit: 「更新」ボタン押下時の処理
  // ─────────────────────────────────────────────────────
  onSubmit(): void {
    // ① バリデーションチェック
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // ② 送信中フラグを立てる
    this.submitting.set(true);

    // ③ ペイロード組立 (address / phone は空欄→null 変換)
    const raw = this.form.value;
    const address = raw.address?.trim() ? raw.address : null;
    const phone = raw.phone?.trim() ? raw.phone : null;

    // 連絡先情報のみのペイロード (password / role は送らない)
    const payload: UpdateUserPayload = {
      name: raw.name as string,
      email: raw.email as string,
      address: address,
      phone: phone,
    };

    // ④ 更新処理 (PUT /users/:id)
    this.userService.update(this.userId, payload).subscribe({
      next: () => {
        // 成功した場合一覧画面へ戻し、ボタンを解除
        this.router.navigate(['/users']);
        this.submitting.set(false);
      },

      error: (err) => {
        // 失敗した場合エラー文を出力し、ボタンを戻す
        //   例: メールアドレス重複で 500 が返るケースなど
        console.error('ユーザー更新に失敗:', err);
        this.submitting.set(false);
      },
    });
  }
}
