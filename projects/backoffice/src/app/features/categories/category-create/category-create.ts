import { Component, inject, signal } from '@angular/core';
// Reactive Forms (リアクティブフォーム) 用のモジュール
//   - FormBuilder: FormGroup を簡潔に組み立てるヘルパー
//   - ReactiveFormsModule: テンプレートで [formGroup] / formControlName を使えるようにする
//   - Validators: 必須/長さ/最小値/正規表現などの組み込みバリデータ
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
// Router: 画面遷移をプログラムから行うためのオブジェクト
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (キャンセルボタン用)
import { Router, RouterLink } from '@angular/router';
// Angular Material のフォーム部品
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CategoryService } from '../../../services/category.service';

@Component({
  selector: 'app-category-create',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './category-create.html',
  styleUrl: './category-create.scss',
})
export class CategoryCreate {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  //   旧スタイル constructor(private fb: FormBuilder) と等価だが、
  //   inject() 方式の方が継承や型推論で扱いやすい (Angular 14+ 推奨)
  // ─────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly router = inject(Router);

  // submitting signal: 送信中フラグ
  //   送信ボタン押下〜API応答まで true になり、ボタンを disabled にする (二重送信防止)
  //   signal: Angular 17+ の新しい状態管理。.set() で更新、() で読み取り
  protected readonly submitting = signal<boolean>(false);

  // ─────────────────────────────────────────────────────
  // Reactive Forms: フォーム定義
  //   - クラス側で FormGroup を作り、テンプレート側の formControlName と紐付ける方式
  //   - this.form.value で全フィールドの値、this.form.valid で全体の妥当性を取得できる
  //
  // Validators (組み込みバリデータ) の意味:
  //   - required:    空欄を禁止
  //   - maxLength(n): n 文字以下のみ許可
  //   - min(n):      n 以上の数値のみ許可
  //   - pattern(/^\d+$/): 「数字1文字以上」のみ許可 = 小数点や負号を弾いて整数を強制
  //
  //   displayOrder の初期値を '' (空文字) にする理由:
  //     0 を初期値にすると required を満たしてしまい、ユーザーが空欄に気付かず送信できる
  //     空文字にしておけば required がきちんと働き、入力されたことが保証される
  // ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    displayOrder: ['', [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
  });

  // ─────────────────────────────────────────────────────
  // onSubmit: 「作成」ボタン押下 (または Enter キー) で呼ばれる
  //   流れ: バリデーション → 送信中フラグON → ペイロード組立 → API呼び出し
  // ─────────────────────────────────────────────────────
  onSubmit(): void {
    // ① バリデーションチェック
    //   form.invalid = どこかのコントロールでバリデータが失敗している
    //   markAllAsTouched(): 全コントロールを「触った状態」にしてエラー表示を強制
    //     (mat-error は touched にならないと表示されない仕様のため)
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // ② 送信中フラグを立てる → ボタン disabled になる
    this.submitting.set(true);

    // ③ ペイロード組立
    //   displayOrder は type="number" でも文字列として入ることがあるため Number() で確実に数値化
    //   raw.name は string | null | undefined 型のため as string でキャスト (バリデーションで required 通過済み)
    const raw = this.form.value;
    const payload = {
      name: raw.name as string,
      displayOrder: Number(raw.displayOrder),
    };

    //   - this.categoryService.create(payload) は Observable<Category> を返す
    //   - .subscribe({ next: ..., error: ... }) で実際に HTTP リクエストが飛ぶ
    //   - next: 成功時。this.router.navigate(['/categories']) で一覧画面へ戻す
    //           最後に this.submitting.set(false) でフラグを戻す
    //   - error: 失敗時。console.error('カテゴリ作成に失敗:', err) でエラー出力
    //           最後に this.submitting.set(false) でフラグを戻す (戻さないとボタンが固まる)
    this.categoryService.create(payload).subscribe({
      next: () => {
        //成功した場合カテゴリ一覧画面に戻す
        this.router.navigate(['/categories']);
        this.submitting.set(false);
      },

      error: (err) => {
        //失敗した場合エラー文を出力し、ボタンを戻す
        console.error('カテゴリ作成に失敗:', err);
        this.submitting.set(false);
      }
      
    });
  }
}
