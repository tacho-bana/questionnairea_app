# Docker トラブルシューティングガイド

## Python依存関係の競合エラー

`ERROR: ResolutionImpossible` が発生した場合の対処法です。

### 対処法1: 段階的に依存関係をインストール

```bash
# 現在のコンテナを停止・削除
docker-compose down --volumes --remove-orphans

# キャッシュをクリア
docker system prune -f

# 再ビルドして起動
docker-compose up --build
```

### 対処法2: 最小構成で起動

`backend/requirements-minimal.txt` を使用:

```bash
# backend/Dockerfile を一時的に変更
# requirements.txt → requirements-minimal.txt

# 再ビルド
docker-compose up --build
```

### 対処法3: 個別にサービスを起動

```bash
# フロントエンドのみ起動
docker-compose up frontend

# 別ターミナルでバックエンドを起動
docker-compose up backend
```

## よくあるエラーと解決法

### 1. Frontend npm ci 同期エラー
```
ERROR [frontend 4/5] RUN npm ci
npm error `npm ci` can only install packages when your package.json and package-lock.json are in sync
```

**原因**: package.json と package-lock.json が同期していない

**解決法**: 
```bash
# Docker使用時は npm install を使用（Dockerfileで修正済み）
docker-compose down --volumes
docker-compose up --build

# または手動でlock fileを削除
rm frontend/package-lock.json
docker-compose up --build
```

### 2. ポート競合エラー
```
Error: port is already allocated
```

**解決法:**
```bash
# 使用中のポートを確認
lsof -i :3000
lsof -i :8000

# プロセスを終了
kill -9 <PID>

# または異なるポートを使用
# docker-compose.yml でポート番号を変更
```

### 2. Docker デーモンエラー
```
Cannot connect to the Docker daemon
```

**解決法:**
```bash
# Docker Desktop を起動
# または Docker サービスを開始
sudo systemctl start docker  # Linux
```

### 3. メモリ不足エラー
```
The build failed because the process exited too early
```

**解決法:**
```bash
# Docker Desktop の設定でメモリを増やす（推奨: 4GB以上）
# またはSwapを有効にする
```

### 4. ネットワークエラー
```
network not found
```

**解決法:**
```bash
# Docker ネットワークをリセット
docker-compose down
docker network prune
docker-compose up
```

## デバッグ用コマンド

```bash
# コンテナの状態確認
docker-compose ps

# ログの確認
docker-compose logs -f

# 特定のサービスのログ
docker-compose logs -f backend
docker-compose logs -f frontend

# コンテナ内でシェルを実行
docker-compose exec backend bash
docker-compose exec frontend sh

# 依存関係の確認（backend コンテナ内）
docker-compose exec backend pip list

# 環境変数の確認
docker-compose exec backend env
docker-compose exec frontend env
```

## 最小構成での起動手順

依存関係の問題が解決しない場合:

1. **最小構成のrequirements.txt を使用:**

```bash
# backend/requirements.txt を以下に置き換え
fastapi>=0.104.1
uvicorn[standard]>=0.24.0
python-dotenv>=1.0.0
pydantic>=2.5.0
httpx>=0.25.2
```

2. **フロントエンドのみで起動テスト:**

```bash
cd frontend
npm install
npm run dev
```

3. **バックエンドを手動起動:**

```bash
cd backend
pip install -r requirements-minimal.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 完全リセット手順

すべてのDockerデータをクリアして再開:

```bash
# コンテナ・イメージ・ボリューム・ネットワークを全削除
docker-compose down --volumes --remove-orphans
docker system prune -a --volumes

# 再ビルド
docker-compose up --build
```

## 推奨環境

- **Docker Desktop**: 最新版
- **メモリ**: 4GB以上割り当て
- **ディスク容量**: 2GB以上の空き容量
- **ネットワーク**: 安定したインターネット接続（依存関係ダウンロードのため）