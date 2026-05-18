// Expressサーバーのエントリーポイント。
// `npm run dev` で tsx がこのファイルを起動する。
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';

// ============================================================
// アプリケーション本体の作成
// ============================================================
const app = express();
const PORT = process.env.PORT ?? 3000;

// ============================================================
// ミドルウェア
//   - cors: Angular側 (4200/4201) からのリクエストを許可
//   - express.json: リクエストボディのJSONを自動でパース
// ============================================================
app.use(
  cors({
    origin: ['http://localhost:4200', 'http://localhost:4201'],
  })
);
app.use(express.json());

// ============================================================
// 動作確認用ルート
// ブラウザで http://localhost:3000/ にアクセスすると {ok: true} が返る
// ============================================================
app.get('/', (_req: Request, res: Response) => {
  res.json({ ok: true, message: 'EC practice API is running' });
});

// ============================================================
// リソースルート
//   各ルートファイル (routes/*.ts) で定義された Router をURLパスにマウントする
// ============================================================
import usersRouter from './routes/users';
import categoriesRouter from './routes/categories';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
app.use('/users', usersRouter);
app.use('/categories', categoriesRouter);
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);

// ============================================================
// 404ハンドラ（マッチしないURLへのリクエスト用）
// ============================================================
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// ============================================================
// エラーハンドラ（ルート内で throw されたエラーを捕捉）
// Express 5 では async 関数内の throw も自動でここに来る
// ============================================================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// ============================================================
// サーバー起動
// ============================================================
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
