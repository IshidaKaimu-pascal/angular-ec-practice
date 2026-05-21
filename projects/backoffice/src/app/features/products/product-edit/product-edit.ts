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
// MatSelectModule: カテゴリ選択用のドロップダウン (<mat-select> 部品)
import { MatSelectModule } from '@angular/material/select';
// MatProgressSpinnerModule: ローディング中のクルクル表示用
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductService } from '../../../services/product.service';
// CategoryService: カテゴリ一覧をドロップダウンに表示するために使う
import { CategoryService } from '../../../services/category.service';
// UploadService: ファイル選択時にサーバーへ画像をアップロードし、
//   返却された URL を imageUrl コントロールに反映するためのサービス
import { UploadService } from '../../../services/upload.service';
import { Category } from 'shared';

@Component({
  selector: 'app-product-edit',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './product-edit.html',
  styleUrl: './product-edit.scss',
})
export class ProductEdit implements OnInit {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  // ─────────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  // UploadService: 画像アップロード API (POST /uploads) を呼び出す
  private readonly uploadService = inject(UploadService);
  private readonly router = inject(Router);
  // ActivatedRoute: URL の :id を読み取るために使う
  private readonly route = inject(ActivatedRoute);

  // ─────────────────────────────────────────────────────
  // 編集対象の商品ID
  //   URL から取り出した :id を number にキャストして保持
  //   constructor タイミングでは取得できないので ngOnInit で代入する
  //   (! は「初期化前に代入される」と TypeScript に伝える definite assignment assertion)
  // ─────────────────────────────────────────────────────
  protected productId!: number;

  // ─────────────────────────────────────────────────────
  // loading signal: 初回データ取得中フラグ
  //   true の間はフォームを表示せずスピナーを出す (まだ初期値が入っていないため)
  //   getById 完了 (成功 or 失敗) で false にする
  // ─────────────────────────────────────────────────────
  protected readonly loading = signal<boolean>(true);

  // submitting signal: 送信中フラグ (Create と同じ。二重送信防止)
  protected readonly submitting = signal<boolean>(false);

  // uploading signal: 画像アップロード中フラグ
  //   true の間はファイル選択ボタン下にスピナーを出し、二重アップロードを防ぐ
  //   submitting と独立: フォーム送信中でなくてもアップロード中はあり得る
  protected readonly uploading = signal<boolean>(false);

  // categories signal: ドロップダウンに表示するカテゴリ一覧 (初期値は空配列)
  //   ngOnInit で API から取得して set する
  protected readonly categories = signal<Category[]>([]);

  // ─────────────────────────────────────────────────────
  // Reactive Forms: フォーム定義 (Create と同じバリデータ構成)
  //   - 編集画面でも入力ルールは同じ
  //   - 初期値は空にしておき、ngOnInit の patchValue で API 取得値を流し込む
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
  // ngOnInit: コンポーネント生成直後 (テンプレート描画前) に呼ばれる Angular ライフサイクル
  //   流れ: URLから:id取得 → カテゴリ一覧取得 → 商品取得 → patchValueでフォームに反映 → loading解除
  // ─────────────────────────────────────────────────────
  ngOnInit(): void {
    // ① URL から :id を取り出す
    //   snapshot.paramMap.get('id') は string | null を返す
    //   null だった場合 (本来あり得ないが念のため) は一覧へ戻す
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam === null) {
      this.router.navigate(['/products']);
      return;
    }

    // ② string → number に変換 (Number() は失敗時 NaN を返す)
    //   NaN になったら不正な URL なので一覧へ戻す
    this.productId = Number(idParam);
    if (Number.isNaN(this.productId)) {
      this.router.navigate(['/products']);
      return;
    }

    // ③ カテゴリ一覧と商品データの両方を取得
    this.loadCategories();
    this.loadProduct();
  }

  // ─────────────────────────────────────────────────────
  // loadCategories(): カテゴリ一覧を API から取得して categories signal にセット
  //   ドロップダウン (<mat-select>) はこの signal の中身をオプションとして表示する
  // ─────────────────────────────────────────────────────
  private loadCategories(): void {
    this.categoryService.getAll().subscribe({
      // 取得成功: signal に詰めて mat-select の選択肢を更新
      next: (data) => this.categories.set(data),
      error: (err) => console.error('カテゴリ一覧取得に失敗:', err),
    });
  }

  // ─────────────────────────────────────────────────────
  // loadProduct(): 編集対象の商品1件を API から取得し、フォームに反映
  //   patchValue: 対象フィールドだけ値を流し込む (setValue は全フィールド必須なので使い分け)
  // ─────────────────────────────────────────────────────
  private loadProduct(): void {
    this.productService.getById(this.productId).subscribe({

      next: (product) => {
        //取得してきたデータをフォームに反映(既存値を表示)
        this.form.patchValue({
          price: String(product.price),
          stock: String(product.stock),
          categoryId: String(product.categoryId),
          description: product.description ?? '',
          imageUrl: product.imageUrl ?? '',
          name: product.name,
        })
        //loadingを消す
        this.loading.set(false);
      },

      error: (err) => {
        // 取得失敗: 原因を Console に出す
        console.error('商品取得に失敗:', err);
        // 失敗時もローディング表示は消す
        this.loading.set(false);
        // 商品一覧に戻す
        this.router.navigate(['/products']);
      },
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

    // ③ ペイロード組立 (Create と同じく description/imageUrl は空欄→null)
    const raw = this.form.value;
    const description = raw.description?.trim() ? raw.description : null;
    const imageUrl = raw.imageUrl?.trim() ? raw.imageUrl : null;

    const payload = {
      name: raw.name as string,
      description: description,
      price: Number(raw.price),
      imageUrl: imageUrl,
      stock: Number(raw.stock),
      categoryId: Number(raw.categoryId),
    };

    // ④ API 呼び出し (PUT /products/:id)
    this.productService.update(this.productId, payload).subscribe({
      // ─────────────────────────────────────────────────────
      // 穴埋め ToDo-2:
      //   更新成功時の処理 (next ハンドラの中身)
      // ヒント:
      //   - this.router.navigate(['/products']) で一覧画面に戻す
      //   - this.submitting.set(false) で送信中フラグを解除
      //   - product-create.ts の ToDo-3 と完全に同じパターン
      // ─────────────────────────────────────────────────────
      next: () => {
        //更新に成功した場合商品一覧画面にリダイレクトしてボタンを戻す
        this.router.navigate(['/products']);
        this.submitting.set(false);
      },

      error: (err) => {
        // 失敗した場合エラー文を出力し、ボタンを戻す
        console.error('商品更新に失敗:', err);
        this.submitting.set(false);
      },
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

      next: (_res) => {
        //アップロードに成功した場合
        this.form.controls.imageUrl.patchValue(_res.url);
        //アップロード中表示を解除
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
