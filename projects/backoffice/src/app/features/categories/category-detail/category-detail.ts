import { Component, OnInit, inject, signal } from '@angular/core';
// ActivatedRoute: 現在の URL に紐付くルート情報を取得するサービス
//   snapshot.paramMap.get('id') で URL の :id 部分を文字列として取り出せる
// Router: 画面遷移をプログラムから行うためのオブジェクト
// RouterLink: <a routerLink="..."> で SPA 内ナビゲーション (編集/一覧ボタン用)
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// Angular Material のボタン部品
import { MatButtonModule } from '@angular/material/button';
// MatProgressSpinnerModule: ローディング中のクルクル表示用
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
// DatePipe: テンプレート内で日付フォーマットを行う ({{ value | date:'yyyy-MM-dd' }})
import { DatePipe } from '@angular/common';
import { CategoryService } from '../../../services/category.service';
// Category: shared ライブラリで定義された型 (id/name/displayOrder/createdAt/updatedAt)
import { Category } from 'shared';

@Component({
  selector: 'app-category-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressSpinnerModule,
    DatePipe,
  ],
  templateUrl: './category-detail.html',
  styleUrl: './category-detail.scss',
})
export class CategoryDetail implements OnInit {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  // ─────────────────────────────────────────────────────
  private readonly categoryService = inject(CategoryService);
  private readonly router = inject(Router);
  // ActivatedRoute: URL の :id を読み取るために使う
  private readonly route = inject(ActivatedRoute);

  // ─────────────────────────────────────────────────────
  // 詳細表示中のカテゴリID (テンプレートからも使うため protected)
  // ─────────────────────────────────────────────────────
  protected categoryId!: number;

  // ─────────────────────────────────────────────────────
  // loading signal: 初回データ取得中フラグ
  //   true の間はスピナーを表示し、取得完了で false にする
  // ─────────────────────────────────────────────────────
  protected readonly loading = signal<boolean>(true);

  // ─────────────────────────────────────────────────────
  // category signal: 取得した1件のカテゴリ情報
  //   初期値は null (まだ未取得を表す)
  //   テンプレート側で @if (category()) ガードしてから値を参照する
  // ─────────────────────────────────────────────────────
  protected readonly category = signal<Category | null>(null);

  // ─────────────────────────────────────────────────────
  // ngOnInit: コンポーネント生成直後 (テンプレート描画前) に呼ばれる Angular ライフサイクル
  //   流れ: URLから:id取得 → API取得 → category signal にセット → loading 解除
  // ─────────────────────────────────────────────────────
  ngOnInit(): void {
    // ① URL から :id を取り出す
    //   snapshot.paramMap.get('id') は string | null を返す
    //   null だった場合は不正な URL なので一覧へ戻す
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam === null) {
      this.router.navigate(['/categories']);
      return;
    }

    // ② string → number に変換
    //   NaN になったら不正な URL (例: /categories/abc) なので一覧へ戻す
    this.categoryId = Number(idParam);
    if (Number.isNaN(this.categoryId)) {
      this.router.navigate(['/categories']);
      return;
    }

    // ③ API からカテゴリ情報を取得する
    this.categoryService.getById(this.categoryId).subscribe({
      //成功した場合セットし、ローディング解除
      next: (c) => {
        // 取得した1件のカテゴリを signal に保存 (テンプレートが @if 経由で参照して表示する)
        this.category.set(c);
        // スピナーを止めて詳細表示 (@else ブランチ) に切り替える
        this.loading.set(false);
      },

      //失敗した場合エラー文を出力し、カテゴリ一覧に戻す
      error: (err) => {
        // 取得失敗の原因を Console に出力 (デバッグ用)
        // 例: 存在しないID で API が 404 を返した場合など
        console.error('カテゴリ取得に失敗:', err);
        // 失敗時もスピナー表示は消す (画面がローディングのまま固まらないように)
        this.loading.set(false);
        // 詳細表示する意味がないので一覧画面へリダイレクト
        this.router.navigate(['/categories']);
      }
    });
  }
}
