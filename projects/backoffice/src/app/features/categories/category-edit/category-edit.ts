import { Component, OnInit, inject, signal } from '@angular/core';
// Reactive Forms (リアクティブフォーム) 用のモジュール
//   - FormBuilder: FormGroup を簡潔に組み立てるヘルパー
//   - ReactiveFormsModule: テンプレートで [formGroup] / formControlName を使えるようにする
//   - Validators: 必須/長さ/最小値/正規表現などの組み込みバリデータ
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
// ActivatedRoute: 現在の URL に紐付くルート情報を取得するサービス
//   snapshot.paramMap.get('id') で URL の :id 部分を文字列として取り出せる
// Router: 画面遷移をプログラムから行うためのオブジェクト
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (キャンセルボタン用)
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// Angular Material のフォーム部品
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
// MatProgressSpinnerModule: ローディング中のクルクル表示用
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryService } from '../../../services/category.service';

@Component({
  selector: 'app-category-edit',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './category-edit.html',
  styleUrl: './category-edit.scss',
})
export class CategoryEdit implements OnInit {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  // ─────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly router = inject(Router);
  // ActivatedRoute: URL の :id を読み取るために使う
  private readonly route = inject(ActivatedRoute);

  // ─────────────────────────────────────────────────────
  // 編集対象のカテゴリID
  //   URL から取り出した :id を number にキャストして保持
  //   constructor タイミングでは取得できないので ngOnInit で代入する
  //   (! は「初期化前に代入される」と TypeScript に伝える definite assignment assertion)
  // ─────────────────────────────────────────────────────
  protected categoryId!: number;

  // ─────────────────────────────────────────────────────
  // loading signal: 初回データ取得中フラグ
  //   true の間はフォームを表示せずスピナーを出す (まだ初期値が入っていないため)
  //   getById 完了 (成功 or 失敗) で false にする
  // ─────────────────────────────────────────────────────
  protected readonly loading = signal<boolean>(true);

  // submitting signal: 送信中フラグ (Create と同じ。二重送信防止)
  protected readonly submitting = signal<boolean>(false);

  // ─────────────────────────────────────────────────────
  // Reactive Forms: フォーム定義 (Create と同じバリデータ構成)
  //   - 編集画面でも入力ルールは同じ
  //   - 初期値は空にしておき、ngOnInit の patchValue で API 取得値を流し込む
  // ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    displayOrder: ['', [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
  });

  // ─────────────────────────────────────────────────────
  // ngOnInit: コンポーネント生成直後 (テンプレート描画前) に呼ばれる Angular ライフサイクル
  //   流れ: URLから:id取得 → API取得 → patchValueでフォームに反映 → loading解除
  // ─────────────────────────────────────────────────────
  ngOnInit(): void {
    // ① URL から :id を取り出す
    //   snapshot.paramMap.get('id') は string | null を返す
    //   null だった場合 (本来あり得ないが念のため) は一覧へ戻す
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam === null) {
      this.router.navigate(['/categories']);
      return;
    }

    // ② string → number に変換 (Number() は失敗時 NaN を返す)
    //   NaN になったら不正な URL なので一覧へ戻す
    this.categoryId = Number(idParam);
    if (Number.isNaN(this.categoryId)) {
      this.router.navigate(['/categories']);
      return;
    }

    //カテゴリ情報を取得する
    this.categoryService.getById(this.categoryId).subscribe({
      next: (category) =>{
       ///取得したカテゴリ情報を form に反映 (画面に既存値を表示)
        this.form.patchValue({name: category.name, 
                              displayOrder: String(category.displayOrder)});
      //取得成功: ローディング解除
        this.loading.set(false);
      },

      error:(err) =>{
        //取得失敗: 原因を Console に出す
        console.error('カテゴリ取得に失敗:',err);
        //失敗時もローディング表示は消す
        this.loading.set(false);
        //カテゴリ一覧に戻す
        this.router.navigate(['/categories']);
      }
    });
  }

  // ─────────────────────────────────────────────────────
  // onSubmit: 「更新」ボタン押下 (または Enter キー) で呼ばれる
  //   流れ: バリデーション → 送信中フラグON → ペイロード組立 → API呼び出し
  // ─────────────────────────────────────────────────────
  onSubmit(): void {
    // ① バリデーションチェック
    //   form.invalid = どこかのコントロールでバリデータが失敗している
    //   markAllAsTouched(): 全コントロールを「触った状態」にしてエラー表示を強制
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // ② 送信中フラグを立てる → ボタン disabled になる
    this.submitting.set(true);

    // ③ ペイロード組立
    //   UpdateCategoryPayload は両方 optional だが、フォーム経由なので両方とも値が入っている前提
    //   displayOrder は文字列で入ることがあるため Number() で確実に数値化
    const raw = this.form.value;
    const payload = {
      name: raw.name as string,
      displayOrder: Number(raw.displayOrder),
    };

    //編集後のカテゴリ情報を更新する
    this.categoryService.update(this.categoryId, payload).subscribe({
      next: () =>{
        //成功した場合カテゴリ一覧に戻す
        this.router.navigate(['/categories']);
        this.submitting.set(false);
      },
      error: (err) => {
        //失敗した場合エラー文を出力し、ボタンを戻す
        console.error('カテゴリ更新に失敗:',err);
        this.submitting.set(false);
      }
    });
  }
}
