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
import { UserService } from '../../../services/user.service';
// User: shared ライブラリで定義された型 (id/name/email/role/address?/phone?/createdAt/updatedAt)
//   ※ password は API のレスポンスに含まれないため User 型にも無い
import { User } from 'shared';

@Component({
  selector: 'app-user-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatProgressSpinnerModule,
    DatePipe,
  ],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetail implements OnInit {
  // ─────────────────────────────────────────────────────
  // DI (依存注入): 必要なサービスを inject() 関数で取得
  // ─────────────────────────────────────────────────────
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  // ActivatedRoute: URL の :id を読み取るために使う
  private readonly route = inject(ActivatedRoute);

  // ─────────────────────────────────────────────────────
  // 詳細表示中のユーザーID (テンプレートからも使うため protected)
  // ! は definite assignment assertion: 「ngOnInit で必ず代入される」と TS に伝える
  // ─────────────────────────────────────────────────────
  protected userId!: number;

  // ─────────────────────────────────────────────────────
  // loading signal: 初回データ取得中フラグ
  //   true の間はスピナーを表示し、取得完了で false にする
  // ─────────────────────────────────────────────────────
  protected readonly loading = signal<boolean>(true);

  // ─────────────────────────────────────────────────────
  // user signal: 取得した1件のユーザー情報
  //   初期値は null (まだ未取得を表す)
  //   テンプレート側で @if (user()) ガードしてから値を参照する
  // ─────────────────────────────────────────────────────
  protected readonly user = signal<User | null>(null);

  // ─────────────────────────────────────────────────────
  // ngOnInit: コンポーネント生成直後 (テンプレート描画前) に呼ばれる Angular ライフサイクル
  //   流れ: URLから:id取得 → 数値化 → API取得 → user signal にセット → loading 解除
  // ─────────────────────────────────────────────────────
  ngOnInit(): void {
    // ① URL から :id を取り出す
    //   snapshot.paramMap.get('id') は string | null を返す
    //   null だった場合は不正な URL なので一覧へ戻す
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam === null) {
      this.router.navigate(['/users']);
      return;
    }

    // ② string → number に変換
    //   Number.isNaN() は「値が NaN そのものか」を厳密に判定する
    //   (グローバルの isNaN("abc") とは挙動が違うので注意)
    this.userId = Number(idParam);
    if (Number.isNaN(this.userId)) {
      this.router.navigate(['/users']);
      return;
    }

    // ③ API からユーザー情報を取得する
    this.userService.getById(this.userId).subscribe({
      next: (u) =>{
        //取得したユーザー情報をsignal(user)につめる
        this.user.set(u);
        //読み込み中を消す
        this.loading.set(false);
      },
      error: (err) => {
        //失敗した場合エラー文を出力し、読み込み中を消す
        console.error('ユーザー取得に失敗:',err);
        this.loading.set(false);
        this.router.navigate(['/users']);
      }
    })


  }
}
