# Docker エラー修正まとめ

## 修正したエラー

### 1. Python依存関係エラー
- **エラー**: `ERROR: ResolutionImpossible`
- **修正**: requirements.txt のバージョン指定を `==` から `>=` に変更

### 2. Frontend npm エラー
- **エラー**: `ERROR [frontend 4/5] RUN npm ci`
- **原因**: package.json と package-lock.json の同期エラー
- **修正**: `npm ci` を `npm install` に変更

## 現在の動作する設定

### Frontend Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies (npm install で依存関係を解決)
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

### Backend Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Backend requirements.txt
```
fastapi>=0.104.1
uvicorn[standard]>=0.24.0
python-dotenv>=1.0.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
httpx>=0.25.2
python-multipart>=0.0.6
```

## 確実に動作させる手順

```bash
# 1. 完全リセット
docker-compose down --volumes --remove-orphans
docker system prune -f

# 2. 古いlockファイルを削除（必要に応じて）
rm frontend/package-lock.json

# 3. 再ビルド・起動
docker-compose up --build
```

## 開発vs本番の使い分け

### 開発環境（現在の設定）
- `npm install`: 依存関係を自動解決
- 全ての devDependencies をインストール
- `npm run dev` でホットリロード

### 本番環境（Dockerfile.production）
- `npm ci`: 確定した依存関係でインストール
- `--only=production` で本番用パッケージのみ
- `npm start` で本番サーバー起動

## よく使うデバッグコマンド

```bash
# ログ確認
docker-compose logs -f frontend
docker-compose logs -f backend

# コンテナ内でシェル実行
docker-compose exec frontend sh
docker-compose exec backend bash

# 個別サービス起動
docker-compose up frontend
docker-compose up backend

# 完全クリーンアップ
docker-compose down --volumes --remove-orphans
docker system prune -a --volumes
```