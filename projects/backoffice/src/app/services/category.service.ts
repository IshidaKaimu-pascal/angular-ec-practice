// CategoryService: カテゴリ関連の API 呼び出しを集約するサービス
// コンポーネントから直接 HttpClient を使うのではなく、サービス経由にすることで
//   - コンポーネントが「どこから取得するか」を知らなくて済む（疎結合）
//   - 同じ API 呼び出しを複数コンポーネントで共有しやすい
//   - 後でモック実装に差し替えやすい（テスト時）
// という設計上のメリットがある。

import { Injectable, inject } from '@angular/core';
// HttpParams: URL のクエリパラメータ (?q=xxx&page=1 など) を安全に組み立てるためのクラス
//   文字列結合 (`${url}?q=${q}`) と違い、特殊文字 (空白・&・? 等) を自動でエスケープしてくれる
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Category, Paged } from 'shared';
import { environment } from '../../environments/environment';

// ─────────────────────────────────────────────────────
// Payload 型 (API への送信 body の形)
//   shared 側の Category 型から id / createdAt / updatedAt を除いた、
//   フォームで入力する部分だけの型。
//
//   Create と Update で別の型にする理由:
//     - Create: 必須項目 (name) を「必須」として扱いたい
//     - Update: 部分更新 (一部のフィールドだけ変える) も許したいので optional に
// ─────────────────────────────────────────────────────
export interface CreateCategoryPayload {
  name: string;
  // displayOrder: 商品一覧画面でカテゴリを並べる際の表示順 (小さい値ほど先に表示)
  // 作成時は必須にする (フォームで必ず入力させる前提)
  displayOrder: number;
}

export interface UpdateCategoryPayload {
  // 更新時は「一部だけ変える」を許したいので両方とも optional (?)
  name?: string;
  displayOrder?: number;
}

// @Injectable: このクラスを Angular の DI(依存注入) システムに登録するデコレータ
// providedIn: 'root' は「アプリ全体で1つのインスタンスを共有」(シングルトン)の意味
@Injectable({ providedIn: 'root' })
export class CategoryService {
  // inject() 関数で HttpClient を取得（旧 constructor(private http: HttpClient) の新スタイル）
  private readonly http = inject(HttpClient);
  // API ベース URL (Express サーバーの /categories エンドポイント)
  // XAMPP は MariaDB だけを動かす役割で、API は Node.js の Express 側 (port 3000)
  private readonly baseUrl = `${environment.apiUrl}/categories`;


  // 全カテゴリ一覧を取得して Observable<Category[]> を返す
  // q が指定されたら ?q=xxx を付けてサーバー側で LIKE 検索 (Step 8-1 の API に対応)
  //   引数なし: SELECT * FROM categories;
  //   q あり : SELECT * FROM categories WHERE name LIKE '%xxx%';
  // httpメソッド:GET
  getAll(q?: string): Observable<Category[]> {
    // q が渡された (空文字でも undefined でもない) 時だけ HttpParams を作る
    //   ?? は q が undefined/null の時に右辺を使う Null 合体演算子
    //   HttpParams は文字列結合より安全 (特殊文字を自動エスケープ)
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http.get<Category[]>(this.baseUrl, { params });
  }


  // ページング版: ?page=N&pageSize=M(&q=...) を付けて API を呼び、Paged<Category> を返す
  //   getAll() との違い: レスポンスが配列ではなく {items, total} のオブジェクト形
  //   サーバー側は ?page= の有無で配列 / オブジェクトを切り替える後方互換設計 (Step 9-1)
  // httpメソッド: GET
  getPage(params: { page: number; pageSize: number; q?: string }): Observable<Paged<Category>> {
    // page と pageSize は必須なので最初にセット (HttpParams は immutable: set すると新インスタンスを返す)
    //   String(...) で数値を文字列化: URL クエリは文字列しか持てないため
    let httpParams = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    // q が指定されていれば検索クエリも追加 (空文字 / undefined / null は除外)
    if (params.q) {
      httpParams = httpParams.set('q', params.q);
    }
    return this.http.get<Paged<Category>>(this.baseUrl, { params: httpParams });
  }


  //指定IDのカテゴリ1件を取得して Observable<Category> を返す(SELECT * FROM categories WHERE id = :id;)
  //httpメソッド:GET
  getById(id:number):Observable<Category>{
  return this.http.get<Category>(`${this.baseUrl}/${id}`);
}
  //カテゴリを新規作成し、作成されたカテゴリを Observable<Category> で返す(INSERT INTO categories (name) VALUES (:name);)
  //httpメソッド:POST
  create(payload: CreateCategoryPayload): Observable<Category> {
    return this.http.post<Category>(this.baseUrl, payload);
  }


  // 指定IDのカテゴリを更新し、更新後のカテゴリを Observable<Category> で返す(UPDATE categories SET name = :name WHERE id =:id)
  //  HTTP メソッド: PUT
  update(id: number, payload:UpdateCategoryPayload):Observable<Category>{
    return this.http.put<Category>(`${this.baseUrl}/${id}`,payload);
  }

  //指定IDのカテゴリを削除する。レスポンスは無し (DELETE FROM categories WHERE id = :id)
  //ジェネリクスに void を指定するのは「レスポンスボディなし」の表明
  delete(id:number): Observable<void>{
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
