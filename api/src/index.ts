// Expressサーバーのエントリーポイント。
// `npm run dev` で tsx がこのファイルを起動する。
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import 'dotenv/config';

// ============================================================
// アプリケーション本体の作成
// ============================================================
const app = express();
const PORT = process.env.PORT ?? 3000;

// ============================================================
// ミドルウェア
//   - cors: 環境変数 CORS_ORIGIN で指定したオリジンからのリクエストを許可
//           (カンマ区切りで複数指定可。未指定時は localhost:4200/4201 を許可)
//           Cloud9 等の本番環境では .env で CORS_ORIGIN=http://ec2-xx.compute.amazonaws.com のように設定
//   - express.json: リクエストボディのJSONを自動でパース
// ============================================================
const corsOrigins = (
  process.env.CORS_ORIGIN ?? 'http://localhost:4200,http://localhost:4201'
)
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

app.use(
  cors({
    origin: corsOrigins,
  })
);
app.use(express.json());

// ============================================================
// 静的ファイル配信
//   api/public 配下のファイルを /static/... のURLで配信する。
//   例: api/public/products/yarn-red-500g.jpg
//       → http://localhost:3000/static/products/yarn-red-500g.jpg
//   path.join(__dirname, '../public') は、dev時 (tsx で api/src/index.ts を起動) でも
//   api/public/ を指すように __dirname (= api/src) から一つ上に上がる解決。
// ============================================================
app.use('/static', express.static(path.join(__dirname, '../public')));

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
import authRouter from './routes/auth';
import uploadsRouter from './routes/uploads';
app.use('/users', usersRouter);
app.use('/categories', categoriesRouter);
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);
app.use('/auth', authRouter);
app.use('/uploads', uploadsRouter);

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
