// Prismaクライアント（DBへの窓口）をアプリ全体で1つだけ作って使い回す。
// 複数箇所で new PrismaClient() すると、毎回DB接続が増えて非効率になるため、
// ここで1つだけ作って export し、各ルートで import { prisma } from '../prisma' する。

// dotenv: .env ファイルを process.env に読み込むライブラリ。
// Prisma v7 から自動読み込みがなくなったため、明示的に最初に呼ぶ必要がある。
import 'dotenv/config';

// Prisma v7 から「ドライバーアダプター方式」になった。
// Prisma本体はSQL組み立てだけを担当し、DB接続は専用ドライバー(mariadb)に任せる構成。
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL が .env に設定されていません');
}

// MariaDB/MySQL用ドライバーアダプターを生成
// 接続文字列(mysql://...)をそのまま渡せる
const adapter = new PrismaMariaDb(process.env.DATABASE_URL);

// PrismaClientには adapter を渡す（v7必須）
export const prisma = new PrismaClient({ adapter });
