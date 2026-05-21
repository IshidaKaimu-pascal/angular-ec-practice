import { Component, OnInit, inject, signal } from '@angular/core';
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
// MatSelectModule: カテゴリ選択用のドロップダウン (<mat-select> 部品)
import { MatSelectModule } from '@angular/material/select';
// MatProgressSpinnerModule: アップロード中のクルクル表示用
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService } from '../../../services/product.service';
// CategoryService: カテゴリ一覧をドロップダウンに表示するために使う
import { CategoryService } from '../../../services/category.service';
// UploadService: ファイル選択時にサーバーへ画像をアップロードし、
//   返却された URL を imageUrl コントロールに反映するためのサービス
import { UploadService } from '../../../services/upload.service';
import { Category } from 'shared';

@Component({
  selector: 'app-product-create',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './product-create.html',
  styleUrl: './product-create.scss',
})
export class ProductCreate implements OnInit {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  // ─────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  // UploadService: 画像アップロード API (POST /uploads) を呼び出す
  private readonly uploadService = inject(UploadService);
  private readonly router = inject(Router);

  // submitting signal: 送信中フラグ (作成ボタン押下〜API応答まで true)
  //   true の間ボタンを disabled にして二重送信を防ぐ
  protected readonly submitting = signal<boolean>(false);

  // uploading signal: 画像アップロード中フラグ
  //   true の間はファイル選択ボタン下にスピナーを出し、二重アップロードを防ぐ
  //   submitting と独立: フォーム送信中でなくてもアップロード中はあり得る
  protected readonly uploading = signal<boolean>(false);

  // categories signal: ドロップダウンに表示するカテゴリ一覧 (初期値は空配列)
  //   ngOnInit で API から取得して set する
  protected readonly categories = signal<Category[]>([]);

  // ─────────────────────────────────────────────────────
  // Reactive Forms: フォーム定義
  //
  // 各フィールドの初期値と型の方針:
  //   - 数値項目 (price/stock) の初期値を '' にする理由:
  //       0 を初期値にすると required を満たしてしまい、空欄に気付かず送信できてしまう
  //       空文字なら required が機能する
  //   - description / imageUrl は string で受け取り、空欄の場合は onSubmit で null に変換
  //
  // Validators の意味:
  //   - required:    空欄を禁止
  //   - maxLength(n): n 文字以下のみ許可
  //   - min(n):      n 以上の数値のみ許可
  //   - pattern(/^\d+$/): 「数字1文字以上」のみ許可 = 整数のみ (小数点・負号は弾く)
  // ─────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    price: ['', [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
    imageUrl: ['', [Validators.maxLength(500)]],
    stock: ['', [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
    categoryId: ['', [Validators.required]],
  });

  // ─────────────────────────────────────────────────────
  // ngOnInit: コンポーネント生成直後に呼ばれる Angular ライフサイクル
  //   ここで loadCategories() を呼んでカテゴリ一覧を取得し、ドロップダウンに反映する
  // ─────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadCategories();
  }

  // ─────────────────────────────────────────────────────
  // loadCategories(): カテゴリ一覧を API から取得して categories signal にセット
  //   ドロップダウン (<mat-select>) はこの signal の中身をオプションとして表示する
  // ─────────────────────────────────────────────────────
  private loadCategories(): void {
    this.categoryService.getAll().subscribe({
      //signal(categories)にカテゴリ一覧をセット
      next: (data) => this.categories.set(data),
      error: (err) => console.error('カテゴリ一覧取得に失敗:', err),
    });
  }

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
    //   - 数値項目は Number() で確実に数値化 (input type="number" でも文字列で入るケースがある)
    //   - 文字列項目は as string でキャスト (バリデーションで required 通過済みのものは確実に string)
    const raw = this.form.value;

    // ─────────────────────────────────────────────────────
    // 穴埋め ToDo-2:
    //   description と imageUrl の値を「空欄なら null、入力があればそのまま」に変換する
    // ヒント:
    //   - 三項演算子で raw.description ? raw.description : null と書ける
    //   - もしくは raw.description?.trim() ? raw.description : null で空白だけも null にできる
    //   - 結果を const description / const imageUrl に入れて payload で使う
    // ─────────────────────────────────────────────────────
    const description = raw.description?.trim() ? raw.description : null; // ← ここを書き換える
    const imageUrl = raw.imageUrl?.trim() ? raw.imageUrl : null;    // ← ここを書き換える

    const payload = {
      name: raw.name as string,
      description: description,
      price: Number(raw.price),
      imageUrl: imageUrl,
      stock: Number(raw.stock),
      categoryId: Number(raw.categoryId),
    };

    //商品の作成
    this.productService.create(payload).subscribe({
      next: () => {
          //成功した場合商品一覧画面にリダイレクトしてボタンを戻す
          this.router.navigate(['/products']);
          this.submitting.set(false);
      },

      error: (err) => {
        //失敗した場合エラー文を出力し、ボタンを戻す
        console.error('商品作成に失敗:', err);
        this.submitting.set(false);
      }
    });
  }

  // ─────────────────────────────────────────────────────
  // onFileSelected(): <input type="file"> の (change) で呼ばれる
  //   流れ:
  //     1. event.target から HTMLInputElement へキャストして files を取得
  //     2. ファイル未選択ならガードして終了
  //     3. uploading フラグを立てて API 呼び出し
  //     4. 成功時: 返却された url を form の imageUrl コントロールに流し込む (穴埋め)
  //     5. 失敗時: console.error してフラグ解除
  //   ※ product-edit.ts の onFileSelected と完全に同じパターン
  // ─────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    // ① event.target は EventTarget 型なので HTMLInputElement にキャストして
    //    files プロパティ (FileList | null) を取り出す
    //    files?.[0] のオプショナルチェーンで null/undefined を安全にスキップ
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // ② ファイル未選択 (ダイアログでキャンセル等) は何もせず終了
    if (!file) {
      return;
    }

    // ③ アップロード中フラグを立てる (テンプレート側でスピナー表示)
    this.uploading.set(true);

    // ④ UploadService 経由で POST /uploads を呼び出し
    this.uploadService.upload(file).subscribe({
      // ─────────────────────────────────────────────────────
      // 穴埋め Phase 3-C ToDo-1:
      //   アップロード成功時の処理 (next ハンドラの中身)
      // ヒント:
      //   - res は { url: string } の形 (UploadService の戻り値型)
      //   - this.form.controls.imageUrl.patchValue(res.url) で URL を流し込む
      //   - 最後に this.uploading.set(false) でフラグを解除
      //   ※ product-edit.ts の同じ箇所と完全に同じパターン
      // ─────────────────────────────────────────────────────
      next: (res) => {
        // アップロード成功: URL を反映
        //   patchValue は「指定したフィールドだけ」値を更新する API。
        //   setValue は全フィールド網羅指定が必須なので、1 つだけ更新したい今回は patchValue が適切。
        this.form.controls.imageUrl.patchValue(res.url);
        // アップロード中表示を解除
        //   signal の .set(false) でテンプレート側の @if (uploading()) も自動再評価されてスピナーが消える
        this.uploading.set(false);
      },
      error: (err) => {
        // アップロード失敗: 原因を Console に出して、フラグも下ろす
        //   (フォーム本体の入力はそのままなので、ユーザーは URL 直貼り or 再試行できる)
        console.error('画像アップロードに失敗:', err);
        this.uploading.set(false);
      },
    });
  }
}
