# プロジェクト概要

このリポジトリは、Ruby on RailsアプリケーションとそのインフラストラクチャをAWS上で管理・運用するためのものです。

## リポジトリ構造
├── sample_app/ # Railsアプリケーション
│ ├── app/ # アプリケーションのコア機能
│ ├── config/ # 設定ファイル
│ ├── db/ # データベース関連
│ ├── spec/ # テストファイル
│ └── Dockerfile # アプリケーションのコンテナ化設定
├── cdk/ # AWSインフラ構成（CDK）
│ ├── bin/ # CDKアプリケーションのエントリーポイント
│ └── lib/ # インフラストラクチャスタック定義
│ ├── vpc-stack.ts # VPCリソース
│ ├── ecr-stack.ts # ECRリソース
│ ├── rds-stack.ts # RDSリソース
│ └── ecs-fargate-online-stack.ts # ECSリソース
└── compose.yml # ローカル開発環境の設定

## 技術スタック
### アプリケーション
- Ruby 3.3.6
- Rails 7.2.2
- MySQL 8.0.32

### インフラストラクチャ
- AWS CDK (TypeScript)
- Docker/Docker Compose
- AWS主要サービス
  - ECS Fargate
  - Aurora MySQL
  - ECR
  - ALB
  - VPC

## 開発環境のセットアップ
1. リポジトリのクローン
```bash
git clone [repository-url]
```

2. 開発環境の起動
```bash
docker compose up -d
```

3. データベースの作成
```bash
docker compose exec app bin/rails db:create
```

## デプロイメント
GitHub Actionsを使用して、以下のワークフローを実装しています：
1. CI（継続的インテグレーション）
- セキュリティスキャン（Brakeman）
- コードスタイルチェック（RuboCop）
- テスト実行（RSpec）

2. CD（継続的デリバリー）
- ECRへのDockerイメージのプッシュ
- ECS Fargateへのデプロイ

## インフラストラクチャの管理
CDKを使用してインフラストラクチャをコード化しています。主要なスタックは以下の通りです：
- VPCスタック: ネットワーク構成
- ECRスタック: コンテナレジストリ
- RDSスタック: データベース
- ECS Fargateスタック: アプリケーション実行環境
