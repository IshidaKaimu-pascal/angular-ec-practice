// UserService: ユーザー関連の API 呼び出しを集約するサービス
// コンポーネントから直接 HttpClient を使うのではなく、サービス経由にすることで
//   - コンポーネントが「どこから取得するか」を知らなくて済む（疎結合）
//   - 同じ API 呼び出しを複数コンポーネントで共有しやすい
//   - 後でモック実装に差し替えやすい（テスト時）
// という設計上のメリットがある。
//
// product.service.ts / category.service.ts と同じパターンで実装している。

import { Injectable, inject } from '@angular/core';
// HttpParams: URL のクエリパラメータ (?q=xxx など) を安全に組み立てるためのクラス
//   文字列結合 (`${url}?q=${q}`) と違い、特殊文字 (空白・&・? 等) を自動でエスケープしてくれる
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, UserRole, Paged } from 'shared';

// ─────────────────────────────────────────────────────
// Payload 型 (API への送信 body の形)
//   shared 側の User 型から id / createdAt / updatedAt を除き、
//   さらに password (リクエスト時のみ送る秘匿項目) を加えた形。
//
//   password を分けて扱う理由:
//     - レスポンスには含まれない (API 側で safeUserSelect により除外済み)
//     - リクエストでは送る必要がある (新規作成時は必須、更新時は任意)
//
//   Create と Update で別の型にする理由:
//     - Create: name/email/password/role は「必須」として扱いたい
//     - Update: 部分更新 (一部のフィールドだけ変える) も許したいので全て optional に
//              password も optional にし、変更したいときだけ送る運用にする
// ─────────────────────────────────────────────────────
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  // address / phone は schema.prisma で nullable のため null を許可
  address: string | null;
  phone: string | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  // password は「変更したいときだけ送る」想定なので optional
  password?: string;
  role?: UserRole;
  address?: string | null;
  phone?: string | null;
}

// @Injectable: このクラスを Angular の DI(依存注入) システムに登録するデコレータ
// providedIn: 'root' は「アプリ全体で1つのインスタンスを共有」(シングルトン)の意味
@Injectable({ providedIn: 'root' })
export class UserService {
  // inject() 関数で HttpClient を取得（旧 constructor(private http: HttpClient) の新スタイル）
  private readonly http = inject(HttpClient);
  // API ベース URL (Express サーバーの /users エンドポイント)
  private readonly baseUrl = 'http://localhost:3000/users';


  // 全ユーザー一覧を取得して Observable<User[]> を返す
  //   q が指定されたら ?q=xxx を付けてサーバー側で OR 検索 (Step 8-1 の API に対応)
  //     SELECT * FROM users WHERE name LIKE '%q%' OR email LIKE '%q%';
  //   引数なしなら全件取得 (SELECT * FROM users;)
  // HTTP メソッド: GET
  getAll(q?: string): Observable<User[]> {
    // q が渡された (空文字でも undefined でもない) 時だけ HttpParams を作る
    //   category.service.ts と同じパターン (反復で定着させる)
    const params = q ? new HttpParams().set('q', q) : undefined;
    return this.http.get<User[]>(this.baseUrl, { params });
  }


  // ページング版: ?page=N&pageSize=M(&q=...) を付けて API を呼び、Paged<User> を返す
  //   getAll() との違い: レスポンスが配列ではなく {items, total} のオブジェクト形
  //   サーバー側は ?page= の有無で配列 / オブジェクトを切り替える後方互換設計 (Step 9-1)
  //   q は氏名 + メールアドレスの OR 検索 (API 側で対応済み: Step 8-1)
  // HTTP メソッド: GET
  getPage(params: {
    page: number;
    pageSize: number;
    q?: string;
  }): Observable<Paged<User>> {
    // page と pageSize は必須なので最初にセット (HttpParams は immutable: set すると新インスタンスを返す)
    //   String(...) で数値を文字列化: URL クエリは文字列しか持てないため
    let httpParams = new HttpParams()
      .set('page', String(params.page))
      .set('pageSize', String(params.pageSize));
    // q が指定されていれば検索クエリも追加 (空文字 / undefined / null は除外)
    if (params.q) {
      httpParams = httpParams.set('q', params.q);
    }
    return this.http.get<Paged<User>>(this.baseUrl, { params: httpParams });
  }


  // 指定IDのユーザー1件を取得して Observable<User> を返す (SELECT * FROM users WHERE id = :id;)
  // HTTP メソッド: GET
  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }


  // ユーザーを新規作成し、作成されたユーザーを Observable<User> で返す
  // (INSERT INTO users (...) VALUES (...);)
  // HTTP メソッド: POST
  create(payload: CreateUserPayload): Observable<User> {
    return this.http.post<User>(this.baseUrl, payload);
  }


  // 指定IDのユーザーを更新し、更新後のユーザーを Observable<User> で返す
  // (UPDATE users SET ... WHERE id = :id;)
  // HTTP メソッド: PUT
  update(id: number, payload: UpdateUserPayload): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, payload);
  }


  // 指定IDのユーザーを削除する。レスポンスは無し (DELETE FROM users WHERE id = :id)
  // ジェネリクスに void を指定するのは「レスポンスボディなし」の表明
  // HTTP メソッド: DELETE
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
