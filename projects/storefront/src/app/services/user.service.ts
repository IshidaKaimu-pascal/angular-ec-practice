// UserService: ユーザー関連のAPI呼び出しを集約するサービス
// 主に「ユーザー設定」「パスワード変更」画面から使う。

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from 'shared';

// ユーザー更新時に送るリクエストボディの型。
// すべて optional (?) にして「変更したいフィールドだけ送る」設計にする(部分更新)。
// API側 PUT /users/:id は req.body をそのまま data に渡しているので、
// この型で「送って良いキー」を制約しておくと typo 防止になる。
export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  address?: string | null;
  phone?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/users';

  // ユーザー情報を取得（GET /users/:id）
  getById(id: number): Observable<User>{
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  // ユーザー情報を更新（PUT /users/:id）
  // payload に含めたフィールドだけが更新される（部分更新）
  update(id: number, payload: UpdateUserPayload): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, payload);
  }
}
